import React, { useState, useEffect } from "react";
import {
  MdSettings,
  MdCalculate,
  MdAttachMoney,
  MdWarning,
  MdInfo,
} from "react-icons/md";
import Button from "../common/Button";
import Input from "../common/Input";
import { pricingService } from "../../services/api";
import { formatCurrency } from "../../utils/formatters";
import "./ProductPricingModal.css";

const ProductPricingModal = ({
  product,
  onClose,
  onUpdate,
  loading: modalLoading,
}) => {
  const [settings, setSettings] = useState({
    customCost: product.pricing?.customCost || "",
    customMargin: product.pricing?.customMargin || "",
    customShippingCost: product.pricing?.customShippingCost || "",
    autoUpdateEnabled: product.pricing?.autoUpdateEnabled !== false,
  });

  const [fixedPrice, setFixedPrice] = useState({
    price: product.pricing?.fixedPrice || "",
    reason: product.pricing?.fixedPriceReason || "",
  });

  const [pvpmInfo, setPvpmInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    calculatePVPM();
  }, [settings]);

  const calculatePVPM = async () => {
    try {
      const result = await pricingService.calculatePVPM(product._id);
      setPvpmInfo(result);
    } catch (error) {
      console.error("Error calculating PVPM:", error);
    }
  };

  const handleSettingsChange = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value === "" ? null : value,
    }));
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await pricingService.updateProductSettings(product._id, settings);
      onUpdate?.();
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSetFixedPrice = async () => {
    try {
      setSaving(true);
      await pricingService.setFixedPrice(
        product._id,
        fixedPrice.price || null,
        fixedPrice.reason
      );
      onUpdate?.();
    } catch (error) {
      console.error("Error setting fixed price:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFixedPrice = async () => {
    try {
      setSaving(true);
      await pricingService.setFixedPrice(product._id, null, "");
      setFixedPrice({ price: "", reason: "" });
      onUpdate?.();
    } catch (error) {
      console.error("Error removing fixed price:", error);
    } finally {
      setSaving(false);
    }
  };

  const currentValues = {
    cost: settings.customCost || product.erp_cost || 0,
    margin: settings.customMargin || 0.75,
    shippingCost: settings.customShippingCost || 10,
    weight: product.erp_weight || 0,
    currentPrice: product.amz_price || 0,
    webPrice: product.erp_price || 0,
    pvpm: pvpmInfo?.pvpm || 0,
  };

  const webAmazonCheck =
    currentValues.webPrice > 0 && currentValues.currentPrice > 0
      ? currentValues.currentPrice >= currentValues.webPrice * 1.21 * 1.04
      : null;

  return (
    <div className="modal-overlay">
      <div className="product-pricing-modal">
        <div className="modal-header">
          <div className="product-info-header">
            <div className="product-sku">{product.erp_sku}</div>
            <div className="product-name">
              {product.erp_name || product.amz_title}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          {/* Valores Actuales */}
          <div className="current-values">
            <h3>Estado Actual</h3>
            <div className="value-row">
              <span className="value-label">Precio Amazon:</span>
              <span className="value-amount">
                {formatCurrency(currentValues.currentPrice)}
              </span>
            </div>
            <div className="value-row">
              <span className="value-label">Precio WEB (ERP):</span>
              <span className="value-amount">
                {formatCurrency(currentValues.webPrice * 1.21)}
              </span>
            </div>
            <div className="value-row">
              <span className="value-label">PVPM Calculado:</span>
              <span className="value-amount">
                {formatCurrency(currentValues.pvpm)}
              </span>
            </div>
            <div className="value-row">
              <span className="value-label">Amazon vs WEB:</span>
              <span
                className="value-amount"
                style={{
                  color:
                    webAmazonCheck === true
                      ? "var(--success-color)"
                      : webAmazonCheck === false
                      ? "var(--danger-color)"
                      : "var(--text-light)",
                }}
              >
                {webAmazonCheck === true
                  ? "✓ Correcto (+4%)"
                  : webAmazonCheck === false
                  ? "✗ Amazon más barato"
                  : "Sin datos"}
              </span>
            </div>
          </div>

          {/* Configuración en Grid */}
          <div className="pricing-sections">
            {/* Campos Auxiliares */}
            <div className="pricing-section">
              <div className="section-title">
                <MdSettings />
                Configuración Personalizada
              </div>

              <Input
                label="Coste personalizado (€)"
                type="number"
                step="0.01"
                min="0"
                icon="€"
                value={settings.customCost}
                onChange={(e) =>
                  handleSettingsChange("customCost", e.target.value)
                }
              />

              <Input
                label="Margen personalizado"
                type="number"
                step="0.01"
                min="0.1"
                max="0.9"
                icon="€"
                value={settings.customMargin}
                onChange={(e) =>
                  handleSettingsChange("customMargin", e.target.value)
                }
              />

              <Input
                label="Coste envío personalizado (€)"
                type="number"
                step="0.01"
                min="0"
                icon="€"
                value={settings.customShippingCost}
                onChange={(e) =>
                  handleSettingsChange("customShippingCost", e.target.value)
                }
              />

              <div style={{ marginTop: "1rem" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={settings.autoUpdateEnabled}
                    onChange={(e) =>
                      handleSettingsChange(
                        "autoUpdateEnabled",
                        e.target.checked
                      )
                    }
                  />
                  <span>Actualización automática habilitada</span>
                </label>
              </div>

              <Button
                variant="outlined"
                onClick={handleSaveSettings}
                disabled={saving}
                style={{ marginTop: "1rem", width: "100%" }}
              >
                {saving ? "Guardando..." : "Guardar Configuración"}
              </Button>
            </div>

            {/* PVPM Info */}
            <div className="pricing-section">
              <div className="section-title">
                <MdCalculate />
                Cálculo PVPM
              </div>

              {pvpmInfo && (
                <div>
                  <div className="value-row">
                    <span className="value-label">Coste utilizado:</span>
                    <span className="value-amount">
                      {formatCurrency(pvpmInfo.breakdown.cost)}
                    </span>
                  </div>
                  <div className="value-row">
                    <span className="value-label">Margen aplicado:</span>
                    <span className="value-amount">
                      {(pvpmInfo.breakdown.margin * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="value-row">
                    <span className="value-label">+ IVA (21%):</span>
                    <span className="value-amount">
                      {formatCurrency(pvpmInfo.breakdown.priceWithIVA)}
                    </span>
                  </div>
                  <div className="value-row">
                    <span className="value-label">+ Envío:</span>
                    <span className="value-amount">
                      {formatCurrency(pvpmInfo.breakdown.shippingCost)}
                    </span>
                  </div>
                  <div
                    className="value-row"
                    style={{
                      borderTop: "2px solid var(--primary-color)",
                      paddingTop: "0.5rem",
                    }}
                  >
                    <span className="value-label">
                      <strong>PVPM Final:</strong>
                    </span>
                    <span
                      className="value-amount"
                      style={{
                        color: "var(--primary-color)",
                        fontWeight: "700",
                      }}
                    >
                      {formatCurrency(pvpmInfo.pvpm)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Precio Fijo */}
            <div className="pricing-section fixed-price-section">
              <div className="section-title">
                <MdAttachMoney />
                Precio Fijo (Prevalece sobre PVPM)
              </div>

              {product.pricing?.fixedPrice > 0 && (
                <div className="fixed-price-warning">
                  <MdWarning style={{ color: "var(--warning-color)" }} />
                  <div>
                    <strong>
                      Precio fijo activo:{" "}
                      {formatCurrency(product.pricing.fixedPrice)}
                    </strong>
                    <br />
                    <small>{product.pricing.fixedPriceReason}</small>
                  </div>
                </div>
              )}

              <div className="fixed-price-form">
                <Input
                  label="Precio fijo (€)"
                  type="number"
                  step="0.01"
                  min="0"
                  icon="€"
                  value={fixedPrice.price}
                  onChange={(e) =>
                    setFixedPrice((prev) => ({
                      ...prev,
                      price: e.target.value,
                    }))
                  }
                />

                <Input
                  label="Razón comercial"
                  type="text"
                  icon="€"
                  value={fixedPrice.reason}
                  onChange={(e) =>
                    setFixedPrice((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                />
              </div>

              <div
                style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}
              >
                <Button
                  variant="filled"
                  onClick={handleSetFixedPrice}
                  disabled={saving || !fixedPrice.price || !fixedPrice.reason}
                  style={{ flex: 1 }}
                >
                  {saving ? "Guardando..." : "Establecer Precio Fijo"}
                </Button>

                {product.pricing?.fixedPrice > 0 && (
                  <Button
                    variant="outlined"
                    onClick={handleRemoveFixedPrice}
                    disabled={saving}
                    style={{ flex: 1 }}
                  >
                    Remover Precio Fijo
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Información adicional */}
          <div
            style={{
              background: "rgba(33, 150, 243, 0.1)",
              border: "1px solid #2196f3",
              borderRadius: "3px",
              padding: "1rem",
              marginTop: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
              }}
            >
              <MdInfo
                style={{
                  color: "#2196f3",
                  fontSize: "1.25rem",
                  marginTop: "0.125rem",
                }}
              />
              <div style={{ fontSize: "0.875rem", lineHeight: "1.4" }}>
                <strong>Prioridad de precios:</strong>
                <br />
                1. <strong>Precio Fijo</strong> (si está definido) - Prevalece
                sobre todo
                <br />
                2. <strong>Precio Competitivo</strong> (si hay competencia) -
                Respeta PVPM mínimo
                <br />
                3. <strong>PVPM</strong> (por defecto) - Garantiza margen mínimo
                <br />
                <br />
                <strong>Regla WEB vs Amazon:</strong> Amazon debe ser al menos
                4% más caro que el precio WEB (ERP).
              </div>
            </div>
          </div>

          {/* Acciones del modal */}
          <div className="modal-actions" style={{ marginTop: "2rem" }}>
            <Button
              type="button"
              variant="outlined"
              onClick={onClose}
              disabled={saving}
            >
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductPricingModal;
