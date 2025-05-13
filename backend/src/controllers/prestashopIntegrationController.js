const prestashopOrderService = require('../services/prestashop/orderService');
const syncService = require('../services/synchronization/syncService');

/**
 * @desc    Sincronizar pedidos recientes de PrestaShop
 * @route   POST /api/integrations/prestashop/sync-orders
 * @access  Private/Admin
 */
const syncPrestashopOrders = async (req, res) => {
  try {
    const { days = 7 } = req.body;

    // Validar que days sea un número entre 1 y 30
    const daysNum = parseInt(days, 10);
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 30) {
      return res.status(400).json({ message: 'El número de días debe estar entre 1 y 30' });
    }

    // Iniciar la sincronización
    const result = await prestashopOrderService.syncRecentOrders(daysNum);

    res.json(result);
  } catch (error) {
    console.error('Error sincronizando pedidos de PrestaShop:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Sincronizar pedidos de Amazon a PrestaShop
 * @route   POST /api/integrations/prestashop/sync-from-amazon
 * @access  Private/Admin
 */
const syncFromAmazon = async (req, res) => {
  try {
    const { days = 7, onlyNew = true } = req.body;

    // Validar que days sea un número entre 1 y 30
    const daysNum = parseInt(days, 10);
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 30) {
      return res.status(400).json({ message: 'El número de días debe estar entre 1 y 30' });
    }

    // Iniciar la sincronización
    const result = await syncService.syncAmazonToPrestaShop({
      days: daysNum,
      onlyNew: onlyNew === true || onlyNew === 'true',
    });

    res.json(result);
  } catch (error) {
    console.error('Error sincronizando pedidos de Amazon a PrestaShop:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Ejecutar una sincronización completa entre todas las plataformas
 * @route   POST /api/integrations/sync/full
 * @access  Private/Admin
 */
const fullSync = async (req, res) => {
  try {
    // Iniciar la sincronización completa
    const result = await syncService.fullSync();

    res.json(result);
  } catch (error) {
    console.error('Error en la sincronización completa:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

module.exports = {
  syncPrestashopOrders,
  syncFromAmazon,
  fullSync,
};
