const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth');
const {
  generateUploadUrl,
  saveDocumentMetadata,
  listDocuments,
  getDocumentById,
  deleteDocument,
  simulateGlacierArchive,
  restoreFromGlacier
} = require('../controllers/documentController');

// Todas as rotas de documentos são protegidas pelo middleware de autenticação (Isolamento Multi-tenant)
router.use(authMiddleware);

// 1. Gera URL pré-assinada temporária para upload direto no Storage
router.post('/upload-url', generateUploadUrl);

// 2. Salva metadados do documento após upload
router.post('/', saveDocumentMetadata);

// 3. Lista documentos do Tenant logado
router.get('/', listDocuments);

// 4. Obtém dados e URL de download do documento (ou alerta de Glacier se estiver arquivado)
router.get('/:id', getDocumentById);

// 5. Exclusão Lógica LGPD
router.delete('/:id', deleteDocument);

// 6. Endpoints de Demonstração para a Banca de TCC:
router.post('/:id/simulate-glacier', simulateGlacierArchive); // Simula transição para Glacier (> 365 dias)
router.post('/:id/restore-glacier', restoreFromGlacier);     // Simula restauração de camada fria

module.exports = router;
