require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor Docs SaaS rodando na porta ${PORT}`);
  console.log(`📡 Health Check disponível em http://localhost:${PORT}/health`);
  console.log(`📁 Endpoint de Documentos em http://localhost:${PORT}/api/documents`);
});

// Tratamento de finalização graciosa (Graceful Shutdown)
process.on('SIGTERM', () => {
  console.log('Sinal SIGTERM recebido. Encerrando servidor HTTP...');
  server.close(() => {
    console.log('Servidor HTTP encerrado com sucesso.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Sinal SIGINT recebido. Encerrando servidor HTTP...');
  server.close(() => {
    console.log('Servidor HTTP encerrado com sucesso.');
    process.exit(0);
  });
});
