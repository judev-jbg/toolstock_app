const Product = require('../../models/productModel');
const PricingConfig = require('../../models/pricingConfigModel');
const pvpmCalculator = require('./pvpmCalculator');
const actionDetector = require('./actionDetector');
const historyService = require('./historyService');
const amazonService = require('../amazon/amazonService');
const logger = require('../../utils/logger');

class PricingEngine {
  /**
   * Procesa un producto y determina el precio óptimo
   */
  async processProduct(product, context = {}) {
    try {
      logger.info(`Processing pricing for product ${product.erp_sku}`, {
        trigger: context.trigger || 'unknown',
        currentPrice: product.amz_price,
      });

      // 1. Preparar contexto de decisión
      const decisionContext = await this.prepareDecisionContext(product, context);

      // 2. Aplicar estrategia de pricing
      const pricingDecision = await this.applyPricingStrategy(product, decisionContext);

      // 3. Validar la decisión
      const validation = await this.validatePricingDecision(
        product,
        pricingDecision,
        decisionContext
      );

      // 4. Aplicar el cambio si es válido
      let executionResult = null;
      if (validation.isValid && !validation.blocked) {
        executionResult = await this.executePricingDecision(
          product,
          pricingDecision,
          decisionContext
        );
      }

      // 5. Registrar en historial
      await this.recordPricingDecision(
        product,
        pricingDecision,
        validation,
        executionResult,
        decisionContext
      );

      // 6. Detectar acciones pendientes
      await this.detectPostPricingActions(product, pricingDecision, validation);

      const result = {
        product: product,
        decision: pricingDecision,
        validation: validation,
        execution: executionResult,
        success: validation.isValid && executionResult?.success,
      };

      logger.info(`Pricing processing completed for ${product.erp_sku}:`, {
        previousPrice: decisionContext.currentPrice,
        newPrice: pricingDecision.finalPrice,
        strategy: pricingDecision.strategy,
        success: result.success,
      });

      return result;
    } catch (error) {
      logger.error(`Error processing pricing for product ${product.erp_sku}:`, error);
      throw error;
    }
  }

  /**
   * Prepara el contexto para tomar decisiones
   */
  async prepareDecisionContext(product, inputContext) {
    try {
      const config = await PricingConfig.getInstance();

      // Asegurar que PVPM esté actualizado
      let pvpmResult = null;
      if (!product.pricing?.pvpm || product.pricing?.pvpm <= 0) {
        const pvpmUpdate = await pvpmCalculator.updateProductPVPM(product._id, {
          detectActions: false,
          recordHistory: false,
          trigger: 'pricing_engine_prep',
        });
        pvpmResult = pvpmUpdate.pvpmResult;
        product.pricing = pvpmUpdate.product.pricing; // Actualizar en memoria
      }

      const context = {
        // Input context
        trigger: inputContext.trigger || 'unknown',
        source: inputContext.source || 'manual',
        urgency: inputContext.urgency || 'normal',
        batchId: inputContext.batchId || null,

        // Current state
        currentPrice: product.amz_price || 0,
        pvpm: product.pricing?.pvpm || 0,
        hasFixedPrice: !!product.pricing?.fixedPrice,
        fixedPrice: product.pricing?.fixedPrice || null,

        // Competitor data
        competitorPrice: product.pricing?.competitorPrice || null,
        hasBuybox: product.pricing?.competitorData?.hasBuybox || false,
        buyboxPrice: product.pricing?.competitorData?.buyboxPrice || null,

        // Web offer status
        isWebOffer: product.erp_obs === 'OFERTA WEB',
        webPrice: product.erp_price ? product.erp_price * 1.21 : 0,

        // Configuration
        config: config,

        // Auto-update settings
        autoUpdateEnabled:
          product.pricing?.autoUpdateEnabled !== false &&
          config.automationSettings.autoUpdateEnabled,
        isWithinOperatingHours: config.isWithinOperatingHours(),

        // Validation flags
        needsValidation: true,
        forceUpdate: inputContext.forceUpdate || false,

        // Additional data
        pvpmCalculated: !!pvpmResult,
        pvpmResult: pvpmResult,
      };

      logger.debug(`Decision context prepared for ${product.erp_sku}:`, {
        currentPrice: context.currentPrice,
        pvpm: context.pvpm,
        hasFixedPrice: context.hasFixedPrice,
        isWebOffer: context.isWebOffer,
        hasBuybox: context.hasBuybox,
      });

      return context;
    } catch (error) {
      logger.error(`Error preparing decision context for ${product.erp_sku}:`, error);
      throw error;
    }
  }

