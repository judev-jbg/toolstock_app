// frontend/src/components/catalog/PriceConfigModal.jsx
import React, { useState, useEffect } from "react";
import { FaCog, FaPlus, FaTrash } from "react-icons/fa";
import Input from "../common/Input";
import Button from "../common/Button";
import "./PriceConfigModal.css";

const PriceConfigModal = ({ onClose, onSave, loading, initialConfig }) => {
  const [config, setConfig] = useState({
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

  const [error, setError] = useState("");

  // Cargar configuración inicial
  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
    }
  }, [initialConfig]);

  // Manejar cambios en campos generales
  const handleChange = (e) => {
    const { name, value } = e.target;
    let parsedValue = value;

    // Convertir a número para campos numéricos
    if (name !== "name") {
      parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) parsedValue = 0;
    }

    setConfig({
      ...config,
      [name]: parsedValue,
    });

    setError("");
  };

  // Manejar cambios en rangos de peso
  const handleRangeChange = (index, field, value) => {
    const parsedValue = parseFloat(value);
    if (isNaN(parsedValue)) return;

    const updatedRanges = [...config.weightRanges];
    updatedRanges[index] = {
      ...updatedRanges[index],
      [field]: parsedValue,
    };

    setConfig({
      ...config,
      weightRanges: updatedRanges,
    });
  };

  // Añadir nuevo rango de peso
  const addWeightRange = () => {
    // Encontrar el último peso y coste
    const lastRange = config.weightRanges[config.weightRanges.length - 1];
    const newMaxWeight = lastRange ? lastRange.maxWeight + 5 : 5;
    const newShippingCost = lastRange ? lastRange.shippingCost + 1 : 5;

    setConfig({
      ...config,
      weightRanges: [
        ...config.weightRanges,
        { maxWeight: newMaxWeight, shippingCost: newShippingCost },
      ],
    });
  };

  // Eliminar rango de peso
  const removeWeightRange = (index) => {
    const updatedRanges = [...config.weightRanges];
    updatedRanges.splice(index, 1);

    setConfig({
      ...config,
      weightRanges: updatedRanges,
    });
  };

  // Validar y enviar configuración
  const handleSubmit = (e) => {
    e.preventDefault();

    // Validaciones básicas
    if (config.defaultMarginRate <= 0) {
      setError("El margen debe ser mayor que 0");
      return;
    }

    if (config.defaultTaxRate < 0) {
      setError("El IVA no puede ser negativo");
      return;
    }

    if (config.defaultShippingCost < 0) {
      setError("El coste de envío no puede ser negativo");
      return;
    }

    // Validar rangos de peso (deben estar ordenados)
    let lastMaxWeight = 0;
    for (const range of config.weightRanges) {
      if (range.maxWeight <= lastMaxWeight) {
        setError(`Los rangos de peso deben estar ordenados y ser crecientes`);
        return;
      }
      lastMaxWeight = range.maxWeight;
    }

    onSave(config);
  };

  return (
    <div className="modal-overlay">
      <div className="price-config-modal">
        <div className="modal-header">
          <h2>
            <FaCog /> Configuración de Precios
          </h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="price-config-form" onSubmit={handleSubmit}>
          {error && <div className="config-error">{error}</div>}

          <div className="config-section">
            <h3>Configuración General</h3>

            <div className="config-grid">
              <Input
                label="Margen por defecto (decimal)"
                type="number"
                name="defaultMarginRate"
                value={config.defaultMarginRate}
                onChange={handleChange}
                required
                step="0.01"
                min="0.01"
                helperText="Usar 0.75 para un 25% de margen"
                fullWidth
              />

              <Input
                label="IVA (%)"
                type="number"
                name="defaultTaxRate"
                value={config.defaultTaxRate}
                onChange={handleChange}
                required
                step="0.01"
                min="0"
                fullWidth
              />

              <Input
                label="Coste de envío por defecto (€)"
                type="number"
                name="defaultShippingCost"
                value={config.defaultShippingCost}
                onChange={handleChange}
                required
                step="0.01"
                min="0"
                fullWidth
              />

              <Input
                label="Descuento Prestashop (%)"
                type="number"
                name="prestashopDiscount"
                value={config.prestashopDiscount}
                onChange={handleChange}
                required
                step="0.01"
                min="0"
                helperText="Porcentaje de descuento en Prestashop respecto a Amazon"
                fullWidth
              />

              <Input
                label="Diferencia Buy Box (€)"
                type="number"
                name="buyboxPriceDifference"
                value={config.buyboxPriceDifference}
                onChange={handleChange}
                required
                step="0.01"
                min="0"
                helperText="Euros de descuento para competir por el Buy Box"
                fullWidth
              />
            </div>
          </div>

          <div className="config-section">
            <div className="section-header">
              <h3>Rangos de Peso y Costes de Envío</h3>
              <Button
                type="button"
                variant="outlined"
                size="small"
                onClick={addWeightRange}
                icon={<FaPlus />}
              >
                Añadir Rango
              </Button>
            </div>

            <div className="weight-ranges">
              <div className="weight-range-header">
                <div>Peso máximo (kg)</div>
                <div>Coste envío (€)</div>
                <div>Acciones</div>
              </div>

              {config.weightRanges.map((range, index) => (
                <div className="weight-range-row" key={index}>
                  <Input
                    type="number"
                    value={range.maxWeight}
                    onChange={(e) =>
                      handleRangeChange(index, "maxWeight", e.target.value)
                    }
                    min="0"
                    step="0.01"
                    required
                  />

                  <Input
                    type="number"
                    value={range.shippingCost}
                    onChange={(e) =>
                      handleRangeChange(index, "shippingCost", e.target.value)
                    }
                    min="0"
                    step="0.01"
                    required
                  />

                  <Button
                    type="button"
                    variant="text"
                    onClick={() => removeWeightRange(index)}
                    disabled={config.weightRanges.length <= 1}
                    icon={<FaTrash />}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <Button
              type="button"
              variant="outlined"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar Configuración"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PriceConfigModal;
