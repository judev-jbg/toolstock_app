const amazonOrderService = require('../services/amazon/orderService');
const amazonReportService = require('../services/amazon/reportService');
const multer = require('multer');
const upload = multer();

/**
 * @desc    Sincronizar pedidos recientes de Amazon
 * @route   POST /api/integrations/amazon/sync-orders
 * @access  Private/Admin
 */
const syncAmazonOrders = async (req, res) => {
  try {
    const { days = 7 } = req.body;

    // Validar que days sea un número entre 1 y 30
    const daysNum = parseInt(days, 10);
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 30) {
      return res.status(400).json({ message: 'El número de días debe estar entre 1 y 30' });
    }

    // Iniciar la sincronización
    const result = await amazonOrderService.syncRecentOrders(daysNum);

    res.json(result);
  } catch (error) {
    console.error('Error sincronizando pedidos de Amazon:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Actualizar estado de pedido en Amazon
 * @route   POST /api/integrations/amazon/update-shipment
 * @access  Private
 */
const updateAmazonOrderShipment = async (req, res) => {
  try {
    const { amazonOrderId, expeditionTraking } = req.body;

    if (!amazonOrderId || !expeditionTraking) {
      return res.status(400).json({
        message: 'Se requieren amazonOrderId y expeditionTraking',
      });
    }

    const result = await amazonOrderService.updateOrderShipment(amazonOrderId, expeditionTraking);

    res.json(result);
  } catch (error) {
    console.error('Error actualizando estado de pedido en Amazon:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Procesar reporte de pedidos de Amazon
 * @route   POST /api/integrations/amazon/upload-report
 * @access  Private
 */
const uploadOrderReport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se ha subido ningún archivo' });
    }

    const result = await amazonReportService.uploadOrderReport(req.file);

    res.json(result);
  } catch (error) {
    console.error('Error procesando reporte de pedidos:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

// Middleware para manejar la subida de archivos
const uploadMiddleware = upload.single('report');

module.exports = {
  syncAmazonOrders,
  updateAmazonOrderShipment,
  uploadOrderReport,
  uploadMiddleware,
};
