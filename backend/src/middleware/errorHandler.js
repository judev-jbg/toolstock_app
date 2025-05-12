/**
 * Middleware para manejo centralizado de errores
 * @param {Error} err - Error capturado
 * @param {Request} req - Request de Express
 * @param {Response} res - Response de Express
 * @param {NextFunction} next - Función next de Express
 */
const errorHandler = (err, req, res, next) => {
  // Por defecto, estado 500 (error del servidor)
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Si es un error de Mongoose de ID inválido
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Recurso no encontrado';
  }

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
  });
};

module.exports = errorHandler;
