const PriceHistory = require('../../models/priceHistoryModel');
const Product = require('../../models/productModel');
const PricingConfig = require('../../models/pricingConfigModel');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

class HistoryService {
  /**
   * Registra un cambio de precio en el historial
   */
  async recordPriceChange(data) {
    try {
      const {
        productId,
        erp_sku,
        changeType,
        prices,
        context,
        execution,
        validation = {},
        references = {},
      } = data;

      // Obtener configuración actual para snapshot
      const config = await PricingConfig.getInstance();
      const configSnapshot = {
        defaultMargin: config.defaultMargin,
        defaultIva: config.defaultIva,
        defaultShippingCost: config.defaultShippingCost,
      };

      // Crear entrada de historial
      const historyEntry = new PriceHistory({
        productId,
        erp_sku,
        changeType,
        prices,
        context,
        execution: {
          ...execution,
          startedAt: new Date(),
        },
        validation,
        references: {
          ...references,
          configSnapshot,
        },
      });

      await historyEntry.save();

      logger.info(`Price change recorded for product ${erp_sku}:`, {
        changeType,
        previousPrice: prices.previousPrice.amazon,
        newPrice: prices.appliedPrice,
        changedBy: execution.changedBy,
      });

      return historyEntry;
    } catch (error) {
      logger.error('Error recording price change:', error);
      throw error;
    }
  }

  /**
   * Registra cambio de PVPM
   */
  async recordPVPMChange(product, pvpmResult, options = {}) {
    try {
      const previousPvpm = product.pricing?.pvpm || 0;
      const newPvpm = pvpmResult.pvpm;

      // Solo registrar si hay cambio significativo
      if (Math.abs(newPvpm - previousPvpm) < 0.01) {
        return null;
      }

      const historyData = {
        productId: product._id,
        erp_sku: product.erp_sku,
        changeType: 'pvpm_recalculation',
        prices: {
          previousPrice: {
            pvpm: previousPvpm,
            amazon: product.amz_price || null,
          },
          newPrice: {
            pvpm: newPvpm,
            amazon: product.amz_price || null,
          },
          appliedPrice: newPvpm,
          priceSource: 'pvpm',
        },
        context: {
          trigger: options.trigger || 'manual_calculation',
          description: `PVPM recalculado: ${previousPvpm.toFixed(2)}€ → ${newPvpm.toFixed(2)}€. Breakdown: coste ${pvpmResult.breakdown.cost}€, margen ${(pvpmResult.breakdown.margin * 100).toFixed(1)}%, envío ${pvpmResult.breakdown.shippingCost}€`,
          strategy: 'follow_pvpm',
          metadata: {
            pvpmData: {
              costUsed: pvpmResult.breakdown.cost,
              marginUsed: pvpmResult.breakdown.margin,
              shippingCostUsed: pvpmResult.breakdown.shippingCost,
              calculationSource: options.trigger || 'manual',
            },
          },
        },
        execution: {
          changedBy: options.changedBy || 'system',
          actorType: options.changedBy === 'system' ? 'system' : 'user',
          status: 'applied',
        },
        references: {
          batchId: options.batchId || null,
        },
      };

      return await this.recordPriceChange(historyData);
    } catch (error) {
      logger.error(`Error recording PVPM change for product ${product.erp_sku}:`, error);
      throw error;
    }
  }

  /**
   * Registra cambio por competencia
   */
  async recordCompetitorChange(product, competitorData, priceStrategy, options = {}) {
    try {
      const previousCompetitorPrice = product.pricing?.competitorPrice || null;
      const newCompetitorPrice = competitorData.newPrice;
      const appliedPrice = priceStrategy.finalPrice;

      const historyData = {
        productId: product._id,
        erp_sku: product.erp_sku,
        changeType: 'competitor_response',
        prices: {
          previousPrice: {
            amazon: product.amz_price || null,
            competitor: previousCompetitorPrice,
          },
          newPrice: {
            amazon: appliedPrice,
            competitor: newCompetitorPrice,
          },
          appliedPrice: appliedPrice,
          priceSource: 'competitor_strategy',
        },
        context: {
          trigger: 'competitor_price_change',
          description: `Respuesta a cambio de competencia: ${previousCompetitorPrice?.toFixed(2) || 'N/A'}€ → ${newCompetitorPrice.toFixed(2)}€. Estrategia: ${priceStrategy.strategy}`,
          strategy: priceStrategy.strategy,
          metadata: {
            competitorData: {
              previousCompetitorPrice,
              newCompetitorPrice,
              hadBuybox: competitorData.hadBuybox || false,
              hasBuybox: competitorData.hasBuybox || false,
            },
          },
        },
        execution: {
          changedBy: options.changedBy || 'system',
          actorType: 'system',
          status: 'pending',
        },
      };

      return await this.recordPriceChange(historyData);
    } catch (error) {
      logger.error(`Error recording competitor change for product ${product.erp_sku}:`, error);
      throw error;
    }
  }

