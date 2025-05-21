// backend/src/controllers/catalogController.js
const Product = require('../models/productModel');
const CompetitorPrice = require('../models/competitorPriceModel');
const amazonProductService = require('../services/amazon/productService');
const prestashopProductService = require('../services/prestashop/productService');
const productImportService = require('../services/erp/productImportService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('catalogController');

/**
 * @desc    Obtener lista de productos con filtros
 * @route   GET /api/catalog
 * @access  Private
 */
const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      category = '',
      active,
      platform,
      stock,
      minPrice,
      maxPrice,
      manufacturer = '',
    } = req.query;

    // Construir filtro
    const filter = {};

    // Filtro por búsqueda
    if (search) {
      filter.$or = [
        { sku: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
        { asin: { $regex: search, $options: 'i' } },
      ];
    }

    // Filtro por categoría
    if (category) {
      filter.category = category;
    }

    // Filtro por fabricante/proveedor
    if (manufacturer) {
      filter.manufacturer = manufacturer;
    }

    // Filtro por estado
    if (active === 'true') {
      filter.active = true;
    } else if (active === 'false') {
      filter.active = false;
    }

    // Filtro por plataforma
    if (platform === 'amazon') {
      filter.activeInAmazon = true;
    } else if (platform === 'prestashop') {
      filter.activeInPrestashop = true;
    }

    // Filtro por stock
    if (stock === 'in') {
      filter.erpStock = { $gt: 0 };
    } else if (stock === 'out') {
      filter.erpStock = { $lte: 0 };
    }

    // Filtro por precio
    if (minPrice || maxPrice) {
      filter.amazonPrice = {};
      if (minPrice) filter.amazonPrice.$gte = parseFloat(minPrice);
      if (maxPrice) filter.amazonPrice.$lte = parseFloat(maxPrice);
    }

    // Ejecutar consulta con paginación
    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limit);
    const currentPage = parseInt(page);

    const products = await Product.find(filter)
      .sort({ updatedAt: -1 })
      .skip((currentPage - 1) * limit)
      .limit(limit);

    res.json({
      products,
      pagination: {
        totalItems: totalProducts,
        totalPages,
        currentPage,
        pageSize: limit,
      },
    });
  } catch (error) {
    logger.error(`Error al obtener productos: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Obtener un producto por ID
 * @route   GET /api/catalog/:id
 * @access  Private
 */
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Obtener precios de competencia
    const competitorPrices = await CompetitorPrice.find({ product: product._id })
      .sort('price')
      .limit(10);

    res.json({
      product,
      competitorPrices,
    });
  } catch (error) {
    logger.error(`Error al obtener producto: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Crear un nuevo producto
 * @route   POST /api/catalog
 * @access  Private/Admin
 */
const createProduct = async (req, res) => {
  try {
    const newProduct = await Product.create(req.body);
    res.status(201).json(newProduct);
  } catch (error) {
    logger.error(`Error al crear producto: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Actualizar un producto
 * @route   PUT /api/catalog/:id
 * @access  Private/Admin
 */
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Actualizar campos
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });

    res.json(updatedProduct);
  } catch (error) {
    logger.error(`Error al actualizar producto: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Actualizar un campo específico de un producto
 * @route   PATCH /api/catalog/:id
 * @access  Private
 */
const updateProductField = async (req, res) => {
  try {
    const { field, value } = req.body;

    if (!field) {
      return res.status(400).json({ message: 'Se requiere especificar el campo a actualizar' });
    }

    const updateData = { [field]: value };

    // Si se actualiza amazonStock, manejar la sincronización con Amazon
    if (field === 'amazonStock') {
      try {
        // Actualizar stock en Amazon si está activo
        const product = await Product.findById(req.params.id);
        if (product && product.activeInAmazon && product.asin) {
          await amazonProductService.updateInventory(product.asin, value);
        }
      } catch (syncError) {
        logger.error(`Error al sincronizar stock con Amazon: ${syncError.message}`);
        // Continuar con la actualización local incluso si falla Amazon
      }
    }

    // Si se actualiza preparationTime, manejar la sincronización con Amazon
    if (field === 'preparationTime') {
      try {
        // Actualizar tiempo de preparación en Amazon si está activo
        const product = await Product.findById(req.params.id);
        if (product && product.activeInAmazon && product.asin) {
          await amazonProductService.updateLeadTime(product.asin, value);
        }
      } catch (syncError) {
        logger.error(`Error al sincronizar tiempo de preparación con Amazon: ${syncError.message}`);
        // Continuar con la actualización local incluso si falla Amazon
      }
    }

    // Si se actualiza amazonPrice, manejar la sincronización
    if (field === 'amazonPrice') {
      try {
        // Actualizar precio en Amazon si está activo
        const product = await Product.findById(req.params.id);
        if (product && product.activeInAmazon && product.asin) {
          await amazonProductService.updatePrice(product.asin, value);
        }

        // Actualizar prestashopPrice si no es oferta (4% menos que Amazon)
        if (product && !product.isWebOffer) {
          updateData.prestashopPrice = value * 0.96;
        }
      } catch (syncError) {
        logger.error(`Error al sincronizar precio con Amazon: ${syncError.message}`);
        // Continuar con la actualización local incluso si falla Amazon
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    res.json(updatedProduct);
  } catch (error) {
    logger.error(`Error al actualizar campo de producto: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Eliminar un producto
 * @route   DELETE /api/catalog/:id
 * @access  Private/Admin
 */
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    await product.remove();
    res.json({ message: 'Producto eliminado' });
  } catch (error) {
    logger.error(`Error al eliminar producto: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Obtener lista de categorías únicas
 * @route   GET /api/catalog/categories
 * @access  Private
 */
const getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json(categories);
  } catch (error) {
    logger.error(`Error al obtener categorías: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Obtener lista de fabricantes únicos
 * @route   GET /api/catalog/manufacturers
 * @access  Private
 */
const getManufacturers = async (req, res) => {
  try {
    const manufacturers = await Product.distinct('manufacturer');
    res.json(manufacturers);
  } catch (error) {
    logger.error(`Error al obtener fabricantes: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Sincronizar producto con Amazon
 * @route   POST /api/catalog/:id/sync-amazon
 * @access  Private/Admin
 */
const syncProductWithAmazon = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    if (!product.activeInAmazon) {
      return res.status(400).json({ message: 'El producto no está activo en Amazon' });
    }

    const result = await amazonProductService.syncProduct(product);

    // Actualizar fecha de sincronización
    product.lastSyncWithAmazon = new Date();
    await product.save();

    res.json({ message: 'Producto sincronizado con Amazon', result });
  } catch (error) {
    logger.error(`Error al sincronizar con Amazon: ${error.message}`);
    res.status(500).json({ message: 'Error al sincronizar con Amazon' });
  }
};

/**
 * @desc    Sincronizar producto con Prestashop
 * @route   POST /api/catalog/:id/sync-prestashop
 * @access  Private/Admin
 */
const syncProductWithPrestashop = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    if (!product.activeInPrestashop) {
      return res.status(400).json({ message: 'El producto no está activo en Prestashop' });
    }

    const result = await prestashopProductService.syncProduct(product);

    // Actualizar fecha de sincronización
    product.lastSyncWithPrestashop = new Date();
    await product.save();

    res.json({ message: 'Producto sincronizado con Prestashop', result });
  } catch (error) {
    logger.error(`Error al sincronizar con Prestashop: ${error.message}`);
    res.status(500).json({ message: 'Error al sincronizar con Prestashop' });
  }
};

/**
 * @desc    Actualizar precios de competencia
 * @route   POST /api/catalog/:id/update-competitor-prices
 * @access  Private
 */
const updateCompetitorPrices = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    if (!product.asin) {
      return res.status(400).json({ message: 'El producto no tiene ASIN definido' });
    }

    // Obtener precios de competencia
    const result = await amazonProductService.getCompetitorPrices(
      product.asin,
      product._id,
      product.sku
    );

    // Actualizar fecha de comprobación
    product.lastCompetitorCheck = new Date();
    await product.save();

    res.json({ message: 'Precios de competencia actualizados', result });
  } catch (error) {
    logger.error(`Error al actualizar precios de competencia: ${error.message}`);
    res.status(500).json({ message: 'Error al actualizar precios de competencia' });
  }
};

/**
 * @desc    Optimizar precio basado en competencia
 * @route   POST /api/catalog/:id/optimize-price
 * @access  Private
 */
const optimizePrice = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    if (!product.asin) {
      return res.status(400).json({ message: 'El producto no tiene ASIN definido' });
    }

    // Optimizar precio
    const result = await amazonProductService.optimizePrice(product._id);

    res.json({ message: 'Precio optimizado correctamente', result });
  } catch (error) {
    logger.error(`Error al optimizar precio: ${error.message}`);
    res.status(500).json({ message: 'Error al optimizar precio' });
  }
};

/**
 * @desc    Actualizar stock masivamente
 * @route   POST /api/catalog/bulk-update-stock
 * @access  Private/Admin
 */
const bulkUpdateStock = async (req, res) => {
  try {
    const { productIds, stockValue, platform = 'amazon' } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: 'Se requiere un array de IDs de productos' });
    }

    if (stockValue === undefined || stockValue < 0) {
      return res.status(400).json({ message: 'Se requiere un valor de stock válido' });
    }

    const results = {
      total: productIds.length,
      success: 0,
      failed: 0,
      details: [],
    };

    // Actualizar cada producto
    for (const productId of productIds) {
      try {
        let updateField = 'amazonStock';

        // Determinar qué campo actualizar según la plataforma
        if (platform === 'prestashop') {
          updateField = 'prestashopStock';
        }

        const product = await Product.findById(productId);

        if (!product) {
          results.failed++;
          results.details.push({
            id: productId,
            status: 'failed',
            message: 'Producto no encontrado',
          });
          continue;
        }

        // Actualizar stock en Amazon si corresponde
        if (platform === 'amazon' && product.activeInAmazon && product.asin) {
          try {
            await amazonProductService.updateInventory(product.asin, stockValue);
          } catch (syncError) {
            logger.error(`Error al sincronizar stock con Amazon: ${syncError.message}`);
            // Continuar con la actualización local incluso si falla Amazon
          }
        }

        // Actualizar en base de datos
        await Product.findByIdAndUpdate(productId, { [updateField]: stockValue });

        results.success++;
        results.details.push({ id: productId, status: 'success' });
      } catch (error) {
        logger.error(`Error al actualizar stock para producto ${productId}: ${error.message}`);
        results.failed++;
        results.details.push({ id: productId, status: 'failed', message: error.message });
      }
    }

    res.json({
      message: `Stock actualizado para ${results.success} de ${results.total} productos`,
      results,
    });
  } catch (error) {
    logger.error(`Error en actualización masiva de stock: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Actualizar precios masivamente
 * @route   POST /api/catalog/bulk-update-prices
 * @access  Private/Admin
 */
const bulkUpdatePrices = async (req, res) => {
  try {
    const { productIds, priceAdjustment } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: 'Se requiere un array de IDs de productos' });
    }

    if (!priceAdjustment || !priceAdjustment.type || priceAdjustment.value === undefined) {
      return res.status(400).json({ message: 'Se requiere un ajuste de precio válido' });
    }

    const results = {
      total: productIds.length,
      success: 0,
      failed: 0,
      details: [],
    };

    // Actualizar cada producto
    for (const productId of productIds) {
      try {
        const product = await Product.findById(productId);

        if (!product) {
          results.failed++;
          results.details.push({
            id: productId,
            status: 'failed',
            message: 'Producto no encontrado',
          });
          continue;
        }

        let newPrice;
        const currentPrice = product.amazonPrice || 0;

        // Calcular nuevo precio según tipo de ajuste
        switch (priceAdjustment.type) {
          case 'fixed':
            newPrice = parseFloat(priceAdjustment.value);
            break;
          case 'increase':
            newPrice = currentPrice + parseFloat(priceAdjustment.value);
            break;
          case 'decrease':
            newPrice = Math.max(0, currentPrice - parseFloat(priceAdjustment.value));
            break;
          case 'percentage':
            const percentage = parseFloat(priceAdjustment.value) / 100;
            newPrice = currentPrice * (1 + percentage); // Incremento porcentual
            break;
          default:
            throw new Error('Tipo de ajuste no válido');
        }

        // Asegurar que el precio no sea menor que el mínimo
        if (newPrice < product.minPrice) {
          newPrice = product.minPrice;
        }

        // Actualizar precio en Amazon si está activo
        if (product.activeInAmazon && product.asin) {
          try {
            await amazonProductService.updatePrice(product.asin, newPrice);
          } catch (syncError) {
            logger.error(`Error al sincronizar precio con Amazon: ${syncError.message}`);
            // Continuar con la actualización local incluso si falla Amazon
          }
        }

        // Actualizar en base de datos
        const updatedProduct = await Product.findByIdAndUpdate(
          productId,
          {
            amazonPrice: newPrice,
            // Actualizar prestashopPrice si no es oferta
            ...(product.isWebOffer ? {} : { prestashopPrice: newPrice * 0.96 }),
          },
          { new: true }
        );

        results.success++;
        results.details.push({
          id: productId,
          status: 'success',
          previousPrice: currentPrice,
          newPrice: updatedProduct.amazonPrice,
        });
      } catch (error) {
        logger.error(`Error al actualizar precio para producto ${productId}: ${error.message}`);
        results.failed++;
        results.details.push({ id: productId, status: 'failed', message: error.message });
      }
    }

    res.json({
      message: `Precios actualizados para ${results.success} de ${results.total} productos`,
      results,
    });
  } catch (error) {
    logger.error(`Error en actualización masiva de precios: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Recalcular precios (PVPM) para todos los productos
 * @route   POST /api/catalog/recalculate-prices
 * @access  Private/Admin
 */
const recalculatePrices = async (req, res) => {
  try {
    const result = await productImportService.recalculateAllPrices();
    res.json(result);
  } catch (error) {
    logger.error(`Error al recalcular precios: ${error.message}`);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  updateProductField,
  deleteProduct,
  getCategories,
  getManufacturers,
  syncProductWithAmazon,
  syncProductWithPrestashop,
  updateCompetitorPrices,
  optimizePrice,
  bulkUpdateStock,
  bulkUpdatePrices,
  recalculatePrices,
};
