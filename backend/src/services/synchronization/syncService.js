// backend/src/services/synchronization/syncService.js (actualización)

const amazonOrderService = require('../amazon/orderService');
const prestashopOrderService = require('../prestashop/orderService');
const Order = require('../../models/orderModel');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('syncService');

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
    const { days = 7, onlyNew = true, retryCount = 0 } = options;

    logger.info(
      `Iniciando sincronización Amazon → PrestaShop (días: ${days}, soloNuevos: ${onlyNew})`
    );

    try {
      // Obtener pedidos de Amazon
      const amazonResult = await amazonOrderService.syncRecentOrders(days);

      // Estadísticas
      const stats = {
        total: amazonResult.stats.created + amazonResult.stats.updated,
        synced: 0,
        errors: 0,
        skipped: 0,
        errorDetails: [],
      };

      // Buscar pedidos de Amazon que necesiten sincronizarse con PrestaShop
      const filter = {
        source: 'amazon',
        orderStatus: { $nin: ['Cancelado'] }, // No sincronizar pedidos cancelados
      };

      // Si solo queremos sincronizar nuevos, filtrar por los que no tienen ID de PrestaShop
      if (onlyNew) {
        filter.prestashopOrderId = { $exists: false };
      }

      // Si queremos sincronizar por fecha, añadir filtro de fecha
      if (days) {
        filter.createdAt = {
          $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        };
      }

      const ordersToSync = await Order.find(filter);

      logger.info(`Se encontraron ${ordersToSync.length} pedidos para sincronizar`);

      // Sincronizar cada pedido
      for (const order of ordersToSync) {
        try {
          logger.info(`Sincronizando pedido ${order.amazonOrderId}`);

          // Verificar si el pedido ya existe en PrestaShop (por número de referencia)
          let existingPsOrder = null;
          if (!onlyNew || !order.prestashopOrderId) {
            existingPsOrder = await prestashopOrderService.findOrderByReference(
              order.amazonOrderId
            );
          }

          if (existingPsOrder) {
            // El pedido ya existe en PrestaShop, actualizar
            logger.info(
              `Pedido ${order.amazonOrderId} ya existe en PrestaShop (ID: ${existingPsOrder.id}), actualizando`
            );

            // Actualizar estado y detalles
            await prestashopOrderService.updateOrder(existingPsOrder.id, order);

            // Actualizar nuestro registro con el ID de PrestaShop
            if (!order.prestashopOrderId) {
              order.prestashopOrderId = existingPsOrder.id;
              await order.save();
            }

            stats.synced++;
          } else if (!order.prestashopOrderId) {
            // Crear el pedido en PrestaShop
            const prestashopOrder = await prestashopOrderService.createOrder(order);

            if (prestashopOrder && prestashopOrder.order && prestashopOrder.order.id) {
              // Actualizar nuestro pedido con el ID de PrestaShop
              order.prestashopOrderId = prestashopOrder.order.id;
              await order.save();

              stats.synced++;
              logger.info(
                `Pedido ${order.amazonOrderId} creado en PrestaShop (ID: ${prestashopOrder.order.id})`
              );
            } else {
              throw new Error('No se pudo crear el pedido en PrestaShop');
            }
          } else {
            // El pedido ya tiene ID de PrestaShop pero no se encontró en la API
            // Podría ser un caso de desincronización
            logger.warn(
              `Pedido ${order.amazonOrderId} tiene ID de PrestaShop (${order.prestashopOrderId}) pero no se encontró en la API`
            );
            stats.skipped++;
          }
        } catch (error) {
          const errorMsg = `Error sincronizando pedido ${order.amazonOrderId}: ${error.message}`;
          logger.error(errorMsg);
          stats.errorDetails.push({
            orderId: order.amazonOrderId,
            error: error.message,
          });
          stats.errors++;
        }
      }

      // Calcular pedidos omitidos
      stats.skipped = ordersToSync.length - stats.synced - stats.errors;

      logger.info(
        `Sincronización Amazon → PrestaShop completada. Total: ${stats.total}, Sincronizados: ${stats.synced}, Errores: ${stats.errors}, Omitidos: ${stats.skipped}`
      );

      return {
        message: 'Amazon to PrestaShop synchronization completed',
        stats,
      };
    } catch (error) {
      logger.error(`Error en sincronización Amazon → PrestaShop: ${error.message}`);

      // Implementar reintentos si es necesario
      if (retryCount < 3) {
        logger.info(`Reintentando sincronización (intento ${retryCount + 1}/3)`);
        return this.syncAmazonToPrestaShop({
          ...options,
          retryCount: retryCount + 1,
        });
      }

      throw error;
    }
  }

  /**
   * Sincroniza estados de pedidos entre plataformas
   * @param {Object} options - Opciones de sincronización
   * @returns {Promise<Object>} Resultado de la sincronización
   */
  async syncOrderStatuses(options = {}) {
    const { days = 7 } = options;

    logger.info(`Iniciando sincronización de estados (días: ${days})`);

    try {
      // Buscar pedidos que estén en ambas plataformas
      const filter = {
        prestashopOrderId: { $exists: true, $ne: null },
        amazonOrderId: { $exists: true, $ne: null },
        updatedAt: {
          $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        },
      };

      const orders = await Order.find(filter);

      logger.info(`Se encontraron ${orders.length} pedidos para sincronizar estados`);

      const stats = {
        total: orders.length,
        updated: 0,
        errors: 0,
        skipped: 0,
        errorDetails: [],
      };

      // Estados que podemos sincronizar (mapeo entre plataformas)
      const statusMapping = {
        Enviado: 'SHIPPED',
        Entregado: 'DELIVERED',
        Cancelado: 'CANCELED',
      };

      for (const order of orders) {
        try {
          // Obtener los datos actuales del pedido en PrestaShop
          const psOrder = await prestashopOrderService.getOrderById(order.prestashopOrderId);

          if (!psOrder) {
            logger.warn(`Pedido ${order.prestashopOrderId} no encontrado en PrestaShop`);
            stats.skipped++;
            continue;
          }

          // Verificar si hay cambios que sincronizar
          if (order.orderStatus === 'Enviado' && order.expeditionTraking) {
            // Si el pedido está enviado y tiene número de seguimiento, actualizar en Amazon
            if (order.source === 'amazon') {
              logger.info(
                `Actualizando estado de envío en Amazon para pedido ${order.amazonOrderId}`
              );
              await amazonOrderService.updateOrderShipment(
                order.amazonOrderId,
                order.expeditionTraking
              );
              stats.updated++;
            }

            // Actualizar también en PrestaShop si es necesario
            const psOrderStatus = prestashopOrderService.mapOrderStatus(
              psOrder.order.current_state
            );
            if (psOrderStatus !== 'Enviado') {
              logger.info(
                `Actualizando estado en PrestaShop para pedido ${order.prestashopOrderId}`
              );
              await prestashopOrderService.updateOrderStatus(
                order.prestashopOrderId,
                'Enviado',
                order.expeditionTraking
              );
              stats.updated++;
            }
          }
        } catch (error) {
          const errorMsg = `Error sincronizando estado del pedido ${order._id}: ${error.message}`;
          logger.error(errorMsg);
          stats.errorDetails.push({
            orderId: order._id,
            error: error.message,
          });
          stats.errors++;
        }
      }

      logger.info(
        `Sincronización de estados completada. Total: ${stats.total}, Actualizados: ${stats.updated}, Errores: ${stats.errors}, Omitidos: ${stats.skipped}`
      );

      return {
        message: 'Order status synchronization completed',
        stats,
      };
    } catch (error) {
      logger.error(`Error en sincronización de estados: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ejecuta una sincronización completa entre todas las plataformas
   * @returns {Promise<Object>} Resultado de la sincronización
   */
  async fullSync() {
    try {
      logger.info('Iniciando sincronización completa');

      // Paso 1: Sincronizar pedidos de Amazon
      const amazonResult = await amazonOrderService.syncRecentOrders(7);

      // Paso 2: Sincronizar pedidos de PrestaShop
      const prestashopResult = await prestashopOrderService.syncRecentOrders(7);

      // Paso 3: Sincronizar pedidos de Amazon a PrestaShop
      const amazonToPrestaShopResult = await this.syncAmazonToPrestaShop({ days: 7 });

      // Paso 4: Sincronizar estados de pedidos entre plataformas
      const statusSyncResult = await this.syncOrderStatuses({ days: 7 });

      logger.info('Sincronización completa finalizada');

      return {
        message: 'Full synchronization completed',
        amazon: amazonResult.stats,
        prestashop: prestashopResult.stats,
        amazonToPrestashop: amazonToPrestaShopResult.stats,
        statusSync: statusSyncResult.stats,
      };
    } catch (error) {
      logger.error(`Error en sincronización completa: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new SynchronizationService();
