// frontend/src/components/catalog/ProductsTable.jsx (actualización completa)
import React, { useState } from "react";
import "./ProductsTable.css";
import {
  FaEdit,
  FaSync,
  FaAmazon,
  FaShoppingCart,
  FaChartLine,
  FaCheck,
  FaTimes,
  FaCrown,
  FaBoxes,
  FaClock,
} from "react-icons/fa";
import { formatCurrency } from "../../utils/formatters";

const ProductsTable = ({
  products,
  onEdit,
  onSyncAmazon,
  onSyncPrestashop,
  onUpdatePrices,
  onOptimizePrice,
  onSelectProduct,
  onInlineEdit,
  onSelectionChange,
}) => {
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [selectedRows, setSelectedRows] = useState({});
  const [selectAll, setSelectAll] = useState(false);

  // Campos que pueden ser editados directamente
  const editableFields = [
    "name",
    "costPrice",
    "specialCostPrice",
    "amazonPrice",
    "amazonStock",
    "preparationTime",
    "marginRate",
    "specialMarginRate",
    "shippingCost",
    "specialShippingCost",
  ];

  // Iniciar edición de celda
  const startEditing = (productId, field, value) => {
    if (editableFields.includes(field)) {
      setEditingCell({ productId, field });
      setEditValue(value?.toString() || "");
    }
  };

  // Guardar edición
  const saveEdit = async (productId) => {
    if (!editingCell) return;

    try {
      // Formatear valor según tipo
      let formattedValue = editValue;
      if (
        [
          "costPrice",
          "specialCostPrice",
          "amazonPrice",
          "marginRate",
          "specialMarginRate",
          "shippingCost",
          "specialShippingCost",
        ].includes(editingCell.field)
      ) {
        formattedValue = parseFloat(editValue);
        if (isNaN(formattedValue)) {
          // Cancelar si no es un número válido
          cancelEdit();
          return;
        }
      }

      if (["preparationTime", "amazonStock"].includes(editingCell.field)) {
        formattedValue = parseInt(editValue);
        if (isNaN(formattedValue)) {
          cancelEdit();
          return;
        }
      }

      // Llamar a la función de actualización
      await onInlineEdit(productId, editingCell.field, formattedValue);

      // Resetear estado
      setEditingCell(null);
      setEditValue("");
    } catch (error) {
      console.error("Error al guardar edición:", error);
      // Mantener modo edición en caso de error
    }
  };

  // Cancelar edición
  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  // Manejar teclas en input
  const handleKeyDown = (e, productId) => {
    if (e.key === "Enter") {
      saveEdit(productId);
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  // Manejar selección de fila
  const handleRowSelect = (productId, selected) => {
    const newSelectedRows = { ...selectedRows, [productId]: selected };
    setSelectedRows(newSelectedRows);

    // Calcular IDs seleccionados y notificar al componente padre
    const selectedIds = Object.keys(newSelectedRows).filter(
      (id) => newSelectedRows[id]
    );
    onSelectionChange(selectedIds);
  };

  // Manejar selección de todas las filas
  const handleSelectAll = (e) => {
    const isSelected = e.target.checked;
    setSelectAll(isSelected);

    // Crear objeto con todas las filas seleccionadas/deseleccionadas
    const newSelectedRows = {};
    products.forEach((product) => {
      newSelectedRows[product._id] = isSelected;
    });
    setSelectedRows(newSelectedRows);

    // Notificar cambio
    const selectedIds = isSelected ? products.map((p) => p._id) : [];
    onSelectionChange(selectedIds);
  };

  // Renderizar celda editable o normal
  const renderCell = (product, field) => {
    const isEditing =
      editingCell &&
      editingCell.productId === product._id &&
      editingCell.field === field;

    // Si está en modo edición, mostrar input
    if (isEditing) {
      return (
        <input
          type={
            [
              "costPrice",
              "specialCostPrice",
              "amazonPrice",
              "marginRate",
              "specialMarginRate",
              "shippingCost",
              "specialShippingCost",
            ].includes(field)
              ? "number"
              : ["preparationTime", "amazonStock"].includes(field)
              ? "number"
              : "text"
          }
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => saveEdit(product._id)}
          onKeyDown={(e) => handleKeyDown(e, product._id)}
          autoFocus
          className="cell-edit-input"
          step={
            [
              "costPrice",
              "specialCostPrice",
              "amazonPrice",
              "marginRate",
              "specialMarginRate",
              "shippingCost",
              "specialShippingCost",
            ].includes(field)
              ? "0.01"
              : "1"
          }
          min={
            field === "amazonStock" || field === "preparationTime"
              ? "0"
              : undefined
          }
        />
      );
    }

    // Formatear valor según tipo de campo
    let displayValue = product[field];

    if (
      [
        "costPrice",
        "specialCostPrice",
        "amazonPrice",
        "minPrice",
        "prestashopPrice",
        "shippingCost",
        "specialShippingCost",
      ].includes(field)
    ) {
      displayValue = formatCurrency(displayValue);
    }

    if (field === "marginRate" || field === "specialMarginRate") {
      displayValue = displayValue ? `${(displayValue * 100).toFixed(1)}%` : "-";
    }

    if (field === "preparationTime") {
      displayValue = displayValue ? `${displayValue} días` : "-";
    }

    // Si es editable, añadir clase para indicarlo
    const cellClass = editableFields.includes(field) ? "editable-cell" : "";

    return (
      <div
        className={cellClass}
        onDoubleClick={() => startEditing(product._id, field, product[field])}
        title={editableFields.includes(field) ? "Doble clic para editar" : ""}
      >
        {displayValue || "-"}
      </div>
    );
  };

  // Renderizar indicadores de estado
  const renderStatusIndicators = (product) => {
    return (
      <div className="status-indicators">
        {/* Estado ERP */}
        <span
          className={`status-indicator ${
            product.active ? "active" : "inactive"
          }`}
          title={product.active ? "Activo en ERP" : "Inactivo en ERP"}
        >
          ERP
        </span>

        {/* Estado Prestashop */}
        <span
          className={`status-indicator ${
            product.activeInPrestashop ? "active" : "inactive"
          }`}
          title={
            product.activeInPrestashop
              ? "Activo en PrestaShop"
              : "Inactivo en PrestaShop"
          }
        >
          <FaShoppingCart />
        </span>

        {/* Estado Amazon */}
        <span
          className={`status-indicator ${
            product.activeInAmazon ? "active" : "inactive"
          }`}
          title={
            product.activeInAmazon ? "Activo en Amazon" : "Inactivo en Amazon"
          }
        >
          <FaAmazon />
        </span>

        {/* Buy Box */}
        {product.hasBuyBox && (
          <span
            className="status-indicator buybox active"
            title="Tiene el Buy Box"
          >
            <FaCrown />
          </span>
        )}
      </div>
    );
  };

  // Renderizar controles de stock
  const renderStockControls = (product) => {
    return (
      <div className="stock-controls">
        <div className="stock-value">
          {product.equalizeStockWithErp ? (
            <span title="Stock igualado con ERP">
              <FaBoxes /> {product.erpStock}
            </span>
          ) : product.setManualStock ? (
            renderCell(product, "amazonStock")
          ) : (
            <span title="Stock manual">
              {renderCell(product, "amazonStock")}
            </span>
          )}
        </div>
        <div className="stock-indicators">
          {product.equalizeStockWithErp && (
            <span className="stock-indicator equal" title="Igualado con ERP">
              =
            </span>
          )}
          {product.setManualStock && (
            <span className="stock-indicator manual" title="Stock manual">
              M
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="products-table-container">
      <table className="products-table">
        <thead>
          <tr>
            <th className="select-column">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
              />
            </th>
            <th>SKU</th>
            <th>Descripción</th>
            <th>Ref. Prov.</th>
            <th>ASIN</th>
            <th>Proveedor</th>
            <th>Plataformas</th>
            <th>Stock ERP</th>
            <th>Stock AMZ</th>
            <th>T. Prep</th>
            <th>Coste</th>
            <th>Coste Esp.</th>
            <th>Margen</th>
            <th>Coste Envío</th>
            <th>PVPM</th>
            <th>PVP</th>
            <th>PVP AMZ</th>
            <th>Buy Box</th>
            <th>Estados</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr
              key={product._id}
              onClick={() => onSelectProduct(product)}
              className={selectedRows[product._id] ? "selected-row" : ""}
            >
              <td
                className="select-column"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={!!selectedRows[product._id]}
                  onChange={(e) =>
                    handleRowSelect(product._id, e.target.checked)
                  }
                />
              </td>

              {/* SKU */}
              <td>
                <span className="sku-cell" title={product.sku}>
                  {product.sku}
                </span>
              </td>

              {/* Descripción */}
              <td className="description-cell">
                <div className="description-content">
                  {renderCell(product, "name")}
                </div>
              </td>

              {/* Referencia Proveedor */}
              <td>{product.reference || "-"}</td>

              {/* ASIN */}
              <td>
                <span className="asin-cell" title={product.asin}>
                  {product.asin || "-"}
                </span>
              </td>

              {/* Proveedor */}
              <td>{product.manufacturer || "-"}</td>

              {/* Plataformas */}
              <td>
                <div className="platform-indicators">
                  <span
                    className={`platform-chip ${
                      product.activeInPrestashop ? "active" : "inactive"
                    }`}
                  >
                    PS
                  </span>
                  <span
                    className={`platform-chip ${
                      product.activeInAmazon ? "active" : "inactive"
                    }`}
                  >
                    AMZ
                  </span>
                </div>
              </td>

              {/* Stock ERP */}
              <td className="stock-cell">
                <div className="stock-display">
                  <FaBoxes />
                  <span>{product.erpStock || 0}</span>
                </div>
              </td>

              {/* Stock Amazon */}
              <td className="stock-cell">{renderStockControls(product)}</td>

              {/* Tiempo de preparación */}
              <td>
                <div className="prep-time-cell">
                  <FaClock />
                  {renderCell(product, "preparationTime")}
                </div>
              </td>

              {/* Coste */}
              <td>{renderCell(product, "costPrice")}</td>

              {/* Coste Especial */}
              <td>{renderCell(product, "specialCostPrice")}</td>

              {/* Margen */}
              <td>{renderCell(product, "marginRate")}</td>

              {/* Coste de envío */}
              <td>{renderCell(product, "shippingCost")}</td>

              {/* PVPM */}
              <td className="pvpm-cell">
                <strong>{formatCurrency(product.minPrice)}</strong>
              </td>

              {/* PVP Prestashop */}
              <td className="pvp-cell">
                <div className="price-display">
                  {formatCurrency(product.prestashopPrice)}
                  {product.isWebOffer && (
                    <span className="offer-badge" title="Oferta Web">
                      OFERTA
                    </span>
                  )}
                </div>
              </td>

              {/* PVP Amazon */}
              <td>{renderCell(product, "amazonPrice")}</td>

              {/* Buy Box */}
              <td className="buybox-cell">
                {product.hasBuyBox ? (
                  <span className="buybox-yes" title="Tiene el Buy Box">
                    <FaCheck /> SÍ
                  </span>
                ) : (
                  <span className="buybox-no" title="No tiene el Buy Box">
                    <FaTimes /> NO
                  </span>
                )}
              </td>

              {/* Estados */}
              <td>{renderStatusIndicators(product)}</td>

              {/* Acciones */}
              <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                <div className="action-buttons">
                  <button
                    className="action-button edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(product);
                    }}
                    title="Editar producto"
                  >
                    <FaEdit />
                  </button>

                  <button
                    className="action-button amazon"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSyncAmazon(product._id);
                    }}
                    title="Sincronizar con Amazon"
                  >
                    <FaAmazon />
                  </button>

                  <button
                    className="action-button prestashop"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSyncPrestashop(product._id);
                    }}
                    title="Sincronizar con PrestaShop"
                  >
                    <FaShoppingCart />
                  </button>

                  <button
                    className="action-button prices"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdatePrices(product._id);
                    }}
                    title="Actualizar precios de competencia"
                  >
                    <FaChartLine />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProductsTable;
