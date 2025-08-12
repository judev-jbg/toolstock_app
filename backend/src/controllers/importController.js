const XLSX = require('xlsx');
const Product = require('../models/productModel');
const amazonService = require('../services/amazon/amazonService');
const logger = require('../utils/logger').createLogger('importController');
const fs = require('fs');
const path = require('path');

/**
 * Mapeo de columnas del Excel a la base de datos
 */
const COLUMN_MAPPING = {
  idTool: 'erp_sku',
  Descripcion: 'erp_name',
  IdArticuloProv: 'erp_skuSuplier',
  MarcaDescrip: 'erp_manufacturer',
  PrecioCompra: 'erp_cost',
  PVP: 'erp_price',
  CodBarras: 'erp_barcode',
  Observaciones: 'erp_obs',
  Estado: 'erp_status',
  Peso: 'erp_weight',
  Stock: 'erp_stock',
};

/**
 * @desc    Importar productos desde archivo Excel
 * @route   POST /api/products/import
 * @access  Private/Admin
 */
const importProducts = async (req, res) => {
  let filePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se proporcionó archivo Excel' });
    }

    filePath = req.file.path;
    logger.info(`Starting Excel import from file: ${req.file.filename}`);

    // Leer archivo Excel
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Usar la primera hoja
    const worksheet = workbook.Sheets[sheetName];

    // Convertir a JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    if (!jsonData || jsonData.length === 0) {
      return res
        .status(400)
        .json({ message: 'El archivo Excel está vacío o no tiene datos válidos' });
    }

    logger.info(`Processing ${jsonData.length} rows from Excel file`);

    // Procesar datos
    const results = {
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];

      try {
        // Mapear columnas del Excel a la base de datos
        const productData = mapExcelRowToProduct(row);

        // Validar que tenga erp_sku (obligatorio)
        if (!productData.erp_sku) {
          results.skipped++;
          results.errors.push(`Fila ${i + 2}: erp_sku (idTool) es obligatorio`);
          continue;
        }

        // Buscar si el producto ya existe
        const existingProduct = await Product.findOne({ erp_sku: productData.erp_sku });

        if (existingProduct) {
          // Actualizar solo campos ERP, mantener datos de Amazon
          const updateData = {};
          Object.keys(productData).forEach((key) => {
            if (key.startsWith('erp_')) {
              updateData[key] = productData[key];
            }
          });

          await Product.findByIdAndUpdate(existingProduct._id, updateData);
          results.updated++;
          logger.debug(`Updated product: ${productData.erp_sku}`);
        } else {
          // Crear nuevo producto
          await Product.create(productData);
          results.created++;
          logger.debug(`Created product: ${productData.erp_sku}`);
        }

        results.processed++;
      } catch (error) {
        results.errors.push(`Fila ${i + 2}: ${error.message}`);
        logger.error(`Error processing row ${i + 2}:`, error);
      }
    }

    logger.info(`Excel import completed:`, results);

    // Solo ejecutar sincronización si al menos un producto fue procesado exitosamente
    let syncResults = null;
    if (results.created > 0 || results.updated > 0) {
      logger.info('Starting automatic Amazon synchronization...');
      try {
        syncResults = await amazonService.syncProductsWithDatabase();
        logger.info('Amazon synchronization completed:', syncResults);
      } catch (syncError) {
        logger.error('Error in automatic Amazon sync:', syncError);
        // No fallar toda la importación por error de sync, pero notificar
        syncResults = {
          error: true,
          message: syncError.message,
        };
      }
    } else {
      logger.info('No products were successfully imported, skipping Amazon synchronization');
    }

    // Limpiar archivo temporal
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Determinar el estado de la respuesta
    const hasErrors = results.errors.length > 0;
    const hasSuccess = results.created > 0 || results.updated > 0;

    let responseMessage = '';
    if (hasSuccess && !hasErrors) {
      responseMessage = 'Importación completada exitosamente';
    } else if (hasSuccess && hasErrors) {
      responseMessage = 'Importación completada con algunos errores';
    } else {
      responseMessage = 'Importación falló - No se procesaron productos válidos';
    }

    res.status(hasSuccess ? 200 : 400).json({
      message: responseMessage,
      results,
      amazonSync: syncResults,
      totalRows: jsonData.length,
      success: hasSuccess,
    });
  } catch (error) {
    logger.error('Error in Excel import:', error);

    // Limpiar archivo temporal en caso de error
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(500).json({
      message: 'Error procesando archivo Excel',
      error: error.message,
      success: false,
    });
  }
};

/**
 * Mapea una fila del Excel a un objeto de producto
 */
function mapExcelRowToProduct(row) {
  const productData = {};

  // Mapear cada columna según el mapeo definido
  Object.keys(COLUMN_MAPPING).forEach((excelColumn) => {
    const dbColumn = COLUMN_MAPPING[excelColumn];
    const value = row[excelColumn];

    if (value !== undefined && value !== null && value !== '') {
      // Procesar según el tipo de dato esperado
      switch (dbColumn) {
        case 'erp_cost':
        case 'erp_price':
        case 'erp_weight':
          // Convertir a número
          const numValue = parseFloat(value);
          productData[dbColumn] = isNaN(numValue) ? 0 : numValue;
          break;

        case 'erp_status':
        case 'erp_stock':
          // Convertir a entero
          const intValue = parseInt(value);
          productData[dbColumn] = isNaN(intValue) ? 0 : intValue;
          break;

        default:
          // Mantener como string
          productData[dbColumn] = String(value).trim();
          break;
      }
    }
  });

  return productData;
}

/**
 * @desc    Obtener plantilla Excel de ejemplo
 * @route   GET /api/products/import/template
 * @access  Private/Admin
 */
const getImportTemplate = async (req, res) => {
  try {
    // Crear un libro de trabajo con la plantilla
    const workbook = XLSX.utils.book_new();

    // Datos de ejemplo
    const templateData = [
      {
        idTool: 'TOOL001',
        Descripcion: 'Taladro Bosch Professional',
        IdArticuloProv: 'BOSCH-TD-001',
        MarcaDescrip: 'Bosch',
        PrecioCompra: 45.5,
        PVP: 89.99,
        CodBarras: '1234567890123',
        Observaciones: 'Producto destacado',
        Estado: 1,
        Peso: 2.5,
        Stock: 25,
      },
      {
        idTool: 'TOOL002',
        Descripcion: 'Destornillador Set',
        IdArticuloProv: 'MAKITA-DS-002',
        MarcaDescrip: 'Makita',
        PrecioCompra: 15.2,
        PVP: 29.99,
        CodBarras: '1234567890124',
        Observaciones: '',
        Estado: 1,
        Peso: 0.8,
        Stock: 50,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');

    // Generar archivo temporal
    const tempDir = path.join(__dirname, '../../uploads/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const templatePath = path.join(tempDir, 'plantilla-productos.xlsx');
    XLSX.writeFile(workbook, templatePath);

    // Enviar archivo
    res.download(templatePath, 'plantilla-importar-productos.xlsx', (err) => {
      if (err) {
        logger.error('Error sending template file:', err);
      }
      // Limpiar archivo temporal
      if (fs.existsSync(templatePath)) {
        fs.unlinkSync(templatePath);
      }
    });
  } catch (error) {
    logger.error('Error creating import template:', error);
    res.status(500).json({
      message: 'Error generando plantilla',
      error: error.message,
    });
  }
};

module.exports = {
  importProducts,
  getImportTemplate,
};
