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
  FaWeight,
  FaClock,
  FaAmazon,
  FaShoppingCart,
} from "react-icons/fa";
import { formatCurrency } from "../../utils/formatters";

const ProductForm = ({ product, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    description: "",
    shortDescription: "",
    reference: "",
    asin: "",
    ean13: "",
    upc: "",
    manufacturer: "",
    brand: "",
    category: "",
    subcategory: "",
    tags: "",

    // Precios y costos
    costPrice: "",
    specialCostPrice: "",
    taxRate: "21",
    marginRate: "0.75",
    specialMarginRate: "",
    shippingCost: "8",
    specialShippingCost: "",

    // Precios de venta
    amazonPrice: "",
    amazonBusinessPrice: "",
    amazonMinPrice: "",
    amazonMaxPrice: "",
    prestashopPrice: "",
    prestashopOfferPrice: "",
    isWebOffer: false,

    // Información física
    weight: "",
    height: "",
    width: "",
    depth: "",

    // Stock
    erpStock: "",
    amazonStock: "10",
    prestashopStock: "",
    minimumStock: "0",
    equalizeStockWithErp: false,
    setManualStock: false,

    // Estados
    active: true,
    activeInAmazon: true,
    activeInPrestashop: true,

    // Configuración Amazon
    preparationTime: "3",
    hasBuyBox: false,
  });

  const [calculatedMinPrice, setCalculatedMinPrice] = useState(0);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Cargar datos del producto si existe
  useEffect(() => {
    if (product) {
      const tags = Array.isArray(product.tags)
        ? product.tags.join(", ")
        : product.tags || "";

      setFormData({
        sku: product.sku || "",
        name: product.name || "",
        description: product.description || "",
        shortDescription: product.shortDescription || "",
        reference: product.reference || "",
        asin: product.asin || "",
        ean13: product.ean13 || "",
        upc: product.upc || "",
        manufacturer: product.manufacturer || "",
        brand: product.brand || "",
        category: product.category || "",
        subcategory: product.subcategory || "",
        tags: tags,

        // Precios y costos
        costPrice: product.costPrice?.toString() || "",
        specialCostPrice: product.specialCostPrice?.toString() || "",
        taxRate: product.taxRate?.toString() || "21",
        marginRate: product.marginRate?.toString() || "0.75",
        specialMarginRate: product.specialMarginRate?.toString() || "",
        shippingCost: product.shippingCost?.toString() || "8",
        specialShippingCost: product.specialShippingCost?.toString() || "",

        // Precios de venta
        amazonPrice: product.amazonPrice?.toString() || "",
        amazonBusinessPrice: product.amazonBusinessPrice?.toString() || "",
        amazonMinPrice: product.amazonMinPrice?.toString() || "",
        amazonMaxPrice: product.amazonMaxPrice?.toString() || "",
        prestashopPrice: product.prestashopPrice?.toString() || "",
        prestashopOfferPrice: product.prestashopOfferPrice?.toString() || "",
        isWebOffer: product.isWebOffer || false,

        // Información física
        weight: product.weight?.toString() || "",
        height: product.height?.toString() || "",
        width: product.width?.toString() || "",
        depth: product.depth?.toString() || "",

        // Stock
        erpStock: product.erpStock?.toString() || "",
        amazonStock: product.amazonStock?.toString() || "10",
        prestashopStock: product.prestashopStock?.toString() || "",
        minimumStock: product.minimumStock?.toString() || "0",
        equalizeStockWithErp: product.equalizeStockWithErp || false,
        setManualStock: product.setManualStock || false,

        // Estados
        active: product.active !== false,
        activeInAmazon: product.activeInAmazon !== false,
        activeInPrestashop: product.activeInPrestashop !== false,

        // Configuración Amazon
        preparationTime: product.preparationTime?.toString() || "3",
        hasBuyBox: product.hasBuyBox || false,
      });
    }
  }, [product]);

  // Calcular precio mínimo (PVPM)
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

  // Función para calcular precio mínimo (PVPM)
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

    // Validar precio de oferta si está marcado
    if (formData.isWebOffer && !formData.prestashopOfferPrice) {
      newErrors.prestashopOfferPrice =
        "El precio de oferta es obligatorio cuando está marcado como oferta";
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
        // Convertir números
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
        amazonBusinessPrice: formData.amazonBusinessPrice
          ? parseFloat(formData.amazonBusinessPrice)
          : undefined,
        amazonMinPrice: formData.amazonMinPrice
          ? parseFloat(formData.amazonMinPrice)
          : undefined,
        amazonMaxPrice: formData.amazonMaxPrice
          ? parseFloat(formData.amazonMaxPrice)
          : undefined,
        prestashopPrice: formData.prestashopPrice
          ? parseFloat(formData.prestashopPrice)
          : undefined,
        prestashopOfferPrice: formData.prestashopOfferPrice
          ? parseFloat(formData.prestashopOfferPrice)
          : undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        height: formData.height ? parseFloat(formData.height) : undefined,
        width: formData.width ? parseFloat(formData.width) : undefined,
        depth: formData.depth ? parseFloat(formData.depth) : undefined,
        erpStock: formData.erpStock ? parseInt(formData.erpStock) : undefined,
        amazonStock: formData.amazonStock
          ? parseInt(formData.amazonStock)
          : undefined,
        prestashopStock: formData.prestashopStock
          ? parseInt(formData.prestashopStock)
          : undefined,
        minimumStock: formData.minimumStock
          ? parseInt(formData.minimumStock)
          : undefined,
        preparationTime: formData.preparationTime
          ? parseInt(formData.preparationTime)
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
            label="SKU / Referencia"
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

          <Input
            label="ASIN (Amazon)"
            name="asin"
            value={formData.asin}
            onChange={handleChange}
            icon={<FaAmazon />}
            fullWidth
          />

          <div className="form-row">
            <Input
              label="Código de barras (EAN13)"
              name="ean13"
              value={formData.ean13}
              onChange={handleChange}
              fullWidth
            />

            <Input
              label="UPC"
              name="upc"
              value={formData.upc}
              onChange={handleChange}
              fullWidth
            />
          </div>

          <div className="form-row">
            <Input
              label="Marca"
              name="brand"
              value={formData.brand}
              onChange={handleChange}
              fullWidth
            />

            <Input
              label="Fabricante / Proveedor"
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

          <div className="form-row">
            <Input
              label="Peso (kg)"
              type="number"
              name="weight"
              value={formData.weight}
              onChange={handleChange}
              icon={<FaWeight />}
              fullWidth
              step="0.01"
              min="0"
            />

            <Input
              label="Tiempo de preparación (días)"
              type="number"
              name="preparationTime"
              value={formData.preparationTime}
              onChange={handleChange}
              icon={<FaClock />}
              fullWidth
              min="1"
            />
          </div>
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
              helperText="Si se especifica, prevalece sobre el costo normal"
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
              helperText="Usar 0.75 para un 25% de margen"
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
            <span>PVPM (Precio mínimo calculado):</span>
            <strong>{formatCurrency(calculatedMinPrice)}</strong>
          </div>

          <h3>Precios de venta</h3>

          <div className="form-row">
            <Input
              label="Precio Amazon (€)"
              type="number"
              name="amazonPrice"
              value={formData.amazonPrice}
              onChange={handleChange}
              icon={<FaAmazon />}
              fullWidth
              step="0.01"
              min="0"
            />

            <Input
              label="Precio empresas Amazon (€)"
              type="number"
              name="amazonBusinessPrice"
              value={formData.amazonBusinessPrice}
              onChange={handleChange}
              fullWidth
              step="0.01"
              min="0"
            />
          </div>

          <div className="form-row">
            <Input
              label="Precio mín. Amazon (€)"
              type="number"
              name="amazonMinPrice"
              value={formData.amazonMinPrice}
              onChange={handleChange}
              fullWidth
              step="0.01"
              min="0"
            />

            <Input
              label="Precio máx. Amazon (€)"
              type="number"
              name="amazonMaxPrice"
              value={formData.amazonMaxPrice}
              onChange={handleChange}
              fullWidth
              step="0.01"
              min="0"
            />
          </div>

          <div className="form-row">
            <Input
              label="PVP Prestashop (€)"
              type="number"
              name="prestashopPrice"
              value={formData.prestashopPrice}
              onChange={handleChange}
              icon={<FaShoppingCart />}
              fullWidth
              step="0.01"
              min="0"
              helperText="Precio sin IVA, 4% menos que Amazon"
            />

            <div className="checkbox-field">
              <input
                type="checkbox"
                id="isWebOffer"
                name="isWebOffer"
                checked={formData.isWebOffer}
                onChange={handleChange}
              />
              <label htmlFor="isWebOffer">PVP Oferta (exclusivo web)</label>
            </div>
          </div>

          {formData.isWebOffer && (
            <Input
              label="Precio oferta Prestashop (€)"
              type="number"
              name="prestashopOfferPrice"
              value={formData.prestashopOfferPrice}
              onChange={handleChange}
              error={errors.prestashopOfferPrice}
              fullWidth
              step="0.01"
              min="0"
              required
              helperText="Precio especial solo para la web"
            />
          )}
        </div>

        <div className="form-column">
          <h3>Stock y configuración</h3>

          <div className="form-row">
            <Input
              label="Stock ERP"
              type="number"
              name="erpStock"
              value={formData.erpStock}
              onChange={handleChange}
              fullWidth
              min="0"
              disabled
              helperText="Solo lectura, viene del ERP"
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

          <div className="checkboxes-group">
            <div className="checkbox-field">
              <input
                type="checkbox"
                id="equalizeStockWithErp"
                name="equalizeStockWithErp"
                checked={formData.equalizeStockWithErp}
                onChange={handleChange}
              />
              <label htmlFor="equalizeStockWithErp">
                Igualar stock con ERP
              </label>
            </div>

            <div className="checkbox-field">
              <input
                type="checkbox"
                id="setManualStock"
                name="setManualStock"
                checked={formData.setManualStock}
                onChange={handleChange}
              />
              <label htmlFor="setManualStock">
                Establecer stock manualmente
              </label>
            </div>
          </div>

          <Input
            label="Stock mínimo"
            type="number"
            name="minimumStock"
            value={formData.minimumStock}
            onChange={handleChange}
            fullWidth
            min="0"
          />

          <h3>Estados en plataformas</h3>

          <div className="checkboxes-group">
            <div className="checkbox-field">
              <input
                type="checkbox"
                id="active"
                name="active"
                checked={formData.active}
                onChange={handleChange}
              />
              <label htmlFor="active">Producto activo (ERP)</label>
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

            {formData.hasBuyBox && (
              <div className="checkbox-field">
                <input
                  type="checkbox"
                  id="hasBuyBox"
                  name="hasBuyBox"
                  checked={formData.hasBuyBox}
                  onChange={handleChange}
                  disabled
                />
                <label htmlFor="hasBuyBox">Tiene el Buy Box ⭐</label>
              </div>
            )}
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
