const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const documentRoutes = require('./routes/documentRoutes');

const app = express();

// Middlewares Globais
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rota de Boas-vindas e Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'DocSaaS Backend MVP - TCC Startup XYZ',
    version: '1.0.0',
    features: [
      'Multi-tenant Data Isolation',
      'Pre-signed URLs (S3/Supabase Storage)',
      'LGPD Soft Delete Compliance',
      'Storage Lifecycle Simulation (Glacier Deep Archive)'
    ],
    timestamp: new Date().toISOString()
  });
});

// Mapeamento das Rotas da Aplicação
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

// Tratamento de Rotas Não Encontradas (404)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Rota não encontrada: ${req.method} ${req.originalUrl}`
  });
});

// Middleware Global de Tratamento de Erros
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Erro interno do servidor'
  });
});

module.exports = app;