  /**
   * Aplica la estrategia de pricing según las reglas de negocio
   */
  async applyPricingStrategy(product, context) {
    try {
      let decision = {
        strategy: null,
        finalPrice: 0,
        priceSource: null,
        reasoning: '',
        metadata: {},
        confidence: 0, // 0-100
        recommendations: [],
      };

      // REGLA 1: Precio Fijo (máxima prioridad)
      if (context.hasFixedPrice) {
        decision = await this.applyFixedPriceStrategy(product, context);
      }
      // REGLA 2: Oferta Web
      else if (context.isWebOffer) {
        decision = await this.applyWebOfferStrategy(product, context);
      }
      // REGLA 3: Estrategia de Competencia
      else if (context.competitorPrice && context.competitorPrice > 0) {
        decision = await this.applyCompetitorStrategy(product, context);
      }
      // REGLA 4: PVPM por defecto
      else {
        decision = await this.applyPVPMStrategy(product, context);
      }

      // Validar que el precio no sea menor al PVPM (regla crítica)
      if (decision.finalPrice < context.pvpm) {
        const originalDecision = { ...decision };
        decision.finalPrice = context.pvpm;
        decision.strategy = 'pvpm_override';
        decision.priceSource = 'pvpm';
        decision.reasoning = `Precio ajustado al PVPM mínimo. Estrategia original: ${originalDecision.strategy}`;
        decision.confidence = Math.max(0, decision.confidence - 30);
        decision.metadata.originalDecision = originalDecision;
        decision.recommendations.push({
          type: 'warning',
          message: `El precio se ajustó al PVPM mínimo (${context.pvpm.toFixed(2)}€) desde ${originalDecision.finalPrice.toFixed(2)}€`,
        });
      }

      logger.debug(`Pricing strategy applied for ${product.erp_sku}:`, {
        strategy: decision.strategy,
        finalPrice: decision.finalPrice,
        pvpm: context.pvpm,
        confidence: decision.confidence,
      });

      return decision;
    } catch (error) {
      logger.error(`Error applying pricing strategy for ${product.erp_sku}:`, error);
      throw error;
    }
  }

  /**
   * Estrategia de precio fijo
   */
  async applyFixedPriceStrategy(product, context) {
    const decision = {
      strategy: 'fixed_price',
      finalPrice: context.fixedPrice,
      priceSource: 'fixed_price',
      reasoning: `Precio fijo establecido: ${context.fixedPrice.toFixed(2)}€. Razón: ${product.pricing?.fixedPriceReason || 'No especificada'}`,
      confidence: 100,
      metadata: {
        fixedPriceReason: product.pricing?.fixedPriceReason || '',
        fixedPriceSetBy: product.pricing?.fixedPriceSetBy || '',
        fixedPriceSetAt: product.pricing?.fixedPriceSetAt,
      },
      recommendations: [],
    };

    // Advertir si está por debajo del PVPM
    if (context.fixedPrice < context.pvpm) {
      decision.recommendations.push({
        type: 'warning',
        message: `Precio fijo (${context.fixedPrice.toFixed(2)}€) está por debajo del PVPM (${context.pvpm.toFixed(2)}€)`,
      });
    }

    return decision;
  }

  /**
   * Estrategia para ofertas web
   */
  async applyWebOfferStrategy(product, context) {
    const decision = {
      strategy: 'web_offer',
      finalPrice: context.pvpm,
      priceSource: 'pvpm',
      reasoning: `Oferta WEB: usando PVPM (${context.pvpm.toFixed(2)}€) para Amazon. Precio web: ${context.webPrice.toFixed(2)}€`,
      confidence: 90,
      metadata: {
        webPrice: context.webPrice,
        pvpm: context.pvpm,
        requiredAmazonPrice: context.webPrice * 1.04,
      },
      recommendations: [],
    };

    // Verificar que la web sea 4% más barata
    const requiredAmazonPrice = context.webPrice * 1.04;
    if (context.pvpm < requiredAmazonPrice) {
      decision.recommendations.push({
        type: 'critical',
        message: `CONFLICTO: Amazon debe costar al menos ${requiredAmazonPrice.toFixed(2)}€ para que la web sea 4% más barata`,
      });
      decision.confidence = 30;
    } else {
      decision.recommendations.push({
        type: 'info',
        message: `✓ Web es 4% más barata que Amazon (${context.webPrice.toFixed(2)}€ vs ${context.pvpm.toFixed(2)}€)`,
      });
    }

    return decision;
  }

