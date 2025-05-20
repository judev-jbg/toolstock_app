const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/userModel');
const crypto = require('crypto');
const emailService = require('../utils/emailService');

/**
 * Generar token JWT
 * @param {string} id - ID de usuario
 * @returns {string} Token JWT
 */
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

/**
 * @desc    Registrar un nuevo usuario y enviar correo de activación
 * @route   POST /api/auth/register
 * @access  Private/Admin
 */
const registerUser = async (req, res) => {
  try {
    // Validar datos de entrada
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, role } = req.body;

    // Verificar si el usuario ya existe
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'El usuario ya existe' });
    }

    // Verificar permisos para crear roles
    if (role === 'root' && req.user.role !== 'root') {
      return res.status(403).json({
        message: 'No tienes permisos para crear super administradores',
      });
    }

    // Generar contraseña temporal aleatoria
    const tempPassword = crypto.randomBytes(10).toString('hex');

    // Crear usuario
    const user = await User.create({
      name,
      email,
      password: tempPassword,
      role: role || 'guest',
    });

    if (!user) {
      return res.status(400).json({ message: 'Error al crear usuario' });
    }

    // Generar token de activación
    const activationToken = crypto.randomBytes(32).toString('hex');

    // Guardar token hasheado y fecha de expiración
    user.resetPasswordToken = crypto.createHash('sha256').update(activationToken).digest('hex');

    // Expiración: 24 horas
    user.resetPasswordExpire = Date.now() + 86400000;

    await user.save();

    // Crear URL de activación
    const activationUrl = `${process.env.FRONTEND_URL}/activate-account/${activationToken}`;

    // Enviar correo
    try {
      await emailService.sendEmail({
        to: user.email,
        subject: 'Activación de cuenta en Toolstock',
        html: emailService.getNewAccountTemplate(user.name, activationUrl),
      });

      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        message: 'Usuario creado. Se ha enviado un correo de activación.',
      });
    } catch (emailError) {
      console.error('Error al enviar correo:', emailError);

      // No eliminamos el usuario, pero notificamos el error
      return res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        warning: 'Usuario creado, pero hubo un error al enviar el correo de activación.',
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};
/**
 * @desc    Autenticar usuario y obtener token
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = async (req, res) => {
  try {
    // Validar datos de entrada
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Buscar usuario por email
    const user = await User.findOne({ email }).select('+password');

    // Verificar usuario
    if (!user) {
      return res.status(401).json({ message: 'El usuario no esta registrado' });
    }

    // Verificar usuario y contraseña
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Correo o contraseña incorrectos' });
    }

    // Verificar si el usuario está activo
    if (!user.active) {
      return res.status(401).json({ message: 'Usuario desactivado' });
    }

    // Autenticación exitosa
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Obtener perfil de usuario
 * @route   GET /api/auth/profile
 * @access  Private
 */
