import React, { useState } from "react";
import { MdInventory, MdWarning } from "react-icons/md";
import Button from "../common/Button";
import Input from "../common/Input";
import "./BulkStockModal.css";

const BulkStockModal = ({ products, onClose, onUpdate, loading }) => {
  const [stockValues, setStockValues] = useState(
    products.reduce((acc, product) => {
      acc[product._id] = product.quantity || 0;
      return acc;
    }, {})
  );
  const [errors, setErrors] = useState({});

  // Manejar cambio de stock individual
  const handleStockChange = (productId, value) => {
    const numValue = parseInt(value) || 0;
    setStockValues((prev) => ({
      ...prev,
      [productId]: numValue,
    }));

    // Limpiar error si existe
    if (errors[productId]) {
      setErrors((prev) => ({
        ...prev,
        [productId]: null,
      }));
    }
  };

  // Aplicar mismo valor a todos los productos
  const applyToAll = (value) => {
    const numValue = parseInt(value) || 0;
    const newValues = {};
    products.forEach((product) => {
      newValues[product._id] = numValue;
    });
    setStockValues(newValues);
    setErrors({});
  };

  // Validar formulario
  const validateForm = () => {
    const newErrors = {};
    let isValid = true;

    Object.entries(stockValues).forEach(([productId, value]) => {
      if (value < 0) {
        newErrors[productId] = "El stock no puede ser negativo";
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  // Manejar envío
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Preparar actualizaciones
    const updates = products.map((product) => ({
      id: product._id,
      quantity: stockValues[product._id],
    }));

    onUpdate(updates);
  };

  // Calcular totales
  const totalProducts = products.length;
  const totalCurrentStock = products.reduce(
    (sum, product) => sum + (product.quantity || 0),
    0
  );
  const totalNewStock = Object.values(stockValues).reduce(
    (sum, value) => sum + value,
    0
  );

  return (
    <div className="modal-overlay">
      <div className="bulk-stock-modal">
        <div className="modal-header">
          <h2>
            <MdInventory />
            Actualización Masiva de Stock
          </h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          {/* Resumen */}
          <div className="stock-summary">
            <div className="summary-card">
              <span className="summary-label">Productos seleccionados:</span>
              <span className="summary-value">{totalProducts}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Stock actual total:</span>
              <span className="summary-value">{totalCurrentStock}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Stock nuevo total:</span>
              <span className="summary-value">{totalNewStock}</span>
            </div>
          </div>

          {/* Herramientas rápidas */}
          <div className="quick-actions">
            <span className="quick-actions-label">Aplicar a todos:</span>
            <div className="quick-actions-buttons">
              <Button
                variant="outlined"
                size="small"
                onClick={() => applyToAll(0)}
              >
                0
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => applyToAll(10)}
              >
                10
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => applyToAll(50)}
              >
                50
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => applyToAll(100)}
              >
                100
              </Button>
            </div>
          </div>

          {/* Lista de productos */}
          <form onSubmit={handleSubmit}>
            <div className="products-list">
              {products.map((product) => (
                <div key={product._id} className="product-stock-item">
                  <div className="product-info">
                    <div className="product-sku">{product.sellerSku}</div>
                    <div className="product-title">{product.title}</div>
                    <div className="product-current-stock">
                      Stock actual: {product.quantity || 0}
                    </div>
                  </div>
                  <div className="product-stock-input">
                    <Input
                      type="number"
                      value={stockValues[product._id]}
                      onChange={(e) =>
                        handleStockChange(product._id, e.target.value)
                      }
                      min="0"
                      error={errors[product._id]}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Advertencia */}
            <div className="warning-message">
              <MdWarning />
              <span>
                Esta acción actualizará el stock en Amazon para todos los
                productos seleccionados. Los cambios pueden tardar unos minutos
                en reflejarse.
              </span>
            </div>

            {/* Acciones */}
            <div className="modal-actions">
              <Button
                type="button"
                variant="outlined"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="filled" disabled={loading}>
                {loading
                  ? "Actualizando..."
                  : `Actualizar ${totalProducts} productos`}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BulkStockModal;