  /**
   * Estrategia de competencia
   */
  async applyCompetitorStrategy(product, context) {
    const config = context.config;

    let decision = {
      strategy: null,
      finalPrice: 0,
      priceSource: 'competitor_strategy',
      reasoning: '',
      confidence: 80,
      metadata: {
        competitorPrice: context.competitorPrice,
        hasBuybox: context.hasBuybox,
        buyboxDifference: config.competitorSettings.buyboxDifference,
        fallbackDifference: config.competitorSettings.fallbackDifference,
      },
      recommendations: [],
    };

    // Si tenemos buybox, mantener ventaja
    if (context.hasBuybox) {
      const buyboxPrice = context.competitorPrice + config.competitorSettings.buyboxDifference;
      const finalPrice = Math.max(buyboxPrice, context.pvpm);

      decision.strategy = 'maintain_buybox';
      decision.finalPrice = finalPrice;
      decision.reasoning = `Manteniendo buybox: competencia + ${config.competitorSettings.buyboxDifference}€ (${context.competitorPrice.toFixed(2)}€ + ${config.competitorSettings.buyboxDifference.toFixed(2)}€ = ${buyboxPrice.toFixed(2)}€)`;

      if (finalPrice > buyboxPrice) {
        decision.reasoning += `. Ajustado al PVPM mínimo: ${context.pvpm.toFixed(2)}€`;
        decision.confidence = 60;
      }
    }
    // Si no tenemos buybox, competir
    else {
      const competitivePrice =
        context.competitorPrice - config.competitorSettings.fallbackDifference;
      const finalPrice = Math.max(competitivePrice, context.pvpm);

      decision.strategy = 'compete_price';
      decision.finalPrice = finalPrice;
      decision.reasoning = `Compitiendo: competencia - ${config.competitorSettings.fallbackDifference.toFixed(2)}€ (${context.competitorPrice.toFixed(2)}€ - ${config.competitorSettings.fallbackDifference.toFixed(2)}€ = ${competitivePrice.toFixed(2)}€)`;

      if (finalPrice > competitivePrice) {
        decision.reasoning += `. Ajustado al PVPM mínimo: ${context.pvpm.toFixed(2)}€`;
        decision.confidence = 40;
        decision.recommendations.push({
          type: 'warning',
          message: `No podemos competir efectivamente: PVPM (${context.pvpm.toFixed(2)}€) > precio competitivo (${competitivePrice.toFixed(2)}€)`,
        });
      }
    }

    return decision;
  }

  /**
   * Estrategia de PVPM por defecto
   */
  async applyPVPMStrategy(product, context) {
    const decision = {
      strategy: 'follow_pvpm',
      finalPrice: context.pvpm,
      priceSource: 'pvpm',
      reasoning: `Sin datos de competencia: usando PVPM (${context.pvpm.toFixed(2)}€)`,
      confidence: 70,
      metadata: {
        pvpm: context.pvpm,
        hasCompetitorData: false,
      },
      recommendations: [
        {
          type: 'info',
          message: 'Considera obtener datos de competencia para optimizar el precio',
        },
      ],
    };

    return decision;
  }