  /**
   * Registra establecimiento de precio fijo
   */
  async recordFixedPriceSet(product, fixedPriceData, options = {}) {
    try {
      const previousPrice = product.amz_price || 0;
      const fixedPrice = fixedPriceData.price;

      const historyData = {
        productId: product._id,
        erp_sku: product.erp_sku,
        changeType: 'fixed_price_set',
        prices: {
          previousPrice: {
            amazon: previousPrice,
            pvpm: product.pricing?.pvpm || null,
          },
          newPrice: {
            amazon: fixedPrice,
            fixed: fixedPrice,
          },
          appliedPrice: fixedPrice,
          priceSource: 'fixed_price',
        },
        context: {
          trigger: 'manual_fixed_price',
          description: `Precio fijo establecido: ${fixedPrice.toFixed(2)}€. Razón: ${fixedPriceData.reason || 'No especificada'}`,
          strategy: 'fixed_strategy',
          metadata: {
            fixedPriceData: {
              reason: fixedPriceData.reason || '',
              setBy: options.changedBy || 'unknown',
              expiresAt: fixedPriceData.expiresAt || null,
            },
          },
        },
        execution: {
          changedBy: options.changedBy || 'user',
          actorType: 'user',
          status: 'pending',
        },
      };

      return await this.recordPriceChange(historyData);
    } catch (error) {
      logger.error(`Error recording fixed price for product ${product.erp_sku}:`, error);
      throw error;
    }
  }

  /**
   * Registra cambio manual de precio
   */
  async recordManualPriceChange(product, newPrice, reason, options = {}) {
    try {
      const previousPrice = product.amz_price || 0;

      const historyData = {
        productId: product._id,
        erp_sku: product.erp_sku,
        changeType: 'manual_update',
        prices: {
          previousPrice: {
            amazon: previousPrice,
            pvpm: product.pricing?.pvpm || null,
          },
          newPrice: {
            amazon: newPrice,
          },
          appliedPrice: newPrice,
          priceSource: 'manual',
        },
        context: {
          trigger: 'manual_intervention',
          description: `Precio actualizado manualmente: ${previousPrice.toFixed(2)}€ → ${newPrice.toFixed(2)}€. Motivo: ${reason}`,
          strategy: 'manual_decision',
        },
        execution: {
          changedBy: options.changedBy || 'user',
          actorType: 'user',
          status: 'pending',
        },
      };

      return await this.recordPriceChange(historyData);
    } catch (error) {
      logger.error(`Error recording manual price change for product ${product.erp_sku}:`, error);
      throw error;
    }
  }

  /**
   * Registra cambio por configuración global
   */
  async recordConfigChange(products, configChanges, batchId, options = {}) {
    try {
      const historyEntries = [];

      for (const product of products) {
        const historyData = {
          productId: product._id,
          erp_sku: product.erp_sku,
          changeType: 'config_change',
          prices: {
            previousPrice: {
              amazon: product.amz_price || null,
              pvpm: product.pricing?.pvpm || null,
            },
            newPrice: {
              pvpm: product.pricing?.pvpm || null, // Será actualizado después del recálculo
            },
            appliedPrice: product.pricing?.pvpm || 0,
            priceSource: 'pvpm',
          },
          context: {
            trigger: 'global_config_update',
            description: `Recálculo por cambio de configuración: ${configChanges.changedFields.join(', ')}`,
            strategy: 'follow_pvpm',
            metadata: {
              configData: {
                changedFields: configChanges.changedFields,
                previousValues: configChanges.previousValues,
                newValues: configChanges.newValues,
              },
            },
          },
          execution: {
            changedBy: options.changedBy || 'system',
            actorType: 'system',
            status: 'applied',
          },
          references: {
            batchId: batchId,
          },
        };

        const historyEntry = await this.recordPriceChange(historyData);
        historyEntries.push(historyEntry);
      }

      logger.info(`Recorded config change history for ${historyEntries.length} products`, {
        batchId,
        changedFields: configChanges.changedFields,
      });

      return historyEntries;
    } catch (error) {
      logger.error('Error recording config change history:', error);
      throw error;
    }
  }

