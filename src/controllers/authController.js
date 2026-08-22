const { supabase } = require('../config/supabase');

/**
 * Registra um novo usuário no Supabase Auth associando-o a um tenant específico (ex: "empresa_a").
 */
const register = async (req, res) => {
  try {
    const { email, password, tenantId, companyName } = req.body;

    if (!email || !password || !tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Os campos "email", "password" e "tenantId" são obrigatórios.'
      });
    }

    // Cria o usuário no Supabase Auth salvando o tenantId nos metadados
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          tenantId: tenantId.trim().toLowerCase(),
          companyName: companyName || tenantId
        }
      }
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso!',
      user: {
        id: data.user?.id,
        email: data.user?.email,
        tenantId: data.user?.user_metadata?.tenantId,
        companyName: data.user?.user_metadata?.companyName
      },
      session: data.session
    });
  } catch (err) {
    console.error('Erro em register:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao cadastrar usuário'
    });
  }
};

/**
 * Autentica o usuário e retorna o Token JWT e as informações do Tenant.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Os campos "email" e "password" são obrigatórios.'
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas ou usuário não confirmado.',
        details: error.message
      });
    }

    const tenantId = data.user?.user_metadata?.tenantId || data.user?.id;

    return res.status(200).json({
      success: true,
      message: 'Login realizado com sucesso!',
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        tenantId: tenantId,
        companyName: data.user.user_metadata?.companyName || tenantId
      }
    });
  } catch (err) {
    console.error('Erro em login:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao realizar login'
    });
  }
};

/**
 * Retorna os dados do usuário autenticado a partir do token.
 */
const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user
  });
};

module.exports = {
  register,
  login,
  getMe
};