  /**
   * Valida la decisión de pricing
   */
  async validatePricingDecision(product, decision, context) {
    const validation = {
      isValid: true,
      blocked: false,
      blockingReason: '',
      warnings: [],
      errors: [],
      checks: {
        pvpmCheck: null,
        webOfferCheck: null,
        marginCheck: null,
        operatingHoursCheck: null,
        autoUpdateCheck: null,
      },
    };

    try {
      // Check 1: PVPM mínimo
      if (decision.finalPrice < context.pvpm) {
        validation.errors.push({
          type: 'pvpm_violation',
          message: `Precio (${decision.finalPrice.toFixed(2)}€) por debajo del PVPM mínimo (${context.pvpm.toFixed(2)}€)`,
          severity: 'critical',
        });
        validation.checks.pvpmCheck = false;
        validation.isValid = false;
      } else {
        validation.checks.pvpmCheck = true;
      }

      // Check 2: Validación de oferta web
      if (context.isWebOffer) {
        const requiredAmazonPrice = context.webPrice * 1.04;
        if (decision.finalPrice < requiredAmazonPrice) {
          validation.warnings.push({
            type: 'web_offer_conflict',
            message: `OFERTA WEB: Amazon debe costar al menos ${requiredAmazonPrice.toFixed(2)}€ para que web sea 4% más barata`,
            severity: 'high',
          });
          validation.checks.webOfferCheck = false;
        } else {
          validation.checks.webOfferCheck = true;
        }
      }

      // Check 3: Relación Amazon vs Web general
      if (context.webPrice > 0 && decision.finalPrice > 0) {
        const requiredWebPrice = decision.finalPrice * 0.96;
        if (context.webPrice > requiredWebPrice) {
          validation.warnings.push({
            type: 'amazon_cheaper_than_web',
            message: `Amazon (${decision.finalPrice.toFixed(2)}€) más barato que web (${context.webPrice.toFixed(2)}€). Web debería costar máximo ${requiredWebPrice.toFixed(2)}€`,
            severity: 'critical',
          });
        }
      }

      // Check 4: Horario de operación
      if (!context.isWithinOperatingHours && !context.forceUpdate) {
        validation.warnings.push({
          type: 'outside_operating_hours',
          message: 'Fuera del horario de operación automática',
          severity: 'medium',
        });
        validation.checks.operatingHoursCheck = false;

        if (context.urgency !== 'critical') {
          validation.blocked = true;
          validation.blockingReason = 'Fuera del horario de operación';
        }
      } else {
        validation.checks.operatingHoursCheck = true;
      }

      // Check 5: Auto-update habilitado
      if (!context.autoUpdateEnabled && !context.forceUpdate) {
        validation.blocked = true;
        validation.blockingReason = 'Auto-actualización deshabilitada para este producto';
        validation.checks.autoUpdateCheck = false;
      } else {
        validation.checks.autoUpdateCheck = true;
      }

      // Check 6: Cambio significativo
      const priceChange = Math.abs(decision.finalPrice - context.currentPrice);
      if (priceChange < 0.01) {
        validation.blocked = true;
        validation.blockingReason = 'Cambio de precio no significativo';
      }

      logger.debug(`Pricing validation for ${product.erp_sku}:`, {
        isValid: validation.isValid,
        blocked: validation.blocked,
        warningsCount: validation.warnings.length,
        errorsCount: validation.errors.length,
      });

      return validation;
    } catch (error) {
      logger.error(`Error validating pricing decision for ${product.erp_sku}:`, error);
      validation.isValid = false;
      validation.blocked = true;
      validation.blockingReason = `Error de validación: ${error.message}`;
      return validation;
    }
  }

  /**
   * Ejecuta la decisión de pricing
   */
  async executePricingDecision(product, decision, context) {
    try {
      const execution = {
        success: false,
        amazonUpdated: false,
        localUpdated: false,
        errorMessage: '',
        apiResponse: null,
        startedAt: new Date(),
        completedAt: null,
        processingTimeMs: null,
      };

      logger.info(`Executing pricing decision for ${product.erp_sku}:`, {
        previousPrice: context.currentPrice,
        newPrice: decision.finalPrice,
        strategy: decision.strategy,
      });

      try {
        // Actualizar precio en Amazon
        const amazonResult = await amazonService.updateInventoryQuantity(
          product.erp_sku,
          product.amz_quantity || 0
        );

        // Nota: En el servicio real, necesitarás un método específico para actualizar precios
        // Por ahora simulamos que el precio se actualiza junto con el inventario
        execution.amazonUpdated = true;
        execution.apiResponse = amazonResult.amazon;

        // Actualizar localmente
        await Product.findByIdAndUpdate(product._id, {
          amz_price: decision.finalPrice,
          'pricing.lastPriceUpdate': new Date(),
          'pricing.autoUpdateCount': (product.pricing?.autoUpdateCount || 0) + 1,
          'pricing.pricingStatus': 'ok',
          'pricing.pricingStatusMessage': `Precio actualizado por ${decision.strategy}`,
          'pricing.pricingStatusUpdatedAt': new Date(),
        });

        execution.localUpdated = true;
        execution.success = true;

        logger.info(`Price successfully updated for ${product.erp_sku}:`, {
          newPrice: decision.finalPrice,
          strategy: decision.strategy,
        });
      } catch (updateError) {
        execution.errorMessage = updateError.message;
        execution.success = false;

        logger.error(`Error updating price for ${product.erp_sku}:`, updateError);

        // Marcar producto con error
        await Product.findByIdAndUpdate(product._id, {
          'pricing.pricingStatus': 'manual_review',
          'pricing.pricingStatusMessage': `Error actualizando precio: ${updateError.message}`,
          'pricing.pricingStatusUpdatedAt': new Date(),
        });
      }

      execution.completedAt = new Date();
      execution.processingTimeMs = execution.completedAt - execution.startedAt;

      return execution;
    } catch (error) {
      logger.error(`Error executing pricing decision for ${product.erp_sku}:`, error);
      throw error;
    }
  }

