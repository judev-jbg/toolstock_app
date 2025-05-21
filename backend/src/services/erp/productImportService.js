// backend/src/services/erp/productImportService.js
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const Product = require('../../models/productModel');
const PriceConfig = require('../../models/priceConfigModel');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('productImportService');

class ProductImportService {
  /**
   * Importa productos desde un archivo Excel del ERP
   * @param {Object} file - Archivo subido (buffer)
   * @param {Boolean} updateAll - Actualizar todos los productos o solo los nuevos
   * @returns {Promise<Object>} Resultado de la importación
   */
  async importProductsFromExcel(file, updateAll = false) {
    try {
      logger.info('Iniciando importación de productos desde Excel');

      // Estadísticas
      const stats = {
        total: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
      };

      // Leer el archivo Excel
      const workbook = xlsx.read(file.buffer, { type: 'buffer' });

      // Obtener la primera hoja
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convertir a JSON
      const data = xlsx.utils.sheet_to_json(worksheet);

      if (!data || data.length === 0) {
        return { success: false, message: 'El archivo no contiene datos' };
      }

      stats.total = data.length;

      // Obtener configuración de precios
      let priceConfig = await PriceConfig.findOne({ active: true });
      if (!priceConfig) {
        // Crear configuración por defecto si no existe
        priceConfig = await PriceConfig.create({
          defaultMarginRate: 0.75,
          defaultTaxRate: 21,
          defaultShippingCost: 8,
          prestashopDiscount: 4,
          buyboxPriceDifference: 2,
          weightRanges: [
            { maxWeight: 1, shippingCost: 4.18 },
            { maxWeight: 3, shippingCost: 4.57 },
            { maxWeight: 5, shippingCost: 5.25 },
            { maxWeight: 10, shippingCost: 6.48 },
            { maxWeight: 15, shippingCost: 7.85 },
            { maxWeight: 20, shippingCost: 9.2 },
          ],
        });
      }

      // Procesar cada producto del Excel
      for (const item of data) {
        try {
          // Mapear campos del ERP a campos del modelo
          const productData = {
            sku: item.idTool?.toString() || '',
            name: item.Descripcion || '',
            description: item.Descripcion || '',
            reference: item.idArticuloProv?.toString() || '',
            costPrice: parseFloat(item.PrecioCompra) || 0,
            taxRate: priceConfig.defaultTaxRate,
            marginRate: priceConfig.defaultMarginRate,
            weight: parseFloat(item.Peso) || 0,
            brand: item.MarcaDescrip || '',
            manufacturer: item.MarcaDescrip || '',
            category: item.Familia || '',
            ean13: item.CodBarras?.toString() || '',
            active: item.Estado === 0, // 0 = Activo, 1 = Anulado
            erpStock: parseInt(item.Stock) || 0,
          };

          // Determinar el costo de envío según el peso
          if (productData.weight > 0 && priceConfig.weightRanges?.length > 0) {
            for (const range of priceConfig.weightRanges) {
              if (productData.weight <= range.maxWeight) {
                productData.shippingCost = range.shippingCost;
                break;
              }
            }
          } else {
            productData.shippingCost = priceConfig.defaultShippingCost;
          }

          // Verificar si es una oferta web
          if (item.Observaciones && item.Observaciones.includes('OFERTA WEB')) {
            productData.isWebOffer = true;
          }

          // Buscar si ya existe el producto
          const existingProduct = await Product.findOne({ sku: productData.sku });

          if (existingProduct) {
            if (updateAll) {
              // Actualizar manteniendo algunos campos
              Object.keys(productData).forEach((key) => {
                // No sobrescribir campos especiales
                if (
                  ![
                    'amazonPrice',
                    'amazonBusinessPrice',
                    'amazonStock',
                    'asin',
                    'prestashopPrice',
                  ].includes(key)
                ) {
                  existingProduct[key] = productData[key];
                }
              });

              await existingProduct.save();
              stats.updated++;
            } else {
              stats.skipped++;
            }
          } else {
            // Crear nuevo producto
            await Product.create(productData);
            stats.created++;
          }
        } catch (error) {
          logger.error(`Error procesando producto: ${error.message}`);
          stats.errors++;
        }
      }

      return {
        success: true,
        message: 'Importación completada',
        stats,
      };
    } catch (error) {
      logger.error(`Error en importación de productos: ${error.message}`);
      return {
        success: false,
        message: 'Error en la importación',
        error: error.message,
      };
    }
  }

  /**
   * Calcula el PVPM para todos los productos
   * @returns {Promise<Object>} Resultado del cálculo
   */
  async recalculateAllPrices() {
    try {
      const products = await Product.find({});
      const priceConfig = await PriceConfig.findOne({ active: true });

      if (!priceConfig) {
        throw new Error('No se encontró configuración de precios');
      }

      let updated = 0;
      let errors = 0;

      for (const product of products) {
        try {
          // Usar costo especial si existe, si no usar el costo normal
          const cost = product.specialCostPrice || product.costPrice;

          // Usar margen especial si existe, si no usar el margen normal
          const margin =
            product.specialMarginRate || product.marginRate || priceConfig.defaultMarginRate;

          // Usar envío especial si existe, si no usar el envío normal
          const shipping =
            product.specialShippingCost || product.shippingCost || priceConfig.defaultShippingCost;

          // Calcular precio mínimo: ((costo / margen) + IVA) + costo de envío
          const taxRate = product.taxRate || priceConfig.defaultTaxRate;
          const priceWithoutTax = cost / margin;
          const taxAmount = priceWithoutTax * (taxRate / 100);

          const minPrice = priceWithoutTax + taxAmount + shipping;
          product.minPrice = minPrice;

          // Calcular precio para Prestashop (4% menos que Amazon)
          if (product.amazonPrice) {
            product.prestashopPrice =
              product.amazonPrice * (1 - priceConfig.prestashopDiscount / 100);
          } else if (product.minPrice) {
            // Si no hay precio de Amazon, usar el mínimo para calcular precio de Prestashop
            product.prestashopPrice = Math.max(product.minPrice, product.prestashopPrice || 0);
          }

          await product.save();
          updated++;
        } catch (error) {
          logger.error(`Error recalculando precio para producto ${product.sku}: ${error.message}`);
          errors++;
        }
      }

      return {
        success: true,
        message: 'Precios recalculados',
        stats: {
          total: products.length,
          updated,
          errors,
        },
      };
    } catch (error) {
      logger.error(`Error en recálculo de precios: ${error.message}`);
      return {
        success: false,
        message: 'Error en recálculo de precios',
        error: error.message,
      };
    }
  }
}

module.exports = new ProductImportService();
