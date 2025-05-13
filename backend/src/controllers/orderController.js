const Order = require('../models/orderModel');
const Shipment = require('../models/shipmentModel');
const { validationResult } = require('express-validator');
const moment = require('moment');
const { createLogger } = require('../utils/logger');
const logger = createLogger('orderController');

/**
 * @desc    Obtener todas las órdenes con filtros
 * @route   GET /api/orders
 * @access  Private
 */
const getOrders = async (req, res) => {
  try {
    const { source, status, startDate, endDate, limit = 50, page = 1, searchTerm } = req.query;

    // Construir filtro
    const filter = {};

    if (source) filter.source = source;
    if (status) filter.orderStatus = status;

    // Filtrado por fecha
    if (startDate || endDate) {
      filter.purchaseDate = {};
      if (startDate) filter.purchaseDate.$gte = new Date(startDate);
      if (endDate) filter.purchaseDate.$lte = new Date(endDate);
    }

    // Búsqueda por término
    if (searchTerm) {
      filter.$or = [
        { amazonOrderId: { $regex: searchTerm, $options: 'i' } },
        { prestashopOrderId: { $regex: searchTerm, $options: 'i' } },
        { buyerName: { $regex: searchTerm, $options: 'i' } },
        { buyerEmail: { $regex: searchTerm, $options: 'i' } },
        { 'items.sku': { $regex: searchTerm, $options: 'i' } },
      ];
    }

    // Calcular paginación
    const skip = (page - 1) * limit;

    // Ejecutar consulta con filtros y paginación
    const orders = await Order.find(filter)
      .sort({ purchaseDate: -1 })
      .limit(Number(limit))
      .skip(skip);

    // Contar total de documentos para la paginación
    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Obtener una orden por ID
 * @route   GET /api/orders/:id
 * @access  Private
 */
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      $or: [
        { amazonOrderId: req.params.id },
        { prestashopOrderId: req.params.id },
        { _id: req.params.id },
      ],
    });

    if (order) {
      res.json(order);
    } else {
      res.status(404).json({ message: 'Orden no encontrada' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Actualizar estado de una orden
 * @route   PATCH /api/orders/:id
 * @access  Private
 */
const updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus, markForShipment, pendingWithoutStock, isShipFake } = req.body;

    const order = await Order.findOne({
      $or: [
        { amazonOrderId: req.params.id },
        { prestashopOrderId: req.params.id },
        { _id: req.params.id },
      ],
    });

    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    // Actualizar campos si vienen en la petición
    if (orderStatus !== undefined) order.orderStatus = orderStatus;
    if (markForShipment !== undefined) order.markForShipment = markForShipment;
    if (pendingWithoutStock !== undefined) order.pendingWithoutStock = pendingWithoutStock;
    if (isShipFake !== undefined) order.isShipFake = isShipFake;

    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Actualizar datos de envío de una orden
 * @route   PUT /api/orders/:id/shipping
 * @access  Private
 */
const updateOrderShipping = async (req, res) => {
  try {
    const {
      expeditionTraking,
      servicio,
      horario,
      recipientName,
      shipAddress1,
      shipCity,
      shipPostalCode,
      shipCountry,
      shipPhoneNumber,
      deliveryInstructions,
    } = req.body;

    const order = await Order.findOne({
      $or: [
        { amazonOrderId: req.params.id },
        { prestashopOrderId: req.params.id },
        { _id: req.params.id },
      ],
    });

    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    // Actualizar datos de envío
    if (expeditionTraking) order.expeditionTraking = expeditionTraking;
    if (servicio) order.servicio = servicio;
    if (horario) order.horario = horario;
    if (recipientName) order.recipientName = recipientName;
    if (shipAddress1) order.shipAddress1 = shipAddress1;
    if (shipCity) order.shipCity = shipCity;
    if (shipPostalCode) order.shipPostalCode = shipPostalCode;
    if (shipCountry) order.shipCountry = shipCountry;
    if (shipPhoneNumber) order.shipPhoneNumber = shipPhoneNumber;
    if (deliveryInstructions) order.deliveryInstructions = deliveryInstructions;

    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error) {
    logger.error(`Error in getOrderById: ${error.message}`, {
      stack: error.stack,
      orderId: req.params.id,
    });
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Obtener órdenes pendientes de envío
 * @route   GET /api/orders/pending
 * @access  Private
 */
const getPendingOrders = async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const filter = {
      orderStatus: 'Pendiente de envío',
      pendingWithoutStock: { $ne: true },
    };

    const orders = await Order.find(filter)
      .sort({ purchaseDate: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error al obtener órdenes pendientes:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Obtener órdenes pendientes que vencen hoy
 * @route   GET /api/orders/pending/until-today
 * @access  Private
 */
const getPendingOrdersUntilToday = async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    // Use moment.js for date handling - matching the PHP implementation
    const today = moment().startOf('day');

    const filter = {
      orderStatus: 'Pendiente de envío',
      pendingWithoutStock: { $ne: true },
      latestShipDate: { $lte: today.toDate() },
    };

    const orders = await Order.find(filter)
      .sort({ latestShipDate: 1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching pending orders until today:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Obtener órdenes pendientes retrasadas (después de la fecha tope)
 * @route   GET /api/orders/pending/delayed
 * @access  Private
 */
const getDelayedOrders = async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    // Fecha actual al inicio del día
    const today = moment().startOf('day');

    const filter = {
      orderStatus: 'Pendiente de envío',
      pendingWithoutStock: { $ne: true },
      latestShipDate: { $lt: today.toDate() },
    };

    const orders = await Order.find(filter)
      .sort({ latestShipDate: 1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error al obtener órdenes retrasadas:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Obtener órdenes sin stock
 * @route   GET /api/orders/outofstock
 * @access  Private
 */
const getOutOfStockOrders = async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const filter = {
      orderStatus: 'Pendiente de envío',
      pendingWithoutStock: true,
    };

    const orders = await Order.find(filter)
      .sort({ purchaseDate: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error al obtener órdenes sin stock:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Obtener órdenes sin stock que vencen hoy
 * @route   GET /api/orders/outofstock/until-today
 * @access  Private
 */
const getOutOfStockOrdersUntilToday = async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    // Fecha actual al inicio del día
    const today = moment().startOf('day');

    const filter = {
      orderStatus: 'Pendiente de envío',
      pendingWithoutStock: true,
      latestShipDate: { $lte: today.toDate() },
    };

    const orders = await Order.find(filter)
      .sort({ latestShipDate: 1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error al obtener órdenes sin stock hasta hoy:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Obtener órdenes sin stock retrasadas
 * @route   GET /api/orders/outofstock/delayed
 * @access  Private
 */
const getOutOfStockDelayedOrders = async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    // Fecha actual al inicio del día
    const today = moment().startOf('day');

    const filter = {
      orderStatus: 'Pendiente de envío',
      pendingWithoutStock: true,
      latestShipDate: { $lt: today.toDate() },
    };

    const orders = await Order.find(filter)
      .sort({ latestShipDate: 1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error al obtener órdenes sin stock retrasadas:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Obtener órdenes con envío fake
 * @route   GET /api/orders/shipfake
 * @access  Private
 */
const getShipFakeOrders = async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const skip = (page - 1) * limit;

    const filter = {
      orderStatus: 'Pendiente de envío',
      isShipFake: true,
    };

    const orders = await Order.find(filter)
      .sort({ purchaseDate: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error al obtener órdenes con envío fake:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Actualizar estado sin stock de un pedido
 * @route   PATCH /api/orders/:id/stock
 * @access  Private
 */
const updateOrderStockStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { pendingWithoutStock } = req.body;

    if (pendingWithoutStock === undefined) {
      return res.status(400).json({ message: 'Se requiere pendingWithoutStock' });
    }

    const order = await Order.findOne({
      $or: [{ amazonOrderId: id }, { prestashopOrderId: id }, { _id: id }],
    });

    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    order.pendingWithoutStock = pendingWithoutStock;
    await order.save();

    res.json({
      success: true,
      message: 'Estado de stock actualizado',
      order,
    });
  } catch (error) {
    console.error('Error al actualizar estado de stock:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Actualizar estado envío fake de un pedido
 * @route   PATCH /api/orders/:id/shipfake
 * @access  Private
 */
const updateOrderShipFake = async (req, res) => {
  try {
    const { id } = req.params;
    const { isShipFake } = req.body;

    if (isShipFake === undefined) {
      return res.status(400).json({ message: 'Se requiere isShipFake' });
    }

    const order = await Order.findOne({
      $or: [{ amazonOrderId: id }, { prestashopOrderId: id }, { _id: id }],
    });

    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    order.isShipFake = isShipFake;
    await order.save();

    res.json({
      success: true,
      message: 'Estado de envío fake actualizado',
      order,
    });
  } catch (error) {
    console.error('Error al actualizar estado de envío fake:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Marcar orden para envío
 * @route   PATCH /api/orders/:id/mark-for-shipment
 * @access  Private
 */
const markOrderForShipment = async (req, res) => {
  try {
    const { id } = req.params;
    const { markForShipment } = req.body;

    if (markForShipment === undefined) {
      return res.status(400).json({ message: 'Se requiere markForShipment' });
    }

    const order = await Order.findOne({
      $or: [{ amazonOrderId: id }, { prestashopOrderId: id }, { _id: id }],
    });

    if (!order) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    order.markForShipment = markForShipment;
    await order.save();

    res.json({
      success: true,
      message: 'Estado de marcado para envío actualizado',
      order,
    });
  } catch (error) {
    console.error('Error al marcar orden para envío:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Obtener historial de envíos
 * @route   GET /api/orders/shipments/history
 * @access  Private
 */
const getShipmentsHistory = async (req, res) => {
  try {
    const shipments = await Shipment.find({
      $or: [{ exported: true }, { engraved: true }],
      fileGenerateName: { $ne: null },
    }).sort({ updateDateTime: -1 });

    res.json({
      success: true,
      shipments,
    });
  } catch (error) {
    console.error('Error al obtener historial de envíos:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Get shipments history by filename
 * @route   GET /api/orders/shipments/file/:fileName
 * @access  Private
 */
const getShipmentsByFileName = async (req, res) => {
  try {
    const { fileName } = req.params;

    const shipments = await Shipment.find({
      fileGenerateName: fileName,
    });

    if (shipments.length === 0) {
      return res.status(404).json({ message: 'No shipments found with this filename' });
    }

    res.json({
      success: true,
      shipments,
    });
  } catch (error) {
    console.error('Error fetching shipments by filename:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Obtener órdenes listas para enviar
 * @route   GET /api/orders/readytoship
 * @access  Private
 */
const getOrdersReadyToShip = async (req, res) => {
  try {
    const filter = {
      markForShipment: true,
      orderStatus: 'Pendiente de envío',
    };

    const orders = await Order.find(filter).sort({ purchaseDate: 1 });

    res.json(orders);
  } catch (error) {
    console.error('Error al obtener órdenes listas para enviar:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Añadir pedido para envío
 * @route   POST /api/orders/shipment
 * @access  Private
 */
const addOrderToShipment = async (req, res) => {
  try {
    const shipmentData = req.body;

    // Verificar que la orden existe
    const orderExists = await Order.findOne({
      $or: [{ amazonOrderId: shipmentData.idOrder }, { prestashopOrderId: shipmentData.idOrder }],
    });

    if (!orderExists) {
      return res.status(404).json({ message: 'La orden no existe' });
    }

    // Verificar que la orden no está ya enviada
    if (orderExists.expeditionTraking) {
      return res.status(400).json({ message: 'La orden ya ha sido enviada' });
    }

    // Crear el envío
    const shipment = new Shipment(shipmentData);

    await shipment.save();

    // Actualizar la orden
    if (shipmentData.shipmentType === 'isFile') {
      await Order.findByIdAndUpdate(orderExists._id, {
        markForShipment: true,
      });
    } else if (shipmentData.shipmentType === 'isWS') {
      await Order.findByIdAndUpdate(orderExists._id, {
        selectedForShipment: true,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Envío creado correctamente',
      shipment,
    });
  } catch (error) {
    console.error('Error al añadir orden para envío:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Actualizar un envío
 * @route   PATCH /api/orders/shipment/:id
 * @access  Private
 */
const updateShipment = async (req, res) => {
  try {
    const { id } = req.params;
    const { columnName, columnValue } = req.body;

    // Validar que los campos necesarios están presentes
    if (!columnName || columnValue === undefined) {
      return res.status(400).json({ message: 'Se requieren columnName y columnValue' });
    }

    // Validar que el campo a actualizar es permitido
    const allowedFields = [
      'servicio',
      'horario',
      'destinatario',
      'direccion',
      'pais',
      'cp',
      'poblacion',
      'telefono',
      'email',
      'departamento',
      'contacto',
      'observaciones',
      'bultos',
      'movil',
      'refC',
    ];

    if (!allowedFields.includes(columnName)) {
      return res.status(400).json({ message: 'Campo no permitido para actualización' });
    }

    // Buscar y actualizar el envío
    const shipment = await Shipment.findOne({
      idOrder: id,
      fileGenerateName: null,
    });

    if (!shipment) {
      return res.status(404).json({ message: 'Envío no encontrado o ya procesado' });
    }

    // Actualizar el campo específico
    shipment[columnName] = columnValue;

    await shipment.save();

    res.json({
      success: true,
      message: 'Envío actualizado correctamente',
      shipment,
    });
  } catch (error) {
    console.error('Error al actualizar envío:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Eliminar un envío
 * @route   DELETE /api/orders/shipment/:id
 * @access  Private
 */
const deleteShipment = async (req, res) => {
  try {
    const { id } = req.params;
    const { shipmentType } = req.body;

    if (!shipmentType) {
      return res.status(400).json({ message: 'Se requiere shipmentType' });
    }

    // Eliminar el envío
    const result = await Shipment.deleteOne({ idOrder: id });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Envío no encontrado' });
    }

    // Actualizar la orden
    const order = await Order.findOne({
      $or: [{ amazonOrderId: id }, { prestashopOrderId: id }],
    });

    if (order) {
      if (shipmentType === 'isFile') {
        order.markForShipment = false;
      } else if (shipmentType === 'isWS') {
        order.selectedForShipment = false;
      }

      await order.save();
    }

    res.json({
      success: true,
      message: 'Envío eliminado correctamente',
    });
  } catch (error) {
    console.error('Error al eliminar envío:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Procesar envíos
 * @route   POST /api/orders/shipments/process
 * @access  Private
 */
const processShipments = async (req, res) => {
  try {
    const { shipmentType } = req.body;

    if (!shipmentType) {
      return res.status(400).json({ message: 'Se requiere shipmentType' });
    }

    // Caso: Envío por archivo
    if (shipmentType === 'isFile') {
      const pendingShipments = await Shipment.find({
        process: 'isFile',
        fileGenerateName: null,
      });

      if (pendingShipments.length === 0) {
        return res.status(404).json({ message: 'No hay envíos pendientes para procesar' });
      }

      // Generar nombre de archivo
      const fileGenerateName = `Envios_${moment().format('DDMMYYYY_HHmmss')}.xlsx`;

      // Actualizar shipments con el nombre de archivo y marcar como exportados
      await Shipment.updateMany(
        { process: 'isFile', fileGenerateName: null },
        {
          fileGenerateName,
          exported: true,
          updateDateTime: new Date(),
        }
      );

      // Actualizar órdenes
      const orderIds = pendingShipments.map((shipment) => shipment.idOrder);

      await Order.updateMany(
        {
          $or: [{ amazonOrderId: { $in: orderIds } }, { prestashopOrderId: { $in: orderIds } }],
          markForShipment: true,
        },
        { markForShipment: false }
      );

      // Obtener los shipments actualizados para devolver
      const updatedShipments = await Shipment.find({ fileGenerateName });

      res.json({
        success: true,
        message: 'Envíos procesados correctamente',
        fileName: fileGenerateName,
        shipments: updatedShipments,
      });
    }
    // Caso: No implementado todavía
    else {
      return res.status(400).json({ message: 'Tipo de envío no soportado' });
    }
  } catch (error) {
    console.error('Error al procesar envíos:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Obtener todos los contadores de pedidos para filtros
 * @route   GET /api/orders/counts
 * @access  Private
 */
const getOrderCounts = async (req, res) => {
  try {
    // Get the current date
    const today = moment().startOf('day');

    // Counts for different categories
    const pending = await Order.countDocuments({
      orderStatus: 'Pendiente de envío',
      pendingWithoutStock: { $ne: true },
    });

    const pendingUntilToday = await Order.countDocuments({
      orderStatus: 'Pendiente de envío',
      pendingWithoutStock: { $ne: true },
      latestShipDate: { $lte: today.toDate() },
    });

    const delayed = await Order.countDocuments({
      orderStatus: 'Pendiente de envío',
      pendingWithoutStock: { $ne: true },
      latestShipDate: { $lt: today.toDate() },
    });

    const outOfStock = await Order.countDocuments({
      orderStatus: 'Pendiente de envío',
      pendingWithoutStock: true,
    });

    const outOfStockUntilToday = await Order.countDocuments({
      orderStatus: 'Pendiente de envío',
      pendingWithoutStock: true,
      latestShipDate: { $lte: today.toDate() },
    });

    const outOfStockDelayed = await Order.countDocuments({
      orderStatus: 'Pendiente de envío',
      pendingWithoutStock: true,
      latestShipDate: { $lt: today.toDate() },
    });

    const shipFake = await Order.countDocuments({
      orderStatus: 'Pendiente de envío',
      isShipFake: true,
    });

    res.json({
      pending,
      pendingUntilToday,
      delayed,
      outOfStock,
      outOfStockUntilToday,
      outOfStockDelayed,
      shipFake,
    });
  } catch (error) {
    console.error('Error getting order counts:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderShipping,
  getPendingOrders,
  getOutOfStockOrders,
  getPendingOrdersUntilToday,
  getDelayedOrders,
  getOutOfStockOrdersUntilToday,
  getOutOfStockDelayedOrders,
  getShipFakeOrders,
  updateOrderStockStatus,
  updateOrderShipFake,
  markOrderForShipment,
  getShipmentsHistory,
  getShipmentsByFileName,
  getOrdersReadyToShip,
  addOrderToShipment,
  updateShipment,
  deleteShipment,
  processShipments,
  getOrderCounts,
};
