// frontend/src/components/catalog/ProductFilters.jsx - VERSIÓN ACTUALIZADA
import React, { useState } from "react";
import "./ProductFilters.css";
import Input from "../common/Input";
import Button from "../common/Button";
import {
  FaSearch,
  FaFilter,
  FaAmazon,
  FaShoppingCart,
  FaIndustry,
} from "react-icons/fa";

const ProductFilters = ({ onFilter, categories = [], manufacturers = [] }) => {
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    manufacturer: "",
    active: "",
    platform: "",
    stock: "",
    minPrice: "",
    maxPrice: "",
    hasBuyBox: "",
    isWebOffer: "",
  });

  const [advancedMode, setAdvancedMode] = useState(false);

  // Chips para estado ERP
  const [activeStateFilter, setActiveStateFilter] = useState("all");

  // Manejar cambios en los filtros
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Manejar chips de estado
  const handleStateChip = (state) => {
    setActiveStateFilter(state);
    let activeValue = "";

    switch (state) {
      case "active":
        activeValue = "true";
        break;
      case "inactive":
        activeValue = "false";
        break;
      default:
        activeValue = "";
    }

    setFilters((prev) => ({
      ...prev,
      active: activeValue,
    }));
  };

  // Aplicar filtros
  const applyFilters = () => {
    // Eliminar filtros vacíos
    const activeFilters = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "") {
        activeFilters[key] = value;
      }
    });

    onFilter(activeFilters);
  };

  // Limpiar filtros
  const clearFilters = () => {
    setFilters({
      search: "",
      category: "",
      manufacturer: "",
      active: "",
      platform: "",
      stock: "",
      minPrice: "",
      maxPrice: "",
      hasBuyBox: "",
      isWebOffer: "",
    });
    setActiveStateFilter("all");
    onFilter({});
  };

  // Aplicar filtros automáticamente cuando cambie el estado
  React.useEffect(() => {
    applyFilters();
  }, [filters.active]);

  return (
    <div className="product-filters">
      <div className="filters-row">
        <div className="search-filter">
          <Input
            label="Buscar por SKU, ASIN, descripción o referencia"
            name="search"
            value={filters.search}
            onChange={handleChange}
            icon={<FaSearch />}
            fullWidth
          />
        </div>

        {/* Chips de estado */}
        <div className="state-chips">
          <button
            className={`state-chip ${
              activeStateFilter === "all" ? "active" : ""
            }`}
            onClick={() => handleStateChip("all")}
          >
            Todos
          </button>
          <button
            className={`state-chip ${
              activeStateFilter === "active" ? "active" : ""
            }`}
            onClick={() => handleStateChip("active")}
          >
            Activos
          </button>
          <button
            className={`state-chip ${
              activeStateFilter === "inactive" ? "active" : ""
            }`}
            onClick={() => handleStateChip("inactive")}
          >
            Anulados
          </button>
        </div>

        <div className="filters-actions">
          <Button
            variant="outlined"
            size="small"
            onClick={() => setAdvancedMode(!advancedMode)}
            icon={<FaFilter />}
          >
            {advancedMode ? "Simple" : "Avanzado"}
          </Button>
          <Button variant="outlined" size="small" onClick={clearFilters}>
            Limpiar
          </Button>
          <Button size="small" onClick={applyFilters}>
            Filtrar
          </Button>
        </div>
      </div>

      {advancedMode && (
        <div className="advanced-filters">
          <div className="filter-group">
            <label>Proveedor</label>
            <select
              name="manufacturer"
              value={filters.manufacturer || ""}
              onChange={handleChange}
            >
              <option value="">Todos los proveedores</option>
              {manufacturers.map((manufacturer) => (
                <option key={manufacturer} value={manufacturer}>
                  {manufacturer}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Categoría</label>
            <select
              name="category"
              value={filters.category}
              onChange={handleChange}
            >
              <option value="">Todas las categorías</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Plataforma</label>
            <select
              name="platform"
              value={filters.platform}
              onChange={handleChange}
            >
              <option value="">Todas las plataformas</option>
              <option value="amazon">Amazon</option>
              <option value="prestashop">PrestaShop</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Stock ERP</label>
            <select name="stock" value={filters.stock} onChange={handleChange}>
              <option value="">Todos</option>
              <option value="in">Con stock</option>
              <option value="out">Sin stock</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Buy Box</label>
            <select
              name="hasBuyBox"
              value={filters.hasBuyBox}
              onChange={handleChange}
            >
              <option value="">Todos</option>
              <option value="true">Con Buy Box</option>
              <option value="false">Sin Buy Box</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Oferta Web</label>
            <select
              name="isWebOffer"
              value={filters.isWebOffer}
              onChange={handleChange}
            >
              <option value="">Todos</option>
              <option value="true">Solo ofertas web</option>
              <option value="false">Sin ofertas</option>
            </select>
          </div>

          <div className="filter-group price-range">
            <div className="price-filter">
              <label>Precio mínimo (€)</label>
              <input
                type="number"
                name="minPrice"
                value={filters.minPrice}
                onChange={handleChange}
                placeholder="Min"
                min="0"
                step="0.01"
              />
            </div>
            <div className="price-filter">
              <label>Precio máximo (€)</label>
              <input
                type="number"
                name="maxPrice"
                value={filters.maxPrice}
                onChange={handleChange}
                placeholder="Max"
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductFilters;
