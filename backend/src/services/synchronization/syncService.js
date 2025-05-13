const amazonOrderService = require('../amazon/orderService');
const prestashopOrderService = require('../prestashop/orderService');
const Order = require('../../models/orderModel');

/**
 * Servicio para sincronización entre plataformas
 */
class SynchronizationService {
  /**
   * Sincroniza pedidos de Amazon a PrestaShop
   * @param {Object} options - Opciones de sincronización
   * @returns {Promise<Object>} Resultado de la sincronización
   */
  async syncAmazonToPrestaShop(options = {}) {
    const { days = 7, onlyNew = true } = options;

    try {
      // Obtener pedidos de Amazon
      const amazonResult = await amazonOrderService.syncRecentOrders(days);

      // Estadísticas
      const stats = {
        total: amazonResult.stats.created + amazonResult.stats.updated,
        synced: 0,
        errors: 0,
        skipped: 0,
      };

      // Buscar pedidos de Amazon que necesiten sincronizarse con PrestaShop
      const filter = {
        source: 'amazon',
        prestashopOrderId: { $exists: false }, // No tienen ID de PrestaShop aún
      };

      // Si solo queremos sincronizar nuevos, filtrar por los creados recientemente
      if (onlyNew) {
        filter.createdAt = {
          $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        };
      }

      const ordersToSync = await Order.find(filter);

      // Sincronizar cada pedido
      for (const order of ordersToSync) {
        try {
          // Crear el pedido en PrestaShop
          const prestashopOrder = await prestashopOrderService.createOrder(order);

          if (prestashopOrder && prestashopOrder.order && prestashopOrder.order.id) {
            // Actualizar nuestro pedido con el ID de PrestaShop
            order.prestashopOrderId = prestashopOrder.order.id;
            await order.save();

            stats.synced++;
          } else {
            stats.errors++;
          }
        } catch (error) {
          console.error(`Error syncing order ${order.amazonOrderId} to PrestaShop:`, error);
          stats.errors++;
        }
      }

      // Calcular pedidos omitidos
      stats.skipped = stats.total - stats.synced - stats.errors;

      return {
        message: 'Amazon to PrestaShop synchronization completed',
        stats,
      };
    } catch (error) {
      console.error('Error in Amazon to PrestaShop synchronization:', error);
      throw error;
    }
  }

  /**
   * Sincroniza pedidos de PrestaShop a nuestra base de datos
   * @param {Object} options - Opciones de sincronización
   * @returns {Promise<Object>} Resultado de la sincronización
   */
  async syncPrestaShopOrders(options = {}) {
    const { days = 7 } = options;

    try {
      // Sincronizar pedidos de PrestaShop
      const result = await prestashopOrderService.syncRecentOrders(days);

      return {
        message: 'PrestaShop orders synchronized successfully',
        stats: result.stats,
      };
    } catch (error) {
      console.error('Error synchronizing PrestaShop orders:', error);
      throw error;
    }
  }

  /**
   * Ejecuta una sincronización completa entre todas las plataformas
   * @returns {Promise<Object>} Resultado de la sincronización
   */
  async fullSync() {
    try {
      // Paso 1: Sincronizar pedidos de Amazon
      const amazonResult = await amazonOrderService.syncRecentOrders(7);

      // Paso 2: Sincronizar pedidos de PrestaShop
      const prestashopResult = await prestashopOrderService.syncRecentOrders(7);

      // Paso 3: Sincronizar pedidos de Amazon a PrestaShop
      const amazonToPrestaShopResult = await this.syncAmazonToPrestaShop({ days: 7 });

      return {
        message: 'Full synchronization completed',
        amazon: amazonResult.stats,
        prestashop: prestashopResult.stats,
        amazonToPrestashop: amazonToPrestaShopResult.stats,
      };
    } catch (error) {
      console.error('Error in full synchronization:', error);
      throw error;
    }
  }
}

module.exports = new SynchronizationService();
