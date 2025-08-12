// backend/src/scripts/migratePricingFields.js - NUEVO ARCHIVO
const mongoose = require('mongoose');
const Product = require('../models/productModel');
const PricingConfig = require('../models/pricingConfigModel');
require('dotenv').config();

const migratePricingFields = async () => {
  try {
    console.log('🔄 Iniciando migración de campos de pricing...');

    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Conectado a MongoDB');

    // Asegurar que existe configuración de pricing
    const config = await PricingConfig.getInstance();
    console.log('✅ Configuración de pricing inicializada');

    // Obtener todos los productos que necesitan migración
    const products = await Product.find({
      erp_sku: { $exists: true, $ne: '' },
      'pricing.pricingStatus': { $exists: false },
    });

    console.log(`📊 Encontrados ${products.length} productos para migrar`);

    let migrated = 0;
    let errors = 0;

    for (const product of products) {
      try {
        // Inicializar estructura de pricing si no existe
        if (!product.pricing) {
          product.pricing = {};
        }

        // Establecer valores por defecto para nuevos campos
        const pricingDefaults = {
          customCost: null,
          customMargin: null,
          customShippingCost: null,
          pvpm: 0,
          pvpmCalculatedAt: null,
          pvpmBreakdown: {
            cost: 0,
            margin: 0,
            iva: 0,
            shippingCost: 0,
            basePrice: 0,
            priceWithIva: 0,
          },
          competitorPrice: null,
          competitorPriceUpdatedAt: null,
          competitorData: {
            hasBuybox: false,
            buyboxPrice: null,
            lowestPrice: null,
            totalOffers: 0,
            lastChecked: null,
          },
          fixedPrice: null,
          fixedPriceReason: '',
          fixedPriceSetAt: null,
          fixedPriceSetBy: '',
          fixedPriceExpiresAt: null,
          autoUpdateEnabled: true,
          lastPriceUpdate: null,
          autoUpdateCount: 0,
          pricingStatus: 'ok',
          pricingStatusMessage: '',
          pricingStatusUpdatedAt: new Date(),
          pricingRules: {
            minimumPrice: null,
            maximumPrice: null,
            excludeFromAutoUpdate: false,
            minimumMarginRequired: null,
          },
          recentPriceHistory: [],
          pricingMetadata: {
            totalPriceChanges: 0,
            lastSuccessfulUpdate: null,
            lastFailedUpdate: null,
            consecutiveFailures: 0,
          },
        };

        // Aplicar solo campos que no existen
        Object.keys(pricingDefaults).forEach((key) => {
          if (product.pricing[key] === undefined) {
            product.pricing[key] = pricingDefaults[key];
          }
        });

        await product.save();
        migrated++;

        if (migrated % 100 === 0) {
          console.log(`📈 Migrados ${migrated}/${products.length} productos`);
        }
      } catch (error) {
        console.error(`❌ Error migrando producto ${product.erp_sku}:`, error.message);
        errors++;
      }
    }

    console.log('🎉 Migración completada:');
    console.log(`  ✅ Productos migrados: ${migrated}`);
    console.log(`  ❌ Errores: ${errors}`);
    console.log(`  📊 Total procesados: ${products.length}`);
  } catch (error) {
    console.error('💥 Error en migración:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB');
  }
};

// Ejecutar migración si es llamado directamente
if (require.main === module) {
  migratePricingFields().then(() => process.exit(0));
}

module.exports = migratePricingFields;
