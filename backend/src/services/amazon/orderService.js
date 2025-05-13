const spApiClient = require('./spApiClient');
const Order = require('../../models/orderModel');
const moment = require('moment');

/**
 * Servicio para gestionar pedidos de Amazon
 */
class AmazonOrderService {
  /**
   * Obtiene pedidos de Amazon usando el API de Selling Partner
   * @param {string} startDate - Fecha de inicio (ISO format)
   * @param {string} endDate - Fecha de fin (ISO format)
   * @param {string} orderStatus - Estado de los pedidos
   * @returns {Promise<Array>} Lista de pedidos de Amazon
   */
  async getOrders(startDate, endDate, orderStatus = 'UNSHIPPED') {
    try {
      // Si no se especifican fechas, usar por defecto los últimos 30 días
      if (!startDate) {
        startDate = moment().subtract(30, 'days').toISOString();
      }
      if (!endDate) {
        endDate = moment().toISOString();
      }

      // Mapeo de estados para la API de Amazon
      const statusMapping = {
        UNSHIPPED: 'Pendiente de envío',
        SHIPPED: 'Enviado',
        CANCELED: 'Cancelado',
        PENDING: 'Pendiente disponibilidad',
      };

      // Opciones para la consulta
      const params = {
        MarketplaceIds: [process.env.AMAZON_MARKETPLACE_ID || 'A1RKKUPIHCS9HS'], // Marketplace ID para España
        CreatedAfter: startDate,
        CreatedBefore: endDate,
        OrderStatuses: [orderStatus],
      };

      // Ejecutar la consulta con reintentos
      const response = await spApiClient.executeWithRetry(async (client) => {
        return await client.callAPI({
          operation: 'getOrders',
          endpoint: 'orders',
          query: params,
        });
      });

      // Procesar y transformar los datos
      const orders = response.Orders || [];

      // Mapear los datos a nuestro modelo
      const transformedOrders = orders.map((order) => ({
        amazonOrderId: order.AmazonOrderId,
        source: 'amazon',
        orderStatus: statusMapping[order.OrderStatus] || 'Pendiente de envío',
        buyerEmail: order.BuyerEmail,
        latestShipDate: order.LatestShipDate,
        latestDeliveryDate: order.LatestDeliveryDate,
        purchaseDate: order.PurchaseDate,
        buyerName: order.BuyerInfo?.BuyerName || '',
        buyerPhoneNumber: order.BuyerInfo?.Phone || '',

        // Los datos de envío detallados requerirán una llamada adicional
        // y algunos datos como direcciones están restringidos por PII

        salesChannel: order.SalesChannel,
        isBusinessOrder: order.IsBusinessOrder || false,
        purchaseOrderNumber: order.PurchaseOrderNumber,

        // Datos adicionales que requerirán completarse con el Order Report
        buyerCompanyName: order.BuyerInfo?.CompanyName,
        buyerTaxRegistrationId: order.BuyerInfo?.TaxInfo?.TaxRegistrationId,
        buyerTaxRegistrationCountry: order.BuyerInfo?.TaxInfo?.TaxRegistrationCountry,

        isAmazonInvoiced: order.IsAmazonInvoiced || false,
        isBuyerRequestedCancellation: order.IsBuyerRequestedCancellation || false,
      }));

      return transformedOrders;
    } catch (error) {
      console.error('Error fetching Amazon orders:', error);
      throw error;
    }
  }

