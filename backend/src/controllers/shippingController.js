// backend/src/controllers/shippingController.js (actualización)

const glsService = require('../services/shipping/glsService');
const Order = require('../models/orderModel');
const Shipment = require('../models/shipmentModel');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');

const logger = createLogger('shippingController');

/**
 * @desc    Crear un envío en GLS
 * @route   POST /api/shipping/gls/create
 * @access  Private
 */
const createGLSShipment = async (req, res) => {
  try {
    const shipmentData = req.body;

    // Validar datos mínimos requeridos
    if (
      !shipmentData.destinatario ||
      !shipmentData.direccion ||
      !shipmentData.cp ||
      !shipmentData.poblacion
    ) {
      return res.status(400).json({
        message: 'Faltan datos requeridos para el envío (destinatario, dirección, CP, población)',
      });
    }

    logger.info(`Solicitud de creación de envío GLS: ${shipmentData.idOrder || 'sin ID'}`);

    // Crear el envío en GLS
    const result = await glsService.createShipment(shipmentData);

    // El servicio GLS ya maneja la actualización del pedido si es necesario

    res.json(result);
  } catch (error) {
    logger.error(`Error creating GLS shipment: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

/**
 * @desc    Obtener la etiqueta de un envío de GLS
 * @route   GET /api/shipping/gls/label/:expeditionNumber
 * @access  Private
 */
const getGLSShipmentLabel = async (req, res) => {
  try {
    const { expeditionNumber } = req.params;

    if (!expeditionNumber) {
      return res.status(400).json({ message: 'Se requiere el número de expedición' });
    }

    logger.info(`Solicitud de etiqueta para expedición: ${expeditionNumber}`);

    // Obtener la etiqueta
    const result = await glsService.getShipmentLabel(expeditionNumber);

    if (result.success) {
      // Devolver el archivo PDF
      const filePath = result.filePath;

      res.download(filePath, result.fileName, (err) => {
        if (err) {
          logger.error(`Error downloading label: ${err.message}`);
          res.status(500).json({ message: 'Error al descargar la etiqueta' });
        }
      });
    } else {
      res.status(400).json({ message: result.message });
    }
  } catch (error) {
    logger.error(`Error getting GLS shipment label: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

/**
 * @desc    Obtener el estado de un envío de GLS
 * @route   GET /api/shipping/gls/status/:expeditionNumber/:postalCode
 * @access  Private
 */
const getGLSShipmentStatus = async (req, res) => {
  try {
    const { expeditionNumber, postalCode } = req.params;

    if (!expeditionNumber || !postalCode) {
      return res.status(400).json({
        message: 'Se requieren el número de expedición y el código postal',
      });
    }

    logger.info(`Solicitud de estado para expedición: ${expeditionNumber}`);

    // Obtener el estado
    const result = await glsService.getShipmentStatus(expeditionNumber, postalCode);

    res.json(result);
  } catch (error) {
    logger.error(`Error getting GLS shipment status: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

/**
 * @desc    Generar CSV para importación masiva de envíos
 * @route   POST /api/shipping/gls/generate-csv
 * @access  Private
 */
const generateGLSShipmentsCsv = async (req, res) => {
  try {
    const { shipments } = req.body;

    if (!shipments || !Array.isArray(shipments) || shipments.length === 0) {
      return res.status(400).json({ message: 'Se requiere una lista de envíos' });
    }

    logger.info(`Generando CSV para ${shipments.length} envíos`);

    // Generar el CSV
    const filePath = await glsService.generateShipmentsCsv(shipments);

    // Devolver el archivo CSV
    res.download(filePath, path.basename(filePath), (err) => {
      if (err) {
        logger.error(`Error downloading CSV: ${err.message}`);
        res.status(500).json({ message: 'Error al descargar el archivo CSV' });
      }
    });
  } catch (error) {
    logger.error(`Error generating GLS shipments CSV: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

/**
 * @desc    Crear envíos masivos para pedidos marcados
 * @route   POST /api/shipping/gls/bulk-create
 * @access  Private
 */
const bulkCreateGLSShipments = async (req, res) => {
  try {
    const { orderIds } = req.body;

    logger.info(`Solicitud de creación masiva de envíos: ${orderIds ? orderIds.length : 'todos'}`);

    // Procesar todos los envíos
    const result = await glsService.bulkCreateShipments(orderIds);

    res.json(result);
  } catch (error) {
    logger.error(`Error en creación masiva de envíos: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

/**
 * @desc    Preparar envíos a partir de órdenes marcadas
 * @route   POST /api/shipping/gls/prepare-shipments
 * @access  Private
 */
const prepareShipmentsFromOrders = async (req, res) => {
  try {
    // Obtener órdenes marcadas para envío
    const orders = await Order.find({
      markForShipment: true,
      orderStatus: 'Pendiente de envío',
      expeditionTraking: { $exists: false },
    });

    if (orders.length === 0) {
      return res.json({
        message: 'No hay órdenes marcadas para envío',
        count: 0,
      });
    }

    logger.info(`Preparando envíos para ${orders.length} pedidos`);

    // Transformar órdenes a formato de envíos GLS
    const shipments = orders.map((order) => ({
      servicio: 37, // Servicio estándar
      horario: 3, // Horario estándar
      destinatario: order.recipientName,
      direccion: [order.shipAddress1, order.shipAddress2, order.shipAddress3]
        .filter(Boolean)
        .join(', '),
      pais: order.shipCountry || 'ES',
      cp: order.shipPostalCode,
      poblacion: order.shipCity,
      telefono: order.shipPhoneNumber || order.buyerPhoneNumber || '',
      email: order.buyerEmail || 'orders@toolstock.info',
      departamento: order.amazonOrderId || order.prestashopOrderId || '',
      contacto: order.recipientName || '',
      observaciones: order.deliveryInstructions || '',
      bultos: 1,
      movil: order.shipPhoneNumber || order.buyerPhoneNumber || '',
      refC: order.purchaseOrderNumber || '',
      idOrder: order.amazonOrderId || order.prestashopOrderId || order._id,
    }));

    // Generar el CSV
    const filePath = await glsService.generateShipmentsCsv(shipments);

    // Marcar las órdenes como seleccionadas para envío
    await Order.updateMany(
      { _id: { $in: orders.map((order) => order._id) } },
      { selectedForShipment: true }
    );

    // Devolver el archivo CSV
    res.download(filePath, path.basename(filePath), (err) => {
      if (err) {
        logger.error(`Error downloading CSV: ${err.message}`);
        res.status(500).json({ message: 'Error al descargar el archivo CSV' });
      }
    });
  } catch (error) {
    logger.error(`Error preparing shipments from orders: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

/**
 * @desc    Actualizar estados de envíos existentes
 * @route   POST /api/shipping/gls/update-statuses
 * @access  Private
 */
const updateShipmentStatuses = async (req, res) => {
  try {
    const { days = 7 } = req.body;

    logger.info(`Actualizando estados de envíos de los últimos ${days} días`);

    // Buscar pedidos enviados
    const filter = {
      orderStatus: 'Enviado',
      expeditionTraking: { $exists: true, $ne: null },
      updatedAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
    };

    const orders = await Order.find(filter);

    if (orders.length === 0) {
      return res.json({
        success: true,
        message: 'No hay envíos para actualizar',
        count: 0,
      });
    }

    logger.info(`Se verificarán ${orders.length} envíos`);

    // Estadísticas
    const stats = {
      total: orders.length,
      checked: 0,
      updated: 0,
      errors: 0,
      details: [],
    };

    // Procesar cada envío
    for (const order of orders) {
      try {
        if (!order.expeditionTraking || !order.shipPostalCode) {
          continue;
        }

        stats.checked++;

        // Obtener estado actual
        const result = await glsService.getShipmentStatus(
          order.expeditionTraking,
          order.shipPostalCode
        );

        if (result.success) {
          if (order.orderStatus !== 'Entregado' && result.status === 'ENTREGADO') {
            // Actualizar estado
            order.orderStatus = 'Entregado';
            await order.save();

            stats.updated++;
            stats.details.push({
              orderId: order._id,
              expeditionNumber: order.expeditionTraking,
              oldStatus: 'Enviado',
              newStatus: 'Entregado',
            });
          }
        } else {
          stats.errors++;
          stats.details.push({
            orderId: order._id,
            expeditionNumber: order.expeditionTraking,
            error: result.message,
          });
        }
      } catch (error) {
        stats.errors++;
        stats.details.push({
          orderId: order._id,
          expeditionNumber: order.expeditionTraking,
          error: error.message,
        });
        logger.error(`Error checking status for order ${order._id}: ${error.message}`);
      }
    }

    logger.info(
      `Actualización de estados completada. Comprobados: ${stats.checked}, Actualizados: ${stats.updated}, Errores: ${stats.errors}`
    );

    res.json({
      success: true,
      message: 'Actualización de estados completada',
      stats,
    });
  } catch (error) {
    logger.error(`Error updating shipment statuses: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

module.exports = {
  createGLSShipment,
  getGLSShipmentLabel,
  getGLSShipmentStatus,
  generateGLSShipmentsCsv,
  prepareShipmentsFromOrders,
  bulkCreateGLSShipments,
  updateShipmentStatuses,
};
