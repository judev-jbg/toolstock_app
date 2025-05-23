const Product = require('../models/productModel');
const amazonService = require('../services/amazon/amazonService');
const logger = require('../utils/logger').createLogger('productController');

/**
 * @desc    Obtener todos los productos con filtros y paginación
 * @route   GET /api/products
 * @access  Private
 */
const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      brand = '',
      status = '',
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = req.query;

    // Construir filtros
    const filters = {};

    // Filtro de búsqueda por SKU, ASIN o título
    if (search) {
      filters.$or = [
        { sellerSku: { $regex: search, $options: 'i' } },
        { asin: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
      ];
    }

    // Filtro por marca
    if (brand && brand !== 'all') {
      filters.brand = brand;
    }

    // Filtro por estado
    if (status && status !== 'all') {
      filters.status = status;
    }

    // Configurar paginación
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * pageSize;

    // Configurar ordenación
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Ejecutar consulta con paginación
    const [products, totalCount] = await Promise.all([
      Product.find(filters).sort(sortOptions).skip(skip).limit(pageSize).lean(),
      Product.countDocuments(filters),
    ]);

    // Calcular información de paginación
    const totalPages = Math.ceil(totalCount / pageSize);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.json({
      products,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: pageSize,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (error) {
    logger.error('Error getting products:', error);
    res.status(500).json({
      message: 'Error obteniendo productos',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener marcas disponibles para filtros
 * @route   GET /api/products/brands
 * @access  Private
 */
const getBrands = async (req, res) => {
  try {
    const brands = await Product.distinct('brand', {
      brand: { $ne: '' },
      brand: { $ne: null },
    });
    res.json(brands.sort());
  } catch (error) {
    logger.error('Error getting brands:', error);
    res.status(500).json({
      message: 'Error obteniendo marcas',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener estadísticas de productos
 * @route   GET /api/products/stats
 * @access  Private
 */
const getProductStats = async (req, res) => {
  try {
    const stats = await Product.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const totalProducts = await Product.countDocuments();

    // Formatear estadísticas
    const formattedStats = {
      total: totalProducts,
      byStatus: {},
    };

    stats.forEach((stat) => {
      formattedStats.byStatus[stat._id] = stat.count;
    });

    // Asegurar que todos los estados estén presentes
    ['Active', 'Inactive', 'Incomplete'].forEach((status) => {
      if (!formattedStats.byStatus[status]) {
        formattedStats.byStatus[status] = 0;
      }
    });

    res.json(formattedStats);
  } catch (error) {
    logger.error('Error getting product stats:', error);
    res.status(500).json({
      message: 'Error obteniendo estadísticas',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener un producto por ID
 * @route   GET /api/products/:id
 * @access  Private
 */
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json(product);
  } catch (error) {
    logger.error('Error getting product by ID:', error);
    res.status(500).json({
      message: 'Error obteniendo producto',
      error: error.message,
    });
  }
};

/**
 * @desc    Sincronizar productos con Amazon
 * @route   POST /api/products/sync
 * @access  Private/Admin
 */
const syncProducts = async (req, res) => {
  try {
    logger.info('Starting manual product sync...');
    const results = await amazonService.syncProductsWithDatabase();

    res.json({
      message: 'Sincronización completada',
      results,
    });
  } catch (error) {
    logger.error('Error syncing products:', error);
    res.status(500).json({
      message: 'Error sincronizando productos',
      error: error.message,
    });
  }
};

/**
 * @desc    Actualizar stock de un producto
 * @route   PUT /api/products/:id/stock
 * @access  Private
 */
const updateProductStock = async (req, res) => {
  try {
    const { quantity } = req.body;

    if (typeof quantity !== 'number' || quantity < 0) {
      return res.status(400).json({
        message: 'La cantidad debe ser un número positivo',
      });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    logger.info(
      `Updating stock for product ${product.sellerSku} from ${product.quantity} to ${quantity}`
    );

    try {
      // Actualizar en Amazon primero
      const amazonResult = await amazonService.updateInventoryQuantity(product.sellerSku, quantity);

      res.json({
        message: 'Stock actualizado correctamente en Amazon y localmente',
        product: amazonResult.local,
        amazonResponse: {
          success: amazonResult.success,
          submissionId: amazonResult.amazon?.submissionId || null,
        },
      });
    } catch (amazonError) {
      logger.error(`Error updating stock in Amazon for ${product.sellerSku}:`, amazonError);

      // Si falla Amazon, actualizar solo localmente pero informar del error
      product.quantity = quantity;
      product.lastInventoryUpdate = new Date();
      product.syncStatus = 'error';
      product.syncError = `Error actualizando en Amazon: ${amazonError.message}`;
      await product.save();

      res.status(207).json({
        message: 'Stock actualizado localmente, pero falló la actualización en Amazon',
        product,
        error: amazonError.message,
        warning:
          'El stock se actualizó solo en la base de datos local. Verifique la configuración de Amazon SP-API.',
      });
    }
  } catch (error) {
    logger.error('Error updating product stock:', error);
    res.status(500).json({
      message: 'Error actualizando stock',
      error: error.message,
    });
  }
};

/**
 * @desc    Actualizar stock de múltiples productos
 * @route   PUT /api/products/bulk-stock
 * @access  Private
 */
const bulkUpdateStock = async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        message: 'Se requiere un array de actualizaciones',
      });
    }

    // Validar datos
    for (const update of updates) {
      if (!update.id || typeof update.quantity !== 'number' || update.quantity < 0) {
        return res.status(400).json({
          message: 'Cada actualización debe tener un ID válido y una cantidad positiva',
        });
      }
    }

    logger.info(`Starting bulk stock update for ${updates.length} products`);

    // Obtener productos
    const productIds = updates.map((u) => u.id);
    const products = await Product.find({ _id: { $in: productIds } });

    if (products.length !== updates.length) {
      return res.status(400).json({
        message: 'Algunos productos no fueron encontrados',
      });
    }

    // Preparar actualizaciones para Amazon (convertir IDs a SKUs)
    const amazonUpdates = updates.map((update) => {
      const product = products.find((p) => p._id.toString() === update.id);
      return {
        sellerSku: product.sellerSku,
        quantity: update.quantity,
      };
    });

    try {
      // Actualizar en Amazon usando el servicio principal
      const results = await amazonService.bulkUpdateInventory(amazonUpdates);

      // Preparar respuesta detallada
      const response = {
        message: 'Actualización masiva completada',
        results: {
          total: updates.length,
          successful: results.success.length,
          failed: results.errors.length,
          details: {
            success: results.success,
            errors: results.errors,
          },
        },
      };

      if (results.errors.length > 0) {
        res.status(207).json({
          ...response,
          warning: `${results.errors.length} productos fallaron al actualizar en Amazon`,
        });
      } else {
        res.json(response);
      }
    } catch (error) {
      logger.error('Error in bulk stock update:', error);

      // Si falla completamente, actualizar solo localmente
      const localResults = {
        success: [],
        errors: [],
      };

      for (const update of updates) {
        try {
          const product = products.find((p) => p._id.toString() === update.id);
          product.quantity = update.quantity;
          product.lastInventoryUpdate = new Date();
          product.syncStatus = 'error';
          product.syncError = 'Error en actualización masiva de Amazon';
          await product.save();

          localResults.success.push({
            sellerSku: product.sellerSku,
            quantity: update.quantity,
            updatedLocally: true,
          });
        } catch (localError) {
          localResults.errors.push({
            id: update.id,
            error: localError.message,
          });
        }
      }

      res.status(207).json({
        message: 'Error en actualización masiva de Amazon, actualizado solo localmente',
        results: {
          total: updates.length,
          successful: localResults.success.length,
          failed: localResults.errors.length,
          details: localResults,
        },
        error: error.message,
        warning:
          'Los cambios se guardaron solo en la base de datos local. Verifique la configuración de Amazon SP-API.',
      });
    }
  } catch (error) {
    logger.error('Error in bulk stock update:', error);
    res.status(500).json({
      message: 'Error en actualización masiva',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener productos que necesitan sincronización
 * @route   GET /api/products/sync-needed
 * @access  Private
 */
const getProductsNeedingSync = async (req, res) => {
  try {
    const count = await amazonService.checkSyncNeeded();
    res.json({ needsSync: count });
  } catch (error) {
    logger.error('Error checking sync status:', error);
    res.status(500).json({
      message: 'Error verificando estado de sincronización',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener endpoints disponibles de Amazon SP-API (para debugging)
 * @route   GET /api/products/endpoints
 * @access  Private/Admin
 */
const getAvailableEndpoints = async (req, res) => {
  try {
    const endpoints = await amazonService.getAvailableEndpoints();
    res.json({ endpoints });
  } catch (error) {
    logger.error('Error getting available endpoints:', error);
    res.status(500).json({
      message: 'Error obteniendo endpoints disponibles',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener órdenes recientes (para pruebas)
 * @route   GET /api/products/test-orders
 * @access  Private/Admin
 */
const getTestOrders = async (req, res) => {
  try {
    const orders = await amazonService.getOrders();
    res.json({
      message: 'Órdenes obtenidas exitosamente',
      count: orders.length,
      orders: orders.slice(0, 5), // Solo mostrar las primeras 5
    });
  } catch (error) {
    logger.error('Error getting test orders:', error);
    res.status(500).json({
      message: 'Error obteniendo órdenes de prueba',
      error: error.message,
    });
  }
};

/**
 * @desc    Verificar configuración de Amazon (para debugging)
 * @route   GET /api/products/config-check
 * @access  Private/Admin
 */
const checkAmazonConfig = async (req, res) => {
  try {
    const config = {
      marketplaceId: process.env.AMAZON_MARKETPLACE_ID || 'NOT SET',
      sellerId: process.env.AMAZON_SELLER_ID || 'NOT SET',
      region: process.env.AMAZON_REGION || 'NOT SET',
      clientId: process.env.SELLING_PARTNER_APP_CLIENT_ID ? 'SET' : 'NOT SET',
      clientSecret: process.env.SELLING_PARTNER_APP_CLIENT_SECRET ? 'SET' : 'NOT SET',
      refreshToken: process.env.AMAZON_REFRESH_TOKEN ? 'SET' : 'NOT SET',
    };

    res.json({
      message: 'Configuración de Amazon SP-API',
      config,
      allConfigured: Object.values(config).every((val) => val !== 'NOT SET'),
    });
  } catch (error) {
    logger.error('Error checking config:', error);
    res.status(500).json({
      message: 'Error verificando configuración',
      error: error.message,
    });
  }
};

/**
 * @desc    Actualizar un producto específico (NUEVO)
 * @route   PUT /api/products/:id
 * @access  Private
 */
const updateProduct = async (req, res) => {
  try {
    const { title, brand, price, status } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Actualizar campos permitidos
    if (title) product.title = title;
    if (brand) product.brand = brand;
    if (price !== undefined) product.price = price;
    if (status) product.status = status;

    product.lastInventoryUpdate = new Date();

    const updatedProduct = await product.save();

    res.json({
      message: 'Producto actualizado correctamente',
      product: updatedProduct,
    });
  } catch (error) {
    logger.error('Error updating product:', error);
    res.status(500).json({
      message: 'Error actualizando producto',
      error: error.message,
    });
  }
};

module.exports = {
  getProducts,
  getBrands,
  getProductStats,
  getProductById,
  syncProducts,
  updateProductStock,
  bulkUpdateStock,
  getProductsNeedingSync,
  getAvailableEndpoints,
  getTestOrders,
  checkAmazonConfig,
  updateProduct,
};
