const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Order = require('../../models/orderModel');
const { createReadStream } = require('fs');

/**
 * Servicio para procesar reportes de Amazon
 */
class AmazonReportService {
  /**
   * Procesa un archivo de reporte de órdenes
   * @param {string} filePath - Ruta al archivo CSV del reporte
   * @returns {Promise<Object>} Resultado del procesamiento
   */
  async processOrderReport(filePath) {
    return new Promise((resolve, reject) => {
      try {
        const orders = {};
        const stats = {
          totalOrders: 0,
          processedOrders: 0,
          updatedOrders: 0,
          errors: 0,
        };

        // Crear stream para leer el archivo CSV
        createReadStream(filePath)
          .pipe(csv())
          .on('data', (row) => {
            try {
              // Cada fila corresponde a un item, pero pueden haber múltiples items por orden
              const amazonOrderId = row['order-id'];

              // Si esta orden no ha sido procesada, inicializarla
              if (!orders[amazonOrderId]) {
                orders[amazonOrderId] = {
                  amazonOrderId,
                  buyerEmail: row['buyer-email'],
                  buyerName: row['buyer-name'],
                  buyerPhoneNumber: row['buyer-phone-number'],

                  // Datos de envío
                  recipientName: row['recipient-name'],
                  shipAddress1: row['ship-address-1'],
                  shipAddress2: row['ship-address-2'],
                  shipAddress3: row['ship-address-3'],
                  shipCity: row['ship-city'],
                  shipState: row['ship-state'],
                  shipPostalCode: row['ship-postal-code'],
                  shipCountry: row['ship-country'],
                  shipPhoneNumber: row['ship-phone-number'],

                  // Datos de facturación
                  billName: row['bill-name'] || row['buyer-name'],
                  billAddress1: row['bill-address-1'] || row['ship-address-1'],
                  billAddress2: row['bill-address-2'] || row['ship-address-2'],
                  billAddress3: row['bill-address-3'] || row['ship-address-3'],
                  billCity: row['bill-city'] || row['ship-city'],
                  billState: row['bill-state'] || row['ship-state'],
                  billPostalCode: row['bill-postal-code'] || row['ship-postal-code'],
                  billCountry: row['bill-country'] || row['ship-country'],

                  // Información de comprador
                  isBusinessOrder: row['is-business-order'] === 'true',
                  purchaseOrderNumber: row['purchase-order-number'],
                  buyerCompanyName: row['buyer-company-name'],
                  buyerTaxRegistrationId: row['buyer-tax-registration-id'],
                  buyerTaxRegistrationCountry: row['buyer-tax-registration-country'],

                  // Instrucciones de entrega
                  deliveryInstructions: row['delivery-instructions'],

                  // Items del pedido
                  items: [],
                };

                stats.totalOrders++;
              }

              // Añadir el item a la orden
              orders[amazonOrderId].items.push({
                orderItemId: row['order-item-id'],
                sku: row['sku'],
                productName: row['product-name'],
                quantityPurchased: parseInt(row['quantity-purchased'], 10),
                itemPrice: parseFloat(row['item-price']),
                itemTax: parseFloat(row['item-tax']),
                shippingPrice: parseFloat(row['shipping-price'] || 0),
                shippingTax: parseFloat(row['shipping-tax'] || 0),
                vatExclusiveItemPrice: parseFloat(row['item-price']) - parseFloat(row['item-tax']),
                vatExclusiveShippingPrice:
                  parseFloat(row['shipping-price'] || 0) - parseFloat(row['shipping-tax'] || 0),
                asin: row['asin'],
                referenciaProv: row['seller-sku'] || row['sku'],
              });
            } catch (error) {
              console.error('Error processing CSV row:', error);
              stats.errors++;
            }
          })
          .on('end', async () => {
            try {
              // Procesar todas las órdenes e insertarlas/actualizarlas en la base de datos
              for (const orderData of Object.values(orders)) {
                try {
                  // Buscar si la orden ya existe
                  let order = await Order.findOne({ amazonOrderId: orderData.amazonOrderId });

                  if (order) {
                    // Actualizar con datos completos del reporte
                    order.buyerEmail = orderData.buyerEmail || order.buyerEmail;
                    order.buyerName = orderData.buyerName || order.buyerName;
                    order.buyerPhoneNumber = orderData.buyerPhoneNumber || order.buyerPhoneNumber;

                    // Información de envío
                    order.recipientName = orderData.recipientName || order.recipientName;
                    order.shipAddress1 = orderData.shipAddress1 || order.shipAddress1;
                    order.shipAddress2 = orderData.shipAddress2 || order.shipAddress2;
                    order.shipAddress3 = orderData.shipAddress3 || order.shipAddress3;
                    order.shipCity = orderData.shipCity || order.shipCity;
                    order.shipState = orderData.shipState || order.shipState;
                    order.shipPostalCode = orderData.shipPostalCode || order.shipPostalCode;
                    order.shipCountry = orderData.shipCountry || order.shipCountry;
                    order.shipPhoneNumber = orderData.shipPhoneNumber || order.shipPhoneNumber;

                    // Información de facturación
                    order.billName = orderData.billName || order.billName;
                    order.billAddress1 = orderData.billAddress1 || order.billAddress1;
                    order.billAddress2 = orderData.billAddress2 || order.billAddress2;
                    order.billAddress3 = orderData.billAddress3 || order.billAddress3;
                    order.billCity = orderData.billCity || order.billCity;
                    order.billState = orderData.billState || order.billState;
                    order.billPostalCode = orderData.billPostalCode || order.billPostalCode;
                    order.billCountry = orderData.billCountry || order.billCountry;

                    // Información adicional
                    order.deliveryInstructions =
                      orderData.deliveryInstructions || order.deliveryInstructions;
                    order.isBusinessOrder =
                      orderData.isBusinessOrder !== undefined
                        ? orderData.isBusinessOrder
                        : order.isBusinessOrder;
                    order.purchaseOrderNumber =
                      orderData.purchaseOrderNumber || order.purchaseOrderNumber;
                    order.buyerCompanyName = orderData.buyerCompanyName || order.buyerCompanyName;
                    order.buyerTaxRegistrationId =
                      orderData.buyerTaxRegistrationId || order.buyerTaxRegistrationId;
                    order.buyerTaxRegistrationCountry =
                      orderData.buyerTaxRegistrationCountry || order.buyerTaxRegistrationCountry;

                    // Solo actualizar items si no existían antes
                    if (!order.items || order.items.length === 0) {
                      order.items = orderData.items;
                    }

                    await order.save();
                    stats.updatedOrders++;
                  } else {
                    // Crear nueva orden
                    orderData.source = 'amazon';
                    orderData.orderStatus = 'Pendiente de envío';

                    await Order.create(orderData);
                    stats.processedOrders++;
                  }
                } catch (error) {
                  console.error(`Error processing order ${orderData.amazonOrderId}:`, error);
                  stats.errors++;
                }
              }

              resolve({
                message: 'Procesamiento completado',
                stats,
              });
            } catch (error) {
              console.error('Error during order batch processing:', error);
              reject(error);
            }
          })
          .on('error', (error) => {
            console.error('Error reading CSV file:', error);
            reject(error);
          });
      } catch (error) {
        console.error('Error in report processing:', error);
        reject(error);
      }
    });
  }

  /**
   * Sube un reporte de órdenes
   * @param {Object} file - Archivo subido
   * @returns {Promise<Object>} Resultado de la subida
   */
  async uploadOrderReport(file) {
    try {
      const uploadDir = path.join(__dirname, '../../../uploads/reports');

      // Crear directorio si no existe
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, `order_report_${Date.now()}.csv`);

      // Mover el archivo subido al directorio de reportes
      await fs.promises.writeFile(filePath, file.buffer);

      // Procesar el reporte
      const result = await this.processOrderReport(filePath);

      return {
        message: 'Reporte subido y procesado correctamente',
        filePath,
        result,
      };
    } catch (error) {
      console.error('Error uploading order report:', error);
      throw error;
    }
  }
}

module.exports = new AmazonReportService();
