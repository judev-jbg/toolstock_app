// In middleware/validation.js

const validateShipmentData = (req, res, next) => {
  const { destinatario, direccion, cp, poblacion } = req.body;

  const errors = [];

  if (!destinatario) errors.push('Destinatario is required');
  if (!direccion) errors.push('Direccion is required');
  if (!cp) errors.push('CP is required');
  if (!poblacion) errors.push('Poblacion is required');

  if (errors.length > 0) {
    return res.status(400).json({
      message: 'Missing required shipment data',
      errors,
    });
  }

  next();
};

const checkValidationResult = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

module.exports = { validateShipmentData, checkValidationResult };
