import React, { useState, useEffect } from "react";
import {
  MdSettings,
  MdCalculate,
  MdLocalShipping,
  MdTrendingUp,
} from "react-icons/md";
import Button from "../common/Button";
import Input from "../common/Input";
import { pricingService } from "../../services/api";
import { formatCurrency } from "../../utils/formatters";
import "./PVPMConfigModal.css";

const PVPMConfigModal = ({ onClose, onUpdate, loading: modalLoading }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewValues, setPreviewValues] = useState({
    cost: 10,
    weight: 1,
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const configData = await pricingService.getConfig();
      setConfig(configData);
    } catch (error) {
      console.error("Error loading config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleShippingTableChange = (index, field, value) => {
    const newTable = [...config.shippingCostTable];
    newTable[index] = { ...newTable[index], [field]: parseFloat(value) || 0 };
    setConfig((prev) => ({
      ...prev,
      shippingCostTable: newTable,
    }));
  };

  const addShippingTier = () => {
    setConfig((prev) => ({
      ...prev,
      shippingCostTable: [...prev.shippingCostTable, { maxWeight: 0, cost: 0 }],
    }));
  };

  const removeShippingTier = (index) => {
    setConfig((prev) => ({
      ...prev,
      shippingCostTable: prev.shippingCostTable.filter((_, i) => i !== index),
    }));
  };

  const handleCompetitorSettingsChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      competitorSettings: {
        ...prev.competitorSettings,
        [field]: value,
      },
    }));
  };

  const calculatePreviewPVPM = () => {
    if (!config) return null;

    const cost = previewValues.cost;
    const margin = config.defaultMargin;
    const iva = config.defaultIva;

    // Calcular precio base
    const basePrice = cost / margin;
    const priceWithIVA = basePrice * (1 + iva);

    // Calcular envío
    let shippingCost = config.defaultShippingCost;
    const weight = previewValues.weight;

    for (const tier of config.shippingCostTable) {
      if (weight <= tier.maxWeight) {
        shippingCost = tier.cost;
        break;
      }
    }

    // Para >20kg
    if (weight > 20) {
      shippingCost = 9.25 + (weight - 20) * 0.47;
    }

    const pvpm = priceWithIVA + shippingCost;

    return {
      cost,
      margin,
      basePrice,
      iva,
      priceWithIVA,
      shippingCost,
      pvpm,
    };
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await pricingService.updateConfig(config);
      onUpdate?.();
      onClose();
    } catch (error) {
      console.error("Error saving config:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="pvpm-config-modal">
          <div className="modal-content">
            <div style={{ textAlign: "center", padding: "2rem" }}>
              Cargando configuración...
            </div>
          </div>
        </div>
      </div>
    );
  }

  const previewCalc = calculatePreviewPVPM();

  return (
    <div className="modal-overlay">
      <div className="pvpm-config-modal">
        <div className="modal-header">
          <h2>
            <MdSettings />
            Configuración de PVPM
          </h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          {/* Configuración Global */}
          <div className="global-config">
            <div className="config-section-title">
              <MdSettings />
              Configuración Global
            </div>
            <div className="config-grid">
              <Input
                label="Margen por defecto"
                type="number"
                step="0.01"
                min="0.1"
                max="0.9"
                value={config.defaultMargin}
                onChange={(e) =>
                  handleConfigChange(
                    "defaultMargin",
                    parseFloat(e.target.value)
                  )
                }
              />
              <Input
                label="IVA por defecto"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={config.defaultIva}
                onChange={(e) =>
                  handleConfigChange("defaultIva", parseFloat(e.target.value))
                }
              />
              <Input
                label="Coste envío por defecto (€)"
                type="number"
                step="0.01"
                min="0"
                value={config.defaultShippingCost}
                onChange={(e) =>
                  handleConfigChange(
                    "defaultShippingCost",
                    parseFloat(e.target.value)
                  )
                }
              />
            </div>
          </div>

          {/* Tabla de Costes de Envío */}
          <div className="shipping-table">
            <div className="config-section-title">
              <MdLocalShipping />
              Tabla de Costes de Envío (GLS)
            </div>
            <div className="shipping-table-container">
              <table>
                <thead>
                  <tr>
                    <th>Peso máximo (kg)</th>
                    <th>Coste (€)</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {config.shippingCostTable.map((tier, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="number"
                          value={tier.maxWeight}
                          onChange={(e) =>
                            handleShippingTableChange(
                              index,
                              "maxWeight",
                              e.target.value
                            )
                          }
                          min="0"
                          step="0.1"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={tier.cost}
                          onChange={(e) =>
                            handleShippingTableChange(
                              index,
                              "cost",
                              e.target.value
                            )
                          }
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td>
                        <button
                          className="remove-shipping-btn"
                          onClick={() => removeShippingTier(index)}
                          title="Eliminar"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button
                variant="outlined"
                className="add-shipping-btn"
                onClick={addShippingTier}
              >
                Añadir Rango
              </Button>
            </div>
          </div>

          {/* Configuración de Competencia */}
          <div className="competitor-config">
            <div className="config-section-title">
              <MdTrendingUp />
              Configuración de Competencia
            </div>
            <div className="config-grid">
              <Input
                label="Frecuencia actualización (min)"
                type="number"
                min="1"
                value={config.competitorSettings.priceUpdateFrequency}
                onChange={(e) =>
                  handleCompetitorSettingsChange(
                    "priceUpdateFrequency",
                    parseInt(e.target.value)
                  )
                }
              />
              <Input
                label="Diferencia mínima preferida (€)"
                type="number"
                step="0.01"
                min="0"
                value={config.competitorSettings.minPriceDifference}
                onChange={(e) =>
                  handleCompetitorSettingsChange(
                    "minPriceDifference",
                    parseFloat(e.target.value)
                  )
                }
              />
              <Input
                label="Diferencia fallback (€)"
                type="number"
                step="0.01"
                min="0.01"
                value={config.competitorSettings.fallbackDifference}
                onChange={(e) =>
                  handleCompetitorSettingsChange(
                    "fallbackDifference",
                    parseFloat(e.target.value)
                  )
                }
              />
            </div>
          </div>

          {/* Vista Previa de Cálculo */}
          <div className="pvpm-preview">
            <div className="config-section-title">
              <MdCalculate />
              Vista Previa de Cálculo PVPM
            </div>
            <div className="config-grid" style={{ marginBottom: "1rem" }}>
              <Input
                label="Coste ejemplo (€)"
                type="number"
                step="0.01"
                min="0.01"
                value={previewValues.cost}
                onChange={(e) =>
                  setPreviewValues((prev) => ({
                    ...prev,
                    cost: parseFloat(e.target.value) || 0,
                  }))
                }
              />
              <Input
                label="Peso ejemplo (kg)"
                type="number"
                step="0.1"
                min="0"
                value={previewValues.weight}
                onChange={(e) =>
                  setPreviewValues((prev) => ({
                    ...prev,
                    weight: parseFloat(e.target.value) || 0,
                  }))
                }
              />
            </div>

            {previewCalc && (
              <div className="preview-calculation">
                <div className="calculation-step">
                  <div className="calculation-label">Coste</div>
                  <div className="calculation-value">
                    {formatCurrency(previewCalc.cost)}
                  </div>
                </div>
                <div className="calculation-step">
                  <div className="calculation-label">
                    ÷ Margen ({(previewCalc.margin * 100).toFixed(0)}%)
                  </div>
                  <div className="calculation-value">
                    {formatCurrency(previewCalc.basePrice)}
                  </div>
                </div>
                <div className="calculation-step">
                  <div className="calculation-label">
                    + IVA ({(previewCalc.iva * 100).toFixed(0)}%)
                  </div>
                  <div className="calculation-value">
                    {formatCurrency(previewCalc.priceWithIVA)}
                  </div>
                </div>
                <div className="calculation-step">
                  <div className="calculation-label">+ Envío</div>
                  <div className="calculation-value">
                    {formatCurrency(previewCalc.shippingCost)}
                  </div>
                </div>
                <div className="calculation-step pvpm-result">
                  <div className="calculation-label">PVPM Final</div>
                  <div className="calculation-value">
                    {formatCurrency(previewCalc.pvpm)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="modal-actions">
            <Button
              type="button"
              variant="outlined"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="filled"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar Configuración"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PVPMConfigModal;
