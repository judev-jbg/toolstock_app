const express = require('express');
const { check } = require('express-validator');
const fs = require('fs');
const path = require('path');
const User = require('../models/userModel');
const uploadDir = path.join(__dirname, '../../uploads/avatars');
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  getUsers,
  deleteUser,
  getUserById,
  updateUser,
  toggleUserStatus,
  generateResetToken,
  resetPassword,
  verifyResetToken,
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');
const router = express.Router();

// Rutas públicas
router.post(
  '/login',
  [
    check('email', 'Por favor incluya un email válido').isEmail(),
    check('password', 'La contraseña es obligatoria').not().isEmpty(),
  ],
  loginUser
);

router.route('/reset-password/:token').post(resetPassword);

router.post('/upload-avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se subió ningún archivo' });
    }

    // Actualizar el avatar del usuario
    const user = await User.findById(req.user._id);

    // Si ya tenía avatar, eliminar el archivo anterior
    if (user.avatar && user.avatar !== '' && fs.existsSync(path.join(uploadDir, user.avatar))) {
      fs.unlinkSync(path.join(uploadDir, user.avatar));
    }

    // Guardar solo el nombre del archivo
    user.avatar = req.file.filename;
    await user.save();

    res.json({
      message: 'Avatar actualizado correctamente',
      avatar: user.avatar,
    });
  } catch (error) {
    console.error('Error al subir avatar:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Rutas privadas (requieren autenticación)
router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);

// Rutas de administración (requieren rol admin o root)
router.route('/users').get(protect, authorize('admin', 'root'), getUsers);

router
  .route('/users/:id')
  .get(protect, authorize('admin', 'root'), getUserById)
  .put(protect, authorize('admin', 'root'), updateUser)
  .delete(protect, authorize('admin', 'root'), deleteUser);

router
  .route('/users/:id/toggle-status')
  .patch(protect, authorize('admin', 'root'), toggleUserStatus);

router.route('/users/:id/reset-password').post(protect, authorize('root'), generateResetToken);

router.route('/verify-token/:token').get(verifyResetToken);

router.post(
  '/register',
  [
    protect,
    authorize('admin', 'root'),
    check('name', 'El nombre es obligatorio').not().isEmpty(),
    check('email', 'Por favor incluya un email válido').isEmail(),
  ],
  registerUser
);

module.exports = router;
