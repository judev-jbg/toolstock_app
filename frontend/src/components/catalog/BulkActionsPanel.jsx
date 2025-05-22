// frontend/src/components/catalog/BulkActionsPanel.jsx
import React, { useState } from "react";
import {
  FaTags,
  FaBoxes,
  FaMoneyBillWave,
  FaPercent,
  FaEuroSign,
  FaTimes,
} from "react-icons/fa";
import Button from "../common/Button";
import Input from "../common/Input";
import "./BulkActionsPanel.css";

const BulkActionsPanel = ({
  selectedProducts,
  onBulkUpdateStock,
  onBulkUpdatePrices,
  onRecalculatePrices,
  onClearSelection,
}) => {
  const [stockValue, setStockValue] = useState(10);
  const [priceAction, setPriceAction] = useState("fixed");
  const [priceValue, setPriceValue] = useState(0);
  const [showStockForm, setShowStockForm] = useState(false);
  const [showPriceForm, setShowPriceForm] = useState(false);

  const selectedCount = selectedProducts.length;

  // Manejar actualización masiva de stock
  const handleStockUpdate = (e) => {
    e.preventDefault();

    if (selectedCount === 0) return;

    onBulkUpdateStock(selectedProducts, stockValue);
    setShowStockForm(false);
    setStockValue(10); // Reset
  };

  // Manejar actualización masiva de precios
  const handlePriceUpdate = (e) => {
    e.preventDefault();

    if (selectedCount === 0) return;

    const adjustment = {
      type: priceAction,
      value: parseFloat(priceValue),
    };

    onBulkUpdatePrices(selectedProducts, adjustment);
    setShowPriceForm(false);
    setPriceValue(0); // Reset
  };

  // Manejar recálculo de PVPM
  const handleRecalculatePrices = () => {
    if (selectedCount === 0) return;
    onRecalculatePrices(selectedProducts);
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="bulk-actions-panel">
      <div className="bulk-header">
        <div className="selected-count">
          <FaTags /> {selectedCount} producto{selectedCount !== 1 ? "s" : ""}{" "}
          seleccionado{selectedCount !== 1 ? "s" : ""}
        </div>

        <div className="bulk-actions">
          <Button
            variant="text"
            size="small"
            onClick={onClearSelection}
            icon={<FaTimes />}
          >
            Limpiar
          </Button>

          <Button
            variant="outlined"
            size="small"
            onClick={() => setShowStockForm(!showStockForm)}
            icon={<FaBoxes />}
          >
            Stock Amazon
          </Button>

          <Button
            variant="outlined"
            size="small"
            onClick={() => setShowPriceForm(!showPriceForm)}
            icon={<FaMoneyBillWave />}
          >
            Precios Amazon
          </Button>

          <Button
            variant="outlined"
            size="small"
            onClick={handleRecalculatePrices}
          >
            Recalcular PVPM
          </Button>
        </div>
      </div>

      {showStockForm && (
        <div className="bulk-form">
          <h4>Actualizar Stock en Amazon</h4>
          <form onSubmit={handleStockUpdate}>
            <div className="form-row">
              <Input
                label="Nuevo valor de stock"
                type="number"
                value={stockValue}
                onChange={(e) => setStockValue(parseInt(e.target.value))}
                min="0"
                required
                icon={<FaBoxes />}
              />

              <div className="form-actions">
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={() => setShowStockForm(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="small">
                  Actualizar
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {showPriceForm && (
        <div className="bulk-form">
          <h4>Modificar Precios en Amazon</h4>
          <form onSubmit={handlePriceUpdate}>
            <div className="form-row price-form-row">
              <div className="price-action">
                <label className="action-label">Tipo de ajuste:</label>
                <div className="action-options">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="priceAction"
                      value="fixed"
                      checked={priceAction === "fixed"}
                      onChange={() => setPriceAction("fixed")}
                    />
                    <span>Precio Fijo</span>
                  </label>

                  <label className="radio-label">
                    <input
                      type="radio"
                      name="priceAction"
                      value="increase"
                      checked={priceAction === "increase"}
                      onChange={() => setPriceAction("increase")}
                    />
                    <span>Aumentar</span>
                  </label>

                  <label className="radio-label">
                    <input
                      type="radio"
                      name="priceAction"
                      value="decrease"
                      checked={priceAction === "decrease"}
                      onChange={() => setPriceAction("decrease")}
                    />
                    <span>Reducir</span>
                  </label>

                  <label className="radio-label">
                    <input
                      type="radio"
                      name="priceAction"
                      value="percentage"
                      checked={priceAction === "percentage"}
                      onChange={() => setPriceAction("percentage")}
                    />
                    <span>Incrementar %</span>
                  </label>
                </div>
              </div>

              <div className="price-value">
                <Input
                  label={
                    priceAction === "fixed"
                      ? "Precio (€)"
                      : priceAction === "percentage"
                      ? "Porcentaje (%)"
                      : "Cantidad (€)"
                  }
                  type="number"
                  value={priceValue}
                  onChange={(e) => setPriceValue(e.target.value)}
                  required
                  step={priceAction === "percentage" ? "0.1" : "0.01"}
                  min={priceAction === "decrease" ? "0" : null}
                  icon={
                    priceAction === "percentage" ? (
                      <FaPercent />
                    ) : (
                      <FaEuroSign />
                    )
                  }
                />
              </div>

              <div className="form-actions">
                <Button
                  type="button"
                  variant="outlined"
                  size="small"
                  onClick={() => setShowPriceForm(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="small">
                  Aplicar
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default BulkActionsPanel;
