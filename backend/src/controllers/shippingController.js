const glsService = require('../services/shipping/glsService');
const Order = require('../models/orderModel');
const fs = require('fs');
const path = require('path');

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

    // Crear el envío en GLS
    const result = await glsService.createShipment(shipmentData);

    // Si se proporcionó un ID de orden, actualizar el número de expedición
    if (shipmentData.idOrder) {
      await Order.findOneAndUpdate(
        {
          $or: [
            { amazonOrderId: shipmentData.idOrder },
            { prestashopOrderId: shipmentData.idOrder },
            { _id: shipmentData.idOrder },
          ],
        },
        {
          expeditionTraking: result.expeditionNumber,
          orderStatus: 'Enviado',
        }
      );
    }

    res.json(result);
  } catch (error) {
    console.error('Error creating GLS shipment:', error);
    res.status(500).json({ message: 'Error en el servidor' });
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

    // Obtener la etiqueta
    const result = await glsService.getShipmentLabel(expeditionNumber);

    if (result.success) {
      // Devolver el archivo PDF
      const filePath = result.filePath;

      res.download(filePath, result.fileName, (err) => {
        if (err) {
          console.error('Error downloading label:', err);
          res.status(500).json({ message: 'Error al descargar la etiqueta' });
        }
      });
    } else {
      res.status(400).json({ message: result.message });
    }
  } catch (error) {
    console.error('Error getting GLS shipment label:', error);
    res.status(500).json({ message: 'Error en el servidor' });
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

    // Obtener el estado
    const result = await glsService.getShipmentStatus(expeditionNumber, postalCode);

    res.json(result);
  } catch (error) {
    console.error('Error getting GLS shipment status:', error);
    res.status(500).json({ message: 'Error en el servidor' });
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

    // Generar el CSV
    const filePath = await glsService.generateShipmentsCsv(shipments);

    // Devolver el archivo CSV
    res.download(filePath, path.basename(filePath), (err) => {
      if (err) {
        console.error('Error downloading CSV:', err);
        res.status(500).json({ message: 'Error al descargar el archivo CSV' });
      }
    });
  } catch (error) {
    console.error('Error generating GLS shipments CSV:', error);
    res.status(500).json({ message: 'Error en el servidor' });
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

    // Transformar órdenes a formato de envíos GLS
    const shipments = orders.map((order) => ({
      servicio: 37, // Servicio estándar
      horario: 3, // Horario estándar
      destinatario: order.recipientName,
      direccion: [order.shipAddress1, order.shipAddress2, order.shipAddress3]
        .filter(Boolean)
        .join(', '),
      pais: order.shipCountry,
      cp: order.shipPostalCode,
      poblacion: order.shipCity,
      telefono: order.shipPhoneNumber || order.buyerPhoneNumber,
      email: 'orders@toolstock.info',
      departamento: order.amazonOrderId || order.prestashopOrderId,
      contacto: order.recipientName,
      observaciones: order.deliveryInstructions || '',
      bultos: 1,
      movil: order.shipPhoneNumber || order.buyerPhoneNumber,
      refC: order.purchaseOrderNumber || '',
      idOrder: order.amazonOrderId || order.prestashopOrderId,
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
        console.error('Error downloading CSV:', err);
        res.status(500).json({ message: 'Error al descargar el archivo CSV' });
      }
    });
  } catch (error) {
    console.error('Error preparing shipments from orders:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

module.exports = {
  createGLSShipment,
  getGLSShipmentLabel,
  getGLSShipmentStatus,
  generateGLSShipmentsCsv,
  prepareShipmentsFromOrders,
};
