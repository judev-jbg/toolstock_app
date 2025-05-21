// backend/src/controllers/catalogController.js
const Product = require('../models/productModel');
const CompetitorPrice = require('../models/competitorPriceModel');
const ProductImage = require('../models/productImageModel');
const amazonIntegration = require('../services/amazon/productService');
const prestashopIntegration = require('../services/prestashop/productService');

/**
 * @desc    Obtener lista de productos con filtros
 * @route   GET /api/catalog
 * @access  Private
 */
const getProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      active,
      platform,
      stock,
      minPrice,
      maxPrice,
      page = 1,
      limit = 50,
      sort = 'name',
      direction = 'asc',
    } = req.query;

    // Construir filtro
    const filter = {};

    // Búsqueda por texto
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { asin: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
      ];
    }

    // Filtrar por categoría
    if (category) {
      filter.category = category;
    }

    // Filtrar por estado activo
    if (active !== undefined) {
      filter.active = active === 'true';
    }

    // Filtrar por plataforma
    if (platform) {
      if (platform === 'amazon') {
        filter.activeInAmazon = true;
      } else if (platform === 'prestashop') {
        filter.activeInPrestashop = true;
      }
    }

    // Filtrar por stock
    if (stock) {
      if (stock === 'in') {
        filter.erpStock = { $gt: 0 };
      } else if (stock === 'out') {
        filter.erpStock = { $lte: 0 };
      }
    }

    // Filtrar por precio
    if (minPrice) {
      filter.minPrice = { $gte: parseFloat(minPrice) };
    }
    if (maxPrice) {
      filter.minPrice = { ...filter.minPrice, $lte: parseFloat(maxPrice) };
    }

    // Calcular valores para paginación
    const skip = (page - 1) * limit;

    // Ordenamiento
    const sortOptions = {};
    sortOptions[sort] = direction === 'asc' ? 1 : -1;

    // Ejecutar consulta paginada
    const products = await Product.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Contar total de resultados para paginación
    const total = await Product.countDocuments(filter);

    // Calcular páginas totales
    const totalPages = Math.ceil(total / limit);

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        totalPages,
        totalItems: total,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Error al obtener productos:', error);
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

    // Obtener imágenes del producto
    const images = await ProductImage.find({ product: product._id }).sort('position');

    // Obtener precios de competencia
    const competitorPrices = await CompetitorPrice.find({
      product: product._id,
      lastChecked: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    })
      .sort('price')
      .lean();

    res.json({
      product,
      images,
      competitorPrices,
    });
  } catch (error) {
    console.error('Error al obtener producto:', error);
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
    const {
      sku,
      name,
      description,
      shortDescription,
      reference,
      costPrice,
      specialCostPrice,
      taxRate,
      marginRate,
      specialMarginRate,
      shippingCost,
      specialShippingCost,
      weight,
      height,
      width,
      depth,
      ean13,
      upc,
      manufacturer,
      brand,
      category,
      subcategory,
      tags,
      minimumStock,
      preparationTime,
      metaTitle,
      metaDescription,
      metaKeywords,
    } = req.body;

    // Verificar si el SKU ya existe
    const existingProduct = await Product.findOne({ sku });
    if (existingProduct) {
      return res.status(400).json({ message: 'Ya existe un producto con ese SKU' });
    }

    // Crear producto
    const product = await Product.create({
      sku,
      name,
      description,
      shortDescription,
      reference,
      costPrice,
      specialCostPrice,
      taxRate,
      marginRate,
      specialMarginRate,
      shippingCost,
      specialShippingCost,
      weight,
      height,
      width,
      depth,
      ean13,
      upc,
      manufacturer,
      brand,
      category,
      subcategory,
      tags,
      minimumStock,
      preparationTime,
      metaTitle,
      metaDescription,
      metaKeywords,
      active: true,
      lastSyncWithErp: new Date(),
    });

    res.status(201).json({
      message: 'Producto creado correctamente',
      product,
    });
  } catch (error) {
    console.error('Error al crear producto:', error);
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
    const updatedFields = { ...req.body };

    // Verificar SKU único si se está cambiando
    if (updatedFields.sku && updatedFields.sku !== product.sku) {
      const existingProduct = await Product.findOne({ sku: updatedFields.sku });
      if (existingProduct) {
        return res.status(400).json({ message: 'Ya existe un producto con ese SKU' });
      }
    }

    // Si se actualiza algún campo de precio o costos, recalcular precio mínimo
    const priceRelatedFields = [
      'costPrice',
      'specialCostPrice',
      'taxRate',
      'marginRate',
      'specialMarginRate',
      'shippingCost',
      'specialShippingCost',
    ];

    const shouldRecalculatePrice = priceRelatedFields.some(
      (field) => updatedFields[field] !== undefined && updatedFields[field] !== product[field]
    );

    // Aplicar actualizaciones
    Object.keys(updatedFields).forEach((key) => {
      product[key] = updatedFields[key];
    });

    // Si cambió algún dato de precio, se recalcula (esto ocurre en el middleware pre-save)
    if (shouldRecalculatePrice) {
      // El minPrice se calcula automáticamente en el modelo
      console.log('Recalculando precio mínimo...');
    }

    // Guardar cambios
    await product.save();

    res.json({
      message: 'Producto actualizado correctamente',
      product,
    });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
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

    if (!field || value === undefined) {
      return res.status(400).json({ message: 'Se requiere campo y valor' });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Actualizar el campo específico
    product[field] = value;

    // Guardar cambios
    await product.save();

    res.json({
      message: `Campo ${field} actualizado correctamente`,
      product,
    });
  } catch (error) {
    console.error('Error al actualizar campo del producto:', error);
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

    // En lugar de eliminar, desactivar el producto
    product.active = false;
    await product.save();

    res.json({ message: 'Producto desactivado correctamente' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Obtener categorías únicas
 * @route   GET /api/catalog/categories
 * @access  Private
 */
const getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json(categories);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
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

    // Llamar al servicio de integración con Amazon
    const result = await amazonIntegration.syncProduct(product);

    res.json({
      message: 'Producto sincronizado con Amazon',
      result,
    });
  } catch (error) {
    console.error('Error al sincronizar con Amazon:', error);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
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

    // Llamar al servicio de integración con Prestashop
    const result = await prestashopIntegration.syncProduct(product);

    res.json({
      message: 'Producto sincronizado con Prestashop',
      result,
    });
  } catch (error) {
    console.error('Error al sincronizar con Prestashop:', error);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

/**
 * @desc    Actualizar precios de competencia
 * @route   POST /api/catalog/:id/update-competitor-prices
 * @access  Private/Admin
 */
const updateCompetitorPrices = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Verificar si tiene ASIN
    if (!product.asin) {
      return res.status(400).json({ message: 'El producto no tiene ASIN definido' });
    }

    // Llamar al servicio para obtener precios de competencia
    const result = await amazonIntegration.getCompetitorPrices(
      product.asin,
      product._id,
      product.sku
    );

    res.json({
      message: 'Precios de competencia actualizados',
      result,
    });
  } catch (error) {
    console.error('Error al actualizar precios de competencia:', error);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

/**
 * @desc    Actualizar precio en Amazon basado en competencia
 * @route   POST /api/catalog/:id/optimize-price
 * @access  Private/Admin
 */
const optimizePrice = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Verificar si tiene ASIN
    if (!product.asin) {
      return res.status(400).json({ message: 'El producto no tiene ASIN definido' });
    }

    // Obtener precios de competencia
    const competitorPrices = await CompetitorPrice.find({
      product: product._id,
      lastChecked: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    })
      .sort('price')
      .limit(10)
      .lean();

    if (competitorPrices.length === 0) {
      return res.status(400).json({ message: 'No hay datos de competencia recientes' });
    }

    // Calcular precio óptimo
    const lowestCompetitorPrice = competitorPrices[0].price;

    // No bajar del precio mínimo
    let optimalPrice = Math.max(
      lowestCompetitorPrice - 2, // 2€ menos que el competidor más barato
      product.minPrice
    );

    // Actualizar precio en Amazon
    if (optimalPrice !== product.amazonPrice) {
      const updateResult = await amazonIntegration.updatePrice(product.asin, optimalPrice);

      // Actualizar producto en BD
      product.amazonPrice = optimalPrice;
      await product.save();

      res.json({
        message: 'Precio optimizado y actualizado en Amazon',
        previousPrice: product.amazonPrice,
        newPrice: optimalPrice,
        updateResult,
      });
    } else {
      res.json({
        message: 'El precio ya está optimizado',
        price: optimalPrice,
      });
    }
  } catch (error) {
    console.error('Error al optimizar precio:', error);
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
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
  syncProductWithAmazon,
  syncProductWithPrestashop,
  updateCompetitorPrices,
  optimizePrice,
};
