const { supabase } = require('../config/supabase');

/**
 * Middleware de Autenticação e Isolamento Multi-Tenant.
 * Valida o JWT do Supabase enviado em Authorization: Bearer <token>
 * e extrai o tenantId para garantir que nenhum usuário acesse dados de outra empresa.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token de autenticação não fornecido. Envie o cabeçalho Authorization: Bearer <token>'
      });
    }

    const token = authHeader.split(' ')[1];

    // Validação do token com o Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Token inválido ou sessão expirada.',
        details: error?.message
      });
    }

    // Extrai o tenantId dos metadados do usuário (ex: "empresa_a", "empresa_b")
    // Se não houver tenant específico nos metadados, usa o user.id como partição isolada
    const tenantId = user.user_metadata?.tenantId ||
                     user.user_metadata?.tenant_id ||
                     user.app_metadata?.tenantId ||
                     user.id;

    req.user = {
      id: user.id,
      email: user.email,
      tenantId: String(tenantId),
      metadata: user.user_metadata || {},
      rawUser: user
    };

    req.token = token;

    next();
  } catch (err) {
    console.error('Erro no middleware de autenticação:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno na validação de autenticação.'
    });
  }
};

module.exports = { authMiddleware };
