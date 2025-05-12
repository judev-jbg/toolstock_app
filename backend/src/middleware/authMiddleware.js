const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

/**
 * Middleware para proteger rutas, verifica el token JWT
 * @param {Request} req - Request de Express
 * @param {Response} res - Response de Express
 * @param {NextFunction} next - Función next de Express
 */
const protect = async (req, res, next) => {
  let token;

  // Verificar si hay token en headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Extraer token del header
      token = req.headers.authorization.split(' ')[1];

      // Verificar token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Obtener usuario y añadirlo a request (sin password)
      req.user = await User.findById(decoded.id).select('-password');

      next();
    } catch (error) {
      console.error(error);
      res.status(401);
      throw new Error('No autorizado, token inválido');
    }
  }

  if (!token) {
    res.status(401);
    throw new Error('No autorizado, no hay token');
  }
};

/**
 * Middleware para verificar roles de usuario
 * @param  {...String} roles - Roles permitidos
 * @returns {Function} Express middleware
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403);
      throw new Error('No tiene permisos para realizar esta acción');
    }
    next();
  };
};

module.exports = { protect, authorize };