  /**
   * Actualiza el estado de una entrada de historial después de aplicar el cambio
   */
  async updateHistoryResult(historyId, result) {
    try {
      const historyEntry = await PriceHistory.findById(historyId);
      if (!historyEntry) {
        throw new Error('Historia no encontrada');
      }

      await historyEntry.markCompleted(result.success, result);

      logger.debug(`History entry updated: ${historyId}`, result);
      return historyEntry;
    } catch (error) {
      logger.error(`Error updating history result for ${historyId}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas del historial para un período
   */
  async getPeriodStats(startDate, endDate) {
    try {
      const stats = await PriceHistory.getStatsByPeriod(startDate, endDate);

      const summary = {
        totalChanges: 0,
        totalProducts: 0,
        changesByType: {},
        priceDirection: {
          increases: 0,
          decreases: 0,
          noChange: 0,
        },
        totalPriceImpact: 0,
      };

      for (const stat of stats) {
        summary.totalChanges += stat.totalChanges;
        summary.totalProducts += stat.uniqueProducts;
        summary.priceDirection.increases += stat.increases;
        summary.priceDirection.decreases += stat.decreases;
        summary.totalPriceImpact += stat.totalImpact;

        summary.changesByType[stat._id] = {
          totalChanges: stat.totalChanges,
          increases: stat.increases,
          decreases: stat.decreases,
          uniqueProducts: stat.uniqueProducts,
          totalImpact: stat.totalImpact,
        };
      }

      return summary;
    } catch (error) {
      logger.error('Error getting period stats:', error);
      throw error;
    }
  }

  /**
   * Obtiene el historial reciente con detalles
   */
  async getRecentHistory(limit = 50, filters = {}) {
    try {
      const query = {};

      // Aplicar filtros
      if (filters.changeType) {
        query.changeType = filters.changeType;
      }

      if (filters.productId) {
        query.productId = filters.productId;
      }

      if (filters.changedBy) {
        query['execution.changedBy'] = new RegExp(filters.changedBy, 'i');
      }

      if (filters.status) {
        query['execution.status'] = filters.status;
      }

      if (filters.dateFrom) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$gte = new Date(filters.dateFrom);
      }

      if (filters.dateTo) {
        query.createdAt = query.createdAt || {};
        query.createdAt.$lte = new Date(filters.dateTo);
      }

      const history = await PriceHistory.find(query)
        .populate('productId', 'erp_sku erp_name amz_title amz_asin')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return history.map((entry) => ({
        ...entry,
        product: entry.productId
          ? {
              erp_sku: entry.productId.erp_sku,
              erp_name: entry.productId.erp_name,
              amz_title: entry.productId.amz_title,
              amz_asin: entry.productId.amz_asin,
            }
          : null,
      }));
    } catch (error) {
      logger.error('Error getting recent history:', error);
      throw error;
    }
  }

  /**
   * Genera un ID único para operaciones en lote
   */
  generateBatchId(prefix = 'batch') {
    return `${prefix}_${uuidv4().split('-')[0]}_${Date.now()}`;
  }

  /**
   * Obtiene resumen de cambios por producto
   */
  async getProductSummary(productId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const changes = await PriceHistory.find({
        productId,
        createdAt: { $gte: startDate },
        'execution.status': 'applied',
      }).sort({ createdAt: -1 });

      const summary = {
        totalChanges: changes.length,
        priceDirection: {
          increases: 0,
          decreases: 0,
          noChange: 0,
        },
        changesByType: {},
        averageChangeAmount: 0,
        totalPriceImpact: 0,
        recentChanges: changes.slice(0, 10),
      };

      let totalImpact = 0;

      for (const change of changes) {
        // Contar dirección de precios
        summary.priceDirection[change.impact.priceDirection]++;

        // Contar por tipo
        summary.changesByType[change.changeType] =
          (summary.changesByType[change.changeType] || 0) + 1;

        // Sumar impacto
        totalImpact += change.impact.changeAmount;
      }

      summary.totalPriceImpact = totalImpact;
      summary.averageChangeAmount = changes.length > 0 ? totalImpact / changes.length : 0;

      return summary;
    } catch (error) {
      logger.error(`Error getting product summary for ${productId}:`, error);
      throw error;
    }
  }
}

module.exports = new HistoryService();
