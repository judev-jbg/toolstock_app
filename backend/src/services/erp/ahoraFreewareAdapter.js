const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const Order = require('../../models/orderModel');

/**
 * Adaptador para ERP Ahora Freeware
 */
class AhoraFreewareAdapter {
  /**
   * Genera un archivo Excel con pedidos para importar en el ERP
   * @param {Array} orders - Lista de pedidos a exportar
   * @param {string} type - Tipo de exportación (cliente/proveedor)
   * @returns {Promise<string>} Ruta al archivo generado
   */
  async generateOrdersExcel(orders, type = 'cliente') {
    try {
      // Crear directorio si no existe
      const exportsDir = path.join(__dirname, '../../../exports');
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      // Nombre del archivo según tipo
      const filename = `pedidos_${type}_${new Date().toISOString().replace(/:/g, '-')}.xlsx`;
      const filePath = path.join(exportsDir, filename);

      // Preparar datos según tipo de pedido
      let exportData = [];

      if (type === 'cliente') {
        // Pedidos de cliente para Selk
        exportData = orders.map((order) => ({
          Número: order.amazonOrderId || order.prestashopOrderId || '',
          Cliente: 'Toolstock',
          Fecha: new Date(order.purchaseDate).toLocaleDateString('es-ES'),
          Referencia: order.items[0]?.referenciaProv || '',
          Descripción: order.items[0]?.productName || '',
          Cantidad: order.items[0]?.quantityPurchased || 1,
          Precio: order.items[0]?.vatExclusiveItemPrice || 0,
          Importe: order.items[0]?.vatExclusiveItemPrice || 0,
          IVA: order.items[0]?.itemTax || 0,
          Total: order.items[0]?.itemPrice || 0,
        }));

        // Si hay más de un item, añadir filas adicionales
        orders.forEach((order) => {
          if (order.items && order.items.length > 1) {
            for (let i = 1; i < order.items.length; i++) {
              exportData.push({
                Número: order.amazonOrderId || order.prestashopOrderId || '',
                Cliente: 'Toolstock',
                Fecha: new Date(order.purchaseDate).toLocaleDateString('es-ES'),
                Referencia: order.items[i].referenciaProv || '',
                Descripción: order.items[i].productName || '',
                Cantidad: order.items[i].quantityPurchased || 1,
                Precio: order.items[i].vatExclusiveItemPrice || 0,
                Importe: order.items[i].vatExclusiveItemPrice || 0,
                IVA: order.items[i].itemTax || 0,
                Total: order.items[i].itemPrice || 0,
              });
            }
          }
        });
      } else if (type === 'proveedor') {
        // Pedidos de proveedor para Toolstock
        exportData = orders.map((order) => ({
          Número: order.amazonOrderId || order.prestashopOrderId || '',
          Proveedor: 'Selk',
          Fecha: new Date(order.purchaseDate).toLocaleDateString('es-ES'),
          Referencia: order.items[0]?.referenciaProv || '',
          Descripción: order.items[0]?.productName || '',
          Cantidad: order.items[0]?.quantityPurchased || 1,
          Precio: order.items[0]?.vatExclusiveItemPrice || 0,
          Importe: order.items[0]?.vatExclusiveItemPrice || 0,
          IVA: order.items[0]?.itemTax || 0,
          Total: order.items[0]?.itemPrice || 0,
        }));

        // Si hay más de un item, añadir filas adicionales
        orders.forEach((order) => {
          if (order.items && order.items.length > 1) {
            for (let i = 1; i < order.items.length; i++) {
              exportData.push({
                Número: order.amazonOrderId || order.prestashopOrderId || '',
                Proveedor: 'Selk',
                Fecha: new Date(order.purchaseDate).toLocaleDateString('es-ES'),
                Referencia: order.items[i].referenciaProv || '',
                Descripción: order.items[i].productName || '',
                Cantidad: order.items[i].quantityPurchased || 1,
                Precio: order.items[i].vatExclusiveItemPrice || 0,
                Importe: order.items[i].vatExclusiveItemPrice || 0,
                IVA: order.items[i].itemTax || 0,
                Total: order.items[i].itemPrice || 0,
              });
            }
          }
        });
      }

      // Crear libro Excel y añadir hoja
      const workbook = xlsx.utils.book_new();
      const worksheet = xlsx.utils.json_to_sheet(exportData);

      // Añadir hoja al libro
      xlsx.utils.book_append_sheet(workbook, worksheet, `Pedidos ${type}`);

      // Escribir archivo
      xlsx.writeFile(workbook, filePath);

      return filePath;
    } catch (error) {
      console.error(`Error generating ${type} orders Excel:`, error);
      throw error;
    }
  }

  /**
   * Exporta pedidos para ERP
   * @param {Object} options - Opciones de exportación
   * @returns {Promise<Object>} Resultado de la exportación
   */
  async exportOrders(options = {}) {
    try {
      const { type = 'cliente', status = 'Pendiente de envío', days = 7 } = options;

      // Filtrar pedidos según criterios
      const filter = {
        orderStatus: status,
        createdAt: {
          $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        },
      };

      // Si es para pedidos marcados para envío
      if (options.markedForShipment) {
        filter.markForShipment = true;
      }

      // Obtener pedidos según filtro
      const orders = await Order.find(filter);

      if (orders.length === 0) {
        return {
          message: 'No hay pedidos para exportar',
          count: 0,
        };
      }

      // Generar archivo Excel
      const filePath = await this.generateOrdersExcel(orders, type);

      return {
        message: 'Exportación completada',
        filePath,
        count: orders.length,
      };
    } catch (error) {
      console.error('Error exporting orders for ERP:', error);
      throw error;
    }
  }

  /**
   * Importa actualizaciones de pedidos desde archivo Excel
   * @param {Object} file - Archivo Excel subido
   * @returns {Promise<Object>} Resultado de la importación
   */
  async importOrderUpdates(file) {
    try {
      // Leer archivo Excel
      const workbook = xlsx.read(file.buffer);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Convertir a JSON
      const data = xlsx.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        return {
          message: 'El archivo no contiene datos',
          count: 0,
        };
      }

      // Estadísticas
      const stats = {
        total: data.length,
        updated: 0,
        errors: 0,
        notFound: 0,
      };

      // Procesador cada fila
      for (const row of data) {
        try {
          // Buscar el pedido por su número
          const orderNumber = row['Número'] || row['Numero'] || row['NumeroPedido'] || row['ID'];

          if (!orderNumber) {
            stats.errors++;
            continue;
          }

          // Buscar por ID de Amazon o PrestaShop
          const order = await Order.findOne({
            $or: [{ amazonOrderId: orderNumber }, { prestashopOrderId: orderNumber }],
          });

          if (!order) {
            stats.notFound++;
            continue;
          }

          // Actualizar según campos disponibles
          if (row['Estado']) {
            order.orderStatus = row['Estado'];
          }

          if (row['Expedicion'] || row['Seguimiento']) {
            order.expeditionTraking = row['Expedicion'] || row['Seguimiento'];
          }

          if (row['Enviado'] !== undefined) {
            order.orderStatus = row['Enviado'] ? 'Enviado' : order.orderStatus;
          }

          // Guardar cambios
          await order.save();
          stats.updated++;
        } catch (error) {
          console.error(`Error processing row:`, error);
          stats.errors++;
        }
      }

      return {
        message: 'Importación completada',
        stats,
      };
    } catch (error) {
      console.error('Error importing order updates:', error);
      throw error;
    }
  }
}

module.exports = new AhoraFreewareAdapter();
