// frontend/src/components/catalog/ProductsTable.jsx
import React, { useState } from "react";
import "./ProductsTable.css";
import {
  FaEdit,
  FaSync,
  FaAmazon,
  FaShoppingCart,
  FaChartLine,
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
}) => {
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");

  // Campos que pueden ser editados directamente
  const editableFields = [
    "name",
    "costPrice",
    "amazonPrice",
    "amazonStock",
    "preparationTime",
  ];

  // Iniciar edición de celda
  const startEditing = (productId, field, value) => {
    if (editableFields.includes(field)) {
      setEditingCell({ productId, field });
      setEditValue(value.toString());
    }
  };

  // Guardar edición
  const saveEdit = async (productId) => {
    if (!editingCell) return;

    try {
      // Formatear valor según tipo
      let formattedValue = editValue;
      if (
        ["costPrice", "amazonPrice", "preparationTime", "amazonStock"].includes(
          editingCell.field
        )
      ) {
        formattedValue = parseFloat(editValue);
        if (isNaN(formattedValue)) {
          // Cancelar si no es un número válido
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
              "amazonPrice",
              "preparationTime",
              "amazonStock",
            ].includes(field)
              ? "number"
              : "text"
          }
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => saveEdit(product._id)}
          onKeyDown={(e) => handleKeyDown(e, product._id)}
          autoFocus
          className="cell-edit-input"
          step={["costPrice", "amazonPrice"].includes(field) ? "0.01" : "1"}
        />
      );
    }

    // Formatear valor según tipo de campo
    let displayValue = product[field];

    if (["costPrice", "amazonPrice", "minPrice"].includes(field)) {
      displayValue = formatCurrency(displayValue);
    }

    // Si es editable, añadir clase para indicarlo
    const cellClass = editableFields.includes(field) ? "editable-cell" : "";

    return (
      <div
        className={cellClass}
        onDoubleClick={() => startEditing(product._id, field, product[field])}
      >
        {displayValue}
      </div>
    );
  };

  return (
    <div className="products-table-container">
      <table className="products-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Nombre</th>
            <th>Costo</th>
            <th>Precio Mín.</th>
            <th>Precio Amazon</th>
            <th>Stock</th>
            <th>T. Prep</th>
            <th>Plataformas</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product._id} onClick={() => onSelectProduct(product)}>
              <td>{product.sku}</td>
              <td>{renderCell(product, "name")}</td>
              <td>{renderCell(product, "costPrice")}</td>
              <td>{renderCell(product, "minPrice")}</td>
              <td>{renderCell(product, "amazonPrice")}</td>
              <td>{renderCell(product, "amazonStock")}</td>
              <td>{renderCell(product, "preparationTime")}</td>
              <td>
                <div className="platform-indicators">
                  <span
                    className={`platform-indicator ${
                      product.activeInAmazon ? "active" : "inactive"
                    }`}
                    title={
                      product.activeInAmazon
                        ? "Activo en Amazon"
                        : "Inactivo en Amazon"
                    }
                  >
                    <FaAmazon />
                  </span>
                  <span
                    className={`platform-indicator ${
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
                </div>
              </td>
              <td>
                <div className="action-buttons">
                  <button
                    className="action-button"
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
                    <FaSync />
                  </button>
                  <button
                    className="action-button prestashop"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSyncPrestashop(product._id);
                    }}
                    title="Sincronizar con PrestaShop"
                  >
                    <FaSync />
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
