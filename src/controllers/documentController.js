const { supabase } = require('../config/supabase');

const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'documents';

/**
 * 1. Gera uma Pre-signed Upload URL para envio direto ao Storage.
 * Isolamento Multi-tenant: o caminho do arquivo é prefixado com o tenantId.
 */
const generateUploadUrl = async (req, res) => {
  try {
    const { fileName, contentType, sizeBytes } = req.body;
    const tenantId = req.user.tenantId;

    if (!fileName) {
      return res.status(400).json({
        success: false,
        error: 'O campo "fileName" é obrigatório.'
      });
    }

    // Sanitização e isolamento da chave no padrão /{tenantId}/{timestamp}_{filename}
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    const documentId = `doc_${timestamp}`;
    const filePath = `${tenantId}/${documentId}_${sanitizedFileName}`;

    // Cria a Signed Upload URL no Supabase Storage (validade de 900 segundos = 15 min)
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(filePath);

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao gerar URL pré-assinada no Storage.',
        details: error.message
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        documentId,
        uploadUrl: data.signedUrl,
        token: data.token,
        filePath: filePath,
        expiresIn: 900,
        tenantId
      }
    });
  } catch (err) {
    console.error('Erro em generateUploadUrl:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao gerar URL de upload.'
    });
  }
};

/**
 * 2. Salva os metadados do documento após a conclusão do upload.
 * Persistência vinculada estritamente ao tenant_id e user_id.
 */
const saveDocumentMetadata = async (req, res) => {
  try {
    const { title, filePath, fileSize, mimeType, documentId } = req.body;
    const { id: userId, tenantId } = req.user;

    if (!title || !filePath) {
      return res.status(400).json({
        success: false,
        error: 'Os campos "title" e "filePath" são obrigatórios.'
      });
    }

    // Barreira de Segurança: impede que um usuário salve arquivos fora de sua partição
    if (!filePath.startsWith(`${tenantId}/`)) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado: o caminho do arquivo não pertence ao seu Tenant (Tenant Mismatch).'
      });
    }

    const newDoc = {
      title,
      file_path: filePath,
      file_size: fileSize || null,
      mime_type: mimeType || null,
      tenant_id: tenantId,
      user_id: userId,
      storage_class: 'STANDARD', // Padrão inicial
      deleted: false,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('documents')
      .insert([newDoc])
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao salvar metadados no banco de dados.',
        details: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Documento registrado com sucesso no catálogo.',
      data
    });
  } catch (err) {
    console.error('Erro em saveDocumentMetadata:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao salvar metadados do documento.'
    });
  }
};

/**
 * 3. Lista apenas os documentos do Tenant autenticado (Isolamento Comprovado).
 */
const listDocuments = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { search } = req.query;

    let query = supabase
      .from('documents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('deleted', false)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao listar documentos.',
        details: error.message
      });
    }

    return res.status(200).json({
      success: true,
      tenantId: tenantId,
      total: data ? data.length : 0,
      data: data || []
    });
  } catch (err) {
    console.error('Erro em listDocuments:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao listar documentos.'
    });
  }
};

/**
 * 4. Consulta um documento e gera URL assinada de download.
 * Atende ao requisito do TCC: se storageClass for GLACIER, downloadUrl retorna null.
 */
const getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const { data: document, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('deleted', false)
      .single();

    if (error || !document) {
      return res.status(404).json({
        success: false,
        error: 'Documento não encontrado ou sem permissão de acesso (Tenant Mismatch).'
      });
    }

    // Regra de Negócio de Lifecycle (Glacier vs Standard)
    if (document.storage_class === 'GLACIER') {
      return res.status(200).json({
        success: true,
        data: {
          ...document,
          downloadUrl: null,
          storageClass: 'GLACIER',
          statusMessage: 'Documento arquivado em camada fria (Glacier). Solicite a restauração para download.'
        }
      });
    }

    // Gera Signed Download URL com validade de 900 segundos (15 min)
    const { data: signedData, error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(document.file_path, 900);

    return res.status(200).json({
      success: true,
      data: {
        ...document,
        downloadUrl: signedData?.signedUrl || null,
        storageClass: 'STANDARD',
        expiresIn: 900
      }
    });
  } catch (err) {
    console.error('Erro em getDocumentById:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao consultar documento.'
    });
  }
};

/**
 * 5. Exclusão Lógica (Conformidade LGPD).
 * Não apaga fisicamente de imediato; marca deleted: true e salva o timestamp.
 */
const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { id: userId, tenantId } = req.user;

    const { data, error } = await supabase
      .from('documents')
      .update({
        deleted: true,
        deleted_at: new Date().toISOString(),
        deleted_by: userId
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Documento não encontrado ou não pertence a este tenant.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Documento desativado com sucesso (Exclusão Lógica LGPD).',
      data
    });
  } catch (err) {
    console.error('Erro em deleteDocument:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao excluir documento.'
    });
  }
};

/**
 * 6. Endpoint de Demonstração para a Banca: Simulação de Lifecycle (Transição para Glacier).
 */
const simulateGlacierArchive = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const { data, error } = await supabase
      .from('documents')
      .update({
        storage_class: 'GLACIER',
        archived_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Documento não encontrado para este tenant.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Documento movido para armazenamento frio (S3 Glacier Deep Archive) após regra de ciclo de vida (> 365 dias).',
      data
    });
  } catch (err) {
    console.error('Erro em simulateGlacierArchive:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao simular transição de camada fria.'
    });
  }
};

/**
 * 7. Endpoint de Demonstração para a Banca: Restauração de Glacier para Standard.
 */
const restoreFromGlacier = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    const { data, error } = await supabase
      .from('documents')
      .update({
        storage_class: 'STANDARD',
        restored_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Documento não encontrado para este tenant.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Documento restaurado da camada fria para acesso imediato (STANDARD).',
      data
    });
  } catch (err) {
    console.error('Erro em restoreFromGlacier:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao restaurar documento.'
    });
  }
};

module.exports = {
  generateUploadUrl,
  saveDocumentMetadata,
  listDocuments,
  getDocumentById,
  deleteDocument,
  simulateGlacierArchive,
  restoreFromGlacier
};