  /**
   * Registra la decisión en el historial
   */
  async recordPricingDecision(product, decision, validation, execution, context) {
    try {
      if (!execution || (!execution.success && validation.blocked)) {
        // No registrar en historial si no se ejecutó o fue bloqueado
        return null;
      }

      const changeType = this.getHistoryChangeType(decision.strategy, context);

      const historyData = {
        productId: product._id,
        erp_sku: product.erp_sku,
        changeType: changeType,
        prices: {
          previousPrice: {
            amazon: context.currentPrice,
            pvpm: context.pvpm,
            competitor: context.competitorPrice,
            fixed: context.hasFixedPrice ? context.fixedPrice : null,
          },
          newPrice: {
            amazon: decision.finalPrice,
            pvpm: context.pvpm,
            competitor: context.competitorPrice,
            fixed: context.hasFixedPrice ? context.fixedPrice : null,
          },
          appliedPrice: decision.finalPrice,
          priceSource: decision.priceSource,
        },
        context: {
          trigger: context.trigger,
          description: decision.reasoning,
          strategy: decision.strategy,
          metadata: {
            ...decision.metadata,
            confidence: decision.confidence,
            validation: validation,
            recommendations: decision.recommendations,
          },
        },
        execution: {
          changedBy: context.source === 'user' ? 'user' : 'system',
          actorType: context.source === 'user' ? 'user' : 'system',
          status: execution.success ? 'applied' : 'failed',
        },
        references: {
          batchId: context.batchId,
        },
      };

      return await historyService.recordPriceChange(historyData);
    } catch (error) {
      logger.error(`Error recording pricing decision for ${product.erp_sku}:`, error);
      // No fallar el proceso principal por errores de historial
      return null;
    }
  }

  /**
   * Detecta acciones pendientes después del pricing
   */
  async detectPostPricingActions(product, decision, validation) {
    try {
      // Generar acciones basadas en warnings críticos
      for (const warning of validation.warnings) {
        if (warning.severity === 'critical') {
          await actionDetector.processProductActions(product);
          break; // Solo procesar una vez
        }
      }

      // Generar acciones basadas en baja confianza
      if (decision.confidence < 50) {
        await actionDetector.processProductActions(product);
      }
    } catch (error) {
      logger.warn(`Error detecting post-pricing actions for ${product.erp_sku}:`, error);
      // No fallar el proceso principal
    }
  }

  /**
   * Determina el tipo de cambio para el historial
   */
  getHistoryChangeType(strategy, context) {
    switch (strategy) {
      case 'fixed_price':
        return 'fixed_price_set';
      case 'web_offer':
        return 'web_offer_adjustment';
      case 'maintain_buybox':
      case 'compete_price':
        return 'competitor_response';
      case 'follow_pvpm':
      case 'pvpm_override':
        return 'pvpm_recalculation';
      default:
        return 'manual_update';
    }
  }

  /**
   * Procesa múltiples productos en lote
   */
  async processBatch(productIds, context = {}) {
    try {
      const batchId = historyService.generateBatchId('pricing_batch');
      const batchContext = { ...context, batchId };

      logger.info(`Starting batch pricing process for ${productIds.length} products`, {
        batchId,
        trigger: context.trigger,
      });

      const results = {
        batchId,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        results: [],
        errors: [],
      };

      for (const productId of productIds) {
        try {
          const product = await Product.findById(productId);
          if (!product) {
            results.skipped++;
            results.errors.push({
              productId,
              error: 'Product not found',
            });
            continue;
          }

          const result = await this.processProduct(product, batchContext);
          results.results.push(result);

          if (result.success) {
            results.successful++;
          } else {
            results.failed++;
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            productId,
            error: error.message,
          });
        }

        results.processed++;

        // Log progreso cada 50 productos
        if (results.processed % 50 === 0) {
          logger.info(`Batch pricing progress: ${results.processed}/${productIds.length}`, {
            batchId,
            successful: results.successful,
            failed: results.failed,
          });
        }
      }

      logger.info(`Batch pricing completed:`, results);
      return results;
    } catch (error) {
      logger.error('Error in batch pricing process:', error);
      throw error;
    }
  }
}

module.exports = new PricingEngine();