const getUserProfile = async (req, res) => {
  try {
    // req.user viene del middleware de autenticación
    const user = await User.findById(req.user._id);

    if (user) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      });
    } else {
      res.status(404).json({ message: 'Usuario no encontrado' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Actualizar perfil de usuario
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Si se intenta cambiar la contraseña, verificar la contraseña actual
    if (req.body.password && req.body.currentPassword) {
      const isMatch = await user.matchPassword(req.body.currentPassword);
      if (!isMatch) {
        return res.status(401).json({ message: 'Contraseña actual incorrecta' });
      }
    }

    // Actualizar campos básicos
    user.name = req.body.name || user.name;

    // No permitir cambiar el email para evitar problemas de autenticación
    // user.email = req.body.email || user.email;

    // Actualizar avatar si viene en la petición
    if (req.body.avatar) {
      user.avatar = req.body.avatar;
    }

    // Actualizar contraseña si viene en la petición
    if (req.body.password) {
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      avatar: updatedUser.avatar,
      token: generateToken(updatedUser._id),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Obtener todos los usuarios
 * @route   GET /api/auth/users
 * @access  Private/Admin
 */
const getUsers = async (req, res) => {
  try {
    // Definir filtros
    const filter = {};

    // Filtro por estado activo
    if (req.query.status === 'active') {
      filter.active = true;
    } else if (req.query.status === 'inactive') {
      filter.active = false;
    }

    // Filtro por búsqueda (nombre o email)
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    // Ejecutar consulta
    const users = await User.find(filter).select('-password');

    res.json({
      count: users.length,
      users,
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Obtener usuario por ID
 * @route   GET /api/auth/users/:id
 * @access  Private/Admin
 */
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Eliminar usuario
 * @route   DELETE /api/auth/users/:id
 * @access  Private/Admin
 */
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (user) {
      // No permitir eliminar usuarios root desde la API
      if (user.role === 'root') {
        return res.status(400).json({ message: 'No se puede eliminar un usuario root' });
      }

      await user.remove();
      res.json({ message: 'Usuario eliminado' });
    } else {
      res.status(404).json({ message: 'Usuario no encontrado' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Actualizar usuario
 * @route   PUT /api/auth/users/:id
 * @access  Private/Admin
 */
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Verificar permisos para cambiar roles
    if (req.body.role) {
      // Solo root puede asignar rol root
      if (req.body.role === 'root' && req.user.role !== 'root') {
        return res.status(403).json({
          message: 'No tienes permisos para asignar rol de super administrador',
        });
      }

      // Verificar si el usuario a actualizar es root
      if (user.role === 'root' && req.user.role !== 'root') {
        return res.status(403).json({
          message: 'No tienes permisos para modificar un super administrador',
        });
      }
    }

    // Actualizar campos
    user.name = req.body.name || user.name;

    // Solo actualizar rol si se proporciona
    if (req.body.role) {
      user.role = req.body.role;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      active: updatedUser.active,
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Activar/Desactivar usuario
 * @route   PATCH /api/auth/users/:id/toggle-status
 * @access  Private/Admin
 */
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Verificar si el usuario a actualizar es root
    if (user.role === 'root' && req.user.role !== 'root') {
      return res.status(403).json({
        message: 'No tienes permisos para modificar un super administrador',
      });
    }

    // Cambiar estado
    user.active = !user.active;

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      active: updatedUser.active,
      message: `Usuario ${updatedUser.active ? 'activado' : 'desactivado'} correctamente`,
    });
  } catch (error) {
    console.error('Error al cambiar estado de usuario:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Generar token de reseteo de contraseña
 * @route   POST /api/auth/users/:id/reset-password
 * @access  Private/Root
 */
const generateResetToken = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Generar token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Guardar token hasheado y fecha de expiración
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Expiración: 1 hora
    user.resetPasswordExpire = Date.now() + 3600000;

    await user.save();

    // Crear URL de reseteo
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Enviar correo
    try {
      await emailService.sendEmail({
        to: user.email,
        subject: 'Restablecimiento de Contraseña',
        html: emailService.getPasswordResetTemplate(user.name, resetUrl),
      });

      res.json({ message: 'Correo enviado correctamente' });
    } catch (emailError) {
      console.error('Error al enviar correo:', emailError);

      // Eliminar token si hay error
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      return res.status(500).json({ message: 'Error al enviar correo de reseteo' });
    }
  } catch (error) {
    console.error('Error al generar token:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Verificar token de reseteo y resetear contraseña
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
const resetPassword = async (req, res) => {
  try {
    // Obtener token hasheado
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    // Buscar usuario con token válido
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Token inválido o expirado' });
    }

    // Validar contraseña
    if (!req.body.password || req.body.password.length < 6) {
      return res.status(400).json({
        message: 'La contraseña debe tener al menos 6 caracteres',
      });
    }

    // Establecer nueva contraseña
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error al resetear contraseña:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Verificar token de reseteo
 * @route   GET /api/auth/verify-token/:token
 * @access  Public
 */
const verifyResetToken = async (req, res) => {
  try {
    // Obtener token hasheado
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    // Buscar usuario con token válido
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ valid: false });
    }

    res.json({
      valid: true,
      name: user.name,
      email: user.email,
    });
  } catch (error) {
    console.error('Error al verificar token:', error);
    res.status(500).json({ valid: false });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserById,
  getUserProfile,
  updateUserProfile,
  resetPassword,
  verifyResetToken,
  toggleUserStatus,
  updateUser,
  getUsers,
  deleteUser,
  generateResetToken,
};
