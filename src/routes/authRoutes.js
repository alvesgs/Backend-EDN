const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/auth');

// Rotas públicas de autenticação
router.post('/register', register);
router.post('/login', login);

// Rota protegida para validar token atual
router.get('/me', authMiddleware, getMe);

module.exports = router;
