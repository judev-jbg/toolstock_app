const schedule = require('node-schedule');
const amazonOrderService = require('../amazon/orderService');

/**
 * Servicio para programar sincronizaciones automáticas
 */
class OrderSyncScheduler {
  /**
   * Inicializar programaciones
   */
  init() {
    // Sincronizar pedidos cada 2 horas
    this.orderSyncJob = schedule.scheduleJob('0 */2 * * *', async () => {
      console.log('Executing scheduled order synchronization');
      try {
        // Sincronizar pedidos de los últimos 3 días
        await amazonOrderService.syncRecentOrders(3);
        console.log('Scheduled order synchronization completed successfully');
      } catch (error) {
        console.error('Error in scheduled order synchronization:', error);
      }
    });

    console.log('Order synchronization scheduler initialized');
  }

  /**
   * Detener todas las programaciones
   */
  stop() {
    if (this.orderSyncJob) {
      this.orderSyncJob.cancel();
    }
    console.log('Order synchronization scheduler stopped');
  }
}

module.exports = new OrderSyncScheduler();
