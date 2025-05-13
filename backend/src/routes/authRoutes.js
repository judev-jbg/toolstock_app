const express = require('express');
const { check } = require('express-validator');
const {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  getUsers,
  deleteUser,
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');

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

// Rutas privadas (requieren autenticación)
router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);

// Rutas de administración (requieren rol admin o root)
router.route('/users').get(protect, authorize('admin', 'root'), getUsers);

router.route('/users/:id').delete(protect, authorize('admin', 'root'), deleteUser);

router.post(
  '/register',
  [
    protect,
    authorize('admin', 'root'),
    check('name', 'El nombre es obligatorio').not().isEmpty(),
    check('email', 'Por favor incluya un email válido').isEmail(),
    check('password', 'La contraseña debe tener 6 o más caracteres').isLength({ min: 6 }),
  ],
  registerUser
);

module.exports = router;