  /**
   * Obtiene detalles de los items de un pedido
   * @param {string} amazonOrderId - ID del pedido de Amazon
   * @returns {Promise<Array>} Lista de items del pedido
   */
  async getOrderItems(amazonOrderId) {
    try {
      const response = await spApiClient.executeWithRetry(async (client) => {
        return await client.callAPI({
          operation: 'getOrderItems',
          endpoint: 'orders',
          path: {
            orderId: amazonOrderId,
          },
        });
      });

      const orderItems = response.OrderItems || [];

      // Mapear los items a nuestro modelo
      const transformedItems = orderItems.map((item) => ({
        orderItemId: item.OrderItemId,
        sku: item.SellerSKU,
        productName: item.Title,
        quantityPurchased: parseInt(item.QuantityOrdered, 10),
        itemPrice: parseFloat(item.ItemPrice?.Amount || 0),
        itemTax: parseFloat(item.ItemTax?.Amount || 0),
        shippingPrice: parseFloat(item.ShippingPrice?.Amount || 0),
        shippingTax: parseFloat(item.ShippingTax?.Amount || 0),
        // Algunos campos pueden requerir cálculos adicionales
        vatExclusiveItemPrice:
          parseFloat(item.ItemPrice?.Amount || 0) - parseFloat(item.ItemTax?.Amount || 0),
        vatExclusiveShippingPrice:
          parseFloat(item.ShippingPrice?.Amount || 0) - parseFloat(item.ShippingTax?.Amount || 0),
        asin: item.ASIN,
        // referenciaProv se debe obtener del maestro de productos o del Order Report
      }));

      return transformedItems;
    } catch (error) {
      console.error(`Error fetching order items for ${amazonOrderId}:`, error);
      throw error;
    }
  }

  /**
   * Sincroniza pedidos recientes de Amazon a nuestra base de datos
   * @param {number} days - Número de días hacia atrás para sincronizar
   * @returns {Promise<Object>} Resultado de la sincronización
   */
  async syncRecentOrders(days = 7) {
    try {
      const startDate = moment().subtract(days, 'days').toISOString();
      const endDate = moment().toISOString();

      // Obtener pedidos pendientes de envío
      const unshippedOrders = await this.getOrders(startDate, endDate, 'UNSHIPPED');

      // Contador para estadísticas
      const stats = {
        total: unshippedOrders.length,
        created: 0,
        updated: 0,
        errors: 0,
      };

      // Procesar cada pedido
      for (const orderData of unshippedOrders) {
        try {
          // Verificar si el pedido ya existe
          let order = await Order.findOne({ amazonOrderId: orderData.amazonOrderId });

          if (order) {
            // Actualizar pedido existente
            Object.assign(order, orderData);
            await order.save();
            stats.updated++;
          } else {
            // Obtener los items del pedido
            const items = await this.getOrderItems(orderData.amazonOrderId);

            // Crear nuevo pedido con sus items
            order = new Order({
              ...orderData,
              items,
            });

            await order.save();
            stats.created++;
          }
        } catch (error) {
          console.error(`Error processing order ${orderData.amazonOrderId}:`, error);
          stats.errors++;
        }
      }

      return {
        message: 'Sincronización completada',
        stats,
      };
    } catch (error) {
      console.error('Error syncing Amazon orders:', error);
      throw error;
    }
  }

  /**
   * Actualiza el estado de un pedido en Amazon
   * @param {string} amazonOrderId - ID del pedido de Amazon
   * @param {string} expeditionTraking - Número de seguimiento
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async updateOrderShipment(amazonOrderId, expeditionTraking) {
    try {
      // Primero obtener los items del pedido
      const items = await this.getOrderItems(amazonOrderId);

      // Preparar los datos para la API
      const shipmentDate = new Date().toISOString();
      const shipmentItems = items.map((item) => ({
        OrderItemId: item.orderItemId,
        Quantity: item.quantityPurchased,
      }));

      // Enviar la confirmación de envío
      await spApiClient.executeWithRetry(async (client) => {
        return await client.callAPI({
          operation: 'updateShipmentStatus',
          endpoint: 'orders',
          body: {
            amazonOrderId,
            marketplaceId: process.env.AMAZON_MARKETPLACE_ID || 'A1RKKUPIHCS9HS',
            shipmentStatus: {
              shipmentDate,
              carrierCode: 'GLS',
              trackingNumber: expeditionTraking,
              shipmentItems,
            },
          },
        });
      });

      // Actualizar el pedido en nuestra base de datos
      await Order.findOneAndUpdate(
        { amazonOrderId },
        {
          orderStatus: 'Enviado',
          expeditionTraking,
        }
      );

      return {
        message: 'Pedido actualizado correctamente',
        amazonOrderId,
        expeditionTraking,
      };
    } catch (error) {
      console.error(`Error updating shipment for order ${amazonOrderId}:`, error);
      throw error;
    }
  }
}

module.exports = new AmazonOrderService();
