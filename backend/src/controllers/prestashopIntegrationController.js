// backend/src/controllers/prestashopIntegrationController.js (actualización)

const prestashopOrderService = require('../services/prestashop/orderService');
const syncService = require('../services/synchronization/syncService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('prestashopIntegrationController');

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

    logger.info(`Solicitud de sincronización de pedidos PrestaShop: ${daysNum} días`);

    // Iniciar la sincronización
    const result = await prestashopOrderService.syncRecentOrders(daysNum);

    logger.info(
      `Sincronización PrestaShop completada: ${result.stats.created} creados, ${result.stats.updated} actualizados`
    );

    res.json(result);
  } catch (error) {
    logger.error(`Error sincronizando pedidos de PrestaShop: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
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

    logger.info(
      `Solicitud de sincronización Amazon → PrestaShop: ${daysNum} días, soloNuevos: ${onlyNew}`
    );

    // Iniciar la sincronización
    const result = await syncService.syncAmazonToPrestaShop({
      days: daysNum,
      onlyNew: onlyNew === true || onlyNew === 'true',
    });

    res.json(result);
  } catch (error) {
    logger.error(`Error sincronizando pedidos de Amazon a PrestaShop: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

/**
 * @desc    Sincronizar estados de pedidos entre plataformas
 * @route   POST /api/integrations/prestashop/sync-statuses
 * @access  Private/Admin
 */
const syncOrderStatuses = async (req, res) => {
  try {
    const { days = 7 } = req.body;

    // Validar que days sea un número entre 1 y 30
    const daysNum = parseInt(days, 10);
    if (isNaN(daysNum) || daysNum < 1 || daysNum > 30) {
      return res.status(400).json({ message: 'El número de días debe estar entre 1 y 30' });
    }

    logger.info(`Solicitud de sincronización de estados: ${daysNum} días`);

    // Iniciar la sincronización
    const result = await syncService.syncOrderStatuses({
      days: daysNum,
    });

    res.json(result);
  } catch (error) {
    logger.error(`Error sincronizando estados de pedidos: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

/**
 * @desc    Ejecutar una sincronización completa entre todas las plataformas
 * @route   POST /api/integrations/sync/full
 * @access  Private/Admin
 */
const fullSync = async (req, res) => {
  try {
    logger.info('Solicitud de sincronización completa');

    // Iniciar la sincronización completa
    const result = await syncService.fullSync();

    res.json(result);
  } catch (error) {
    logger.error(`Error en la sincronización completa: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

module.exports = {
  syncPrestashopOrders,
  syncFromAmazon,
  syncOrderStatuses,
  fullSync,
};
