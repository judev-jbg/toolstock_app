// frontend/src/components/catalog/ProductForm.jsx
import React, { useState, useEffect } from "react";
import "./ProductForm.css";
import Input from "../common/Input";
import Button from "../common/Button";
import {
  FaBarcode,
  FaTags,
  FaBoxOpen,
  FaMoneyBillWave,
  FaTruck,
  FaPercent,
} from "react-icons/fa";

const ProductForm = ({ product, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    description: "",
    shortDescription: "",
    reference: "",
    costPrice: "",
    specialCostPrice: "",
    taxRate: "21",
    marginRate: "0.75",
    specialMarginRate: "",
    shippingCost: "8",
    specialShippingCost: "",
    amazonPrice: "",
    amazonStock: "10",
    preparationTime: "1",
    weight: "",
    ean13: "",
    upc: "",
    manufacturer: "",
    brand: "",
    category: "",
    subcategory: "",
    tags: "",
    minimumStock: "0",
    active: true,
    activeInAmazon: true,
    activeInPrestashop: true,
  });

  const [calculatedMinPrice, setCalculatedMinPrice] = useState(0);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Cargar datos del producto si existe
  useEffect(() => {
    if (product) {
      // Convertir arrays a string para campos como tags
      const tags = Array.isArray(product.tags)
        ? product.tags.join(", ")
        : product.tags || "";

      setFormData({
        sku: product.sku || "",
        name: product.name || "",
        description: product.description || "",
        shortDescription: product.shortDescription || "",
        reference: product.reference || "",
        costPrice: product.costPrice?.toString() || "",
        specialCostPrice: product.specialCostPrice?.toString() || "",
        taxRate: product.taxRate?.toString() || "21",
        marginRate: product.marginRate?.toString() || "0.75",
        specialMarginRate: product.specialMarginRate?.toString() || "",
        shippingCost: product.shippingCost?.toString() || "8",
        specialShippingCost: product.specialShippingCost?.toString() || "",
        amazonPrice: product.amazonPrice?.toString() || "",
        amazonStock: product.amazonStock?.toString() || "10",
        preparationTime: product.preparationTime?.toString() || "1",
        weight: product.weight?.toString() || "",
        ean13: product.ean13 || "",
        upc: product.upc || "",
        manufacturer: product.manufacturer || "",
        brand: product.brand || "",
        category: product.category || "",
        subcategory: product.subcategory || "",
        tags: tags,
        minimumStock: product.minimumStock?.toString() || "0",
        active: product.active !== false,
        activeInAmazon: product.activeInAmazon !== false,
        activeInPrestashop: product.activeInPrestashop !== false,
      });
    }
  }, [product]);

  // Calcular precio mínimo
  useEffect(() => {
    calculateMinPrice();
  }, [
    formData.costPrice,
    formData.specialCostPrice,
    formData.taxRate,
    formData.marginRate,
    formData.specialMarginRate,
    formData.shippingCost,
    formData.specialShippingCost,
  ]);

  // Función para calcular precio mínimo
  const calculateMinPrice = () => {
    // Usar costo especial si existe, si no usar el costo normal
    const cost = formData.specialCostPrice
      ? parseFloat(formData.specialCostPrice)
      : parseFloat(formData.costPrice) || 0;

    // Usar margen especial si existe, si no usar el margen normal
    const margin = formData.specialMarginRate
      ? parseFloat(formData.specialMarginRate)
      : parseFloat(formData.marginRate) || 0.75;

    // Usar envío especial si existe, si no usar el envío normal
    const shipping = formData.specialShippingCost
      ? parseFloat(formData.specialShippingCost)
      : parseFloat(formData.shippingCost) || 8;

    // Calcular precio mínimo: ((costo / margen) + IVA) + costo de envío
    const taxRate = parseFloat(formData.taxRate) || 21;
    const priceWithoutTax = cost / margin;
    const taxAmount = priceWithoutTax * (taxRate / 100);

    const minPrice = priceWithoutTax + taxAmount + shipping;
    setCalculatedMinPrice(minPrice.toFixed(2));
  };

  // Manejar cambios en el formulario
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Limpiar errores al cambiar
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  // Validar formulario
  const validateForm = () => {
    const newErrors = {};

    if (!formData.sku.trim()) {
      newErrors.sku = "El SKU es obligatorio";
    }

    if (!formData.name.trim()) {
      newErrors.name = "El nombre es obligatorio";
    }

    if (!formData.costPrice) {
      newErrors.costPrice = "El costo es obligatorio";
    } else if (
      isNaN(parseFloat(formData.costPrice)) ||
      parseFloat(formData.costPrice) < 0
    ) {
      newErrors.costPrice = "El costo debe ser un número válido";
    }

    if (
      formData.specialCostPrice &&
      (isNaN(parseFloat(formData.specialCostPrice)) ||
        parseFloat(formData.specialCostPrice) < 0)
    ) {
      newErrors.specialCostPrice =
        "El costo especial debe ser un número válido";
    }

    if (!formData.marginRate) {
      newErrors.marginRate = "El margen es obligatorio";
    } else if (
      isNaN(parseFloat(formData.marginRate)) ||
      parseFloat(formData.marginRate) <= 0
    ) {
      newErrors.marginRate = "El margen debe ser un número positivo";
    }

    if (
      formData.specialMarginRate &&
      (isNaN(parseFloat(formData.specialMarginRate)) ||
        parseFloat(formData.specialMarginRate) <= 0)
    ) {
      newErrors.specialMarginRate =
        "El margen especial debe ser un número positivo";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Preparar datos para enviar
      const productData = {
        ...formData,
        costPrice: parseFloat(formData.costPrice),
        specialCostPrice: formData.specialCostPrice
          ? parseFloat(formData.specialCostPrice)
          : undefined,
        taxRate: parseFloat(formData.taxRate),
        marginRate: parseFloat(formData.marginRate),
        specialMarginRate: formData.specialMarginRate
          ? parseFloat(formData.specialMarginRate)
          : undefined,
        shippingCost: parseFloat(formData.shippingCost),
        specialShippingCost: formData.specialShippingCost
          ? parseFloat(formData.specialShippingCost)
          : undefined,
        amazonPrice: formData.amazonPrice
          ? parseFloat(formData.amazonPrice)
          : undefined,
        amazonStock: formData.amazonStock
          ? parseInt(formData.amazonStock)
          : undefined,
        preparationTime: formData.preparationTime
          ? parseInt(formData.preparationTime)
          : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        minimumStock: formData.minimumStock
          ? parseInt(formData.minimumStock)
          : undefined,
        // Convertir tags de string a array
        tags: formData.tags
          ? formData.tags.split(",").map((tag) => tag.trim())
          : [],
      };

      // Llamar a la función de envío
      await onSubmit(productData);
    } catch (error) {
      console.error("Error al enviar formulario:", error);
      setErrors((prev) => ({
        ...prev,
        form: "Error al guardar producto",
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="product-form" onSubmit={handleSubmit}>
      {errors.form && <div className="form-error">{errors.form}</div>}

      <div className="form-row">
        <div className="form-column">
          <h3>Información básica</h3>

          <Input
            label="SKU"
            name="sku"
            value={formData.sku}
            onChange={handleChange}
            error={errors.sku}
            icon={<FaBarcode />}
            required
            fullWidth
            disabled={!!product} // Deshabilitar si es edición
          />

          <Input
            label="Nombre"
            name="name"
            value={formData.name}
            onChange={handleChange}
            error={errors.name}
            required
            fullWidth
          />

          <Input
            label="Descripción"
            name="description"
            value={formData.description}
            onChange={handleChange}
            type="textarea"
            fullWidth
          />

          <Input
            label="Descripción corta"
            name="shortDescription"
            value={formData.shortDescription}
            onChange={handleChange}
            fullWidth
          />

          <Input
            label="Referencia proveedor"
            name="reference"
            value={formData.reference}
            onChange={handleChange}
            icon={<FaBoxOpen />}
            fullWidth
          />

          <div className="form-row">
            <Input
              label="Marca"
              name="brand"
              value={formData.brand}
              onChange={handleChange}
              fullWidth
            />

            <Input
              label="Fabricante"
              name="manufacturer"
              value={formData.manufacturer}
              onChange={handleChange}
              fullWidth
            />
          </div>

          <div className="form-row">
            <Input
              label="Categoría"
              name="category"
              value={formData.category}
              onChange={handleChange}
              icon={<FaTags />}
              fullWidth
            />

            <Input
              label="Subcategoría"
              name="subcategory"
              value={formData.subcategory}
              onChange={handleChange}
              fullWidth
            />
          </div>

          <Input
            label="Etiquetas (separadas por comas)"
            name="tags"
            value={formData.tags}
            onChange={handleChange}
            fullWidth
          />
        </div>

        <div className="form-column">
          <h3>Precios y costos</h3>

          <div className="form-row">
            <Input
              label="Costo (€)"
              type="number"
              name="costPrice"
              value={formData.costPrice}
              onChange={handleChange}
              error={errors.costPrice}
              icon={<FaMoneyBillWave />}
              required
              fullWidth
              step="0.01"
              min="0"
            />

            <Input
              label="Costo especial (€)"
              type="number"
              name="specialCostPrice"
              value={formData.specialCostPrice}
              onChange={handleChange}
              error={errors.specialCostPrice}
              fullWidth
              step="0.01"
              min="0"
            />
          </div>

          <div className="form-row">
            <Input
              label="Margen (decimal)"
              type="number"
              name="marginRate"
              value={formData.marginRate}
              onChange={handleChange}
              error={errors.marginRate}
              icon={<FaPercent />}
              required
              fullWidth
              step="0.01"
              min="0.01"
              title="Usar 0.75 para un 25% de margen"
            />

            <Input
              label="Margen especial"
              type="number"
              name="specialMarginRate"
              value={formData.specialMarginRate}
              onChange={handleChange}
              error={errors.specialMarginRate}
              fullWidth
              step="0.01"
              min="0.01"
            />
          </div>

          <div className="form-row">
            <Input
              label="Costo envío (€)"
              type="number"
              name="shippingCost"
              value={formData.shippingCost}
              onChange={handleChange}
              icon={<FaTruck />}
              required
              fullWidth
              step="0.01"
              min="0"
            />

            <Input
              label="Envío especial (€)"
              type="number"
              name="specialShippingCost"
              value={formData.specialShippingCost}
              onChange={handleChange}
              fullWidth
              step="0.01"
              min="0"
            />
          </div>

          <Input
            label="IVA (%)"
            type="number"
            name="taxRate"
            value={formData.taxRate}
            onChange={handleChange}
            required
            fullWidth
            step="0.01"
            min="0"
          />

          <div className="min-price-display">
            <span>Precio mínimo calculado:</span>
            <strong>{calculatedMinPrice} €</strong>
          </div>

          <h3>Configuración de plataformas</h3>

          <div className="form-row">
            <Input
              label="Precio Amazon (€)"
              type="number"
              name="amazonPrice"
              value={formData.amazonPrice}
              onChange={handleChange}
              fullWidth
              step="0.01"
              min="0"
            />

            <Input
              label="Stock Amazon"
              type="number"
              name="amazonStock"
              value={formData.amazonStock}
              onChange={handleChange}
              fullWidth
              min="0"
            />
          </div>

          <Input
            label="Tiempo de preparación (días)"
            type="number"
            name="preparationTime"
            value={formData.preparationTime}
            onChange={handleChange}
            fullWidth
            min="1"
          />

          <div className="checkboxes-group">
            <div className="checkbox-field">
              <input
                type="checkbox"
                id="active"
                name="active"
                checked={formData.active}
                onChange={handleChange}
              />
              <label htmlFor="active">Producto activo</label>
            </div>

            <div className="checkbox-field">
              <input
                type="checkbox"
                id="activeInAmazon"
                name="activeInAmazon"
                checked={formData.activeInAmazon}
                onChange={handleChange}
              />
              <label htmlFor="activeInAmazon">Activo en Amazon</label>
            </div>

            <div className="checkbox-field">
              <input
                type="checkbox"
                id="activeInPrestashop"
                name="activeInPrestashop"
                checked={formData.activeInPrestashop}
                onChange={handleChange}
              />
              <label htmlFor="activeInPrestashop">Activo en PrestaShop</label>
            </div>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <Button
          type="button"
          variant="outlined"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Guardando..." : product ? "Actualizar" : "Crear"}
        </Button>
      </div>
    </form>
  );
};

export default ProductForm;
