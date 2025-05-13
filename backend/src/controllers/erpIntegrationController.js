const ahoraFreewareAdapter = require('../services/erp/ahoraFreewareAdapter');
const multer = require('multer');
const upload = multer();

/**
 * @desc    Exportar pedidos para ERP
 * @route   POST /api/integrations/erp/export-orders
 * @access  Private
 */
const exportOrdersForERP = async (req, res) => {
  try {
    const {
      type = 'cliente',
      status = 'Pendiente de envío',
      days = 7,
      markedForShipment = false,
    } = req.body;

    // Validar que days sea un número entre 1 y 30
    const daysNum = parseInt(days, 10);
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 30) {
      return res.status(400).json({ message: 'El número de días debe estar entre 1 y 30' });
    }

    // Iniciar la exportación
    const result = await ahoraFreewareAdapter.exportOrders({
      type,
      status,
      days: daysNum,
      markedForShipment: markedForShipment === true || markedForShipment === 'true',
    });

    res.json(result);
  } catch (error) {
    console.error('Error exportando pedidos para ERP:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Importar actualizaciones de pedidos desde ERP
 * @route   POST /api/integrations/erp/import-updates
 * @access  Private
 */
const importOrderUpdates = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se ha subido ningún archivo' });
    }

    // Iniciar la importación
    const result = await ahoraFreewareAdapter.importOrderUpdates(req.file);

    res.json(result);
  } catch (error) {
    console.error('Error importando actualizaciones de pedidos:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

// Middleware para manejar la subida de archivos
const uploadMiddleware = upload.single('file');

module.exports = {
  exportOrdersForERP,
  importOrderUpdates,
  uploadMiddleware,
};
