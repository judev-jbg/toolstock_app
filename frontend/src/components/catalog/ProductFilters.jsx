// frontend/src/components/catalog/ProductFilters.jsx
import React, { useState } from "react";
import "./ProductFilters.css";
import Input from "../common/Input";
import Button from "../common/Button";
import { FaSearch, FaFilter, FaAmazon, FaShoppingCart } from "react-icons/fa";

const ProductFilters = ({ onFilter, categories = [] }) => {
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    active: "true",
    platform: "",
    stock: "",
    minPrice: "",
    maxPrice: "",
  });

  const [advancedMode, setAdvancedMode] = useState(false);

  // Manejar cambios en los filtros
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
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
      active: "true",
      platform: "",
      stock: "",
      minPrice: "",
      maxPrice: "",
    });
    onFilter({});
  };

  return (
    <div className="product-filters">
      <div className="filters-row">
        <div className="search-filter">
          <Input
            label="Buscar"
            name="search"
            value={filters.search}
            onChange={handleChange}
            icon={<FaSearch />}
            fullWidth
          />
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
            <label>Categoría</label>
            <select
              name="category"
              value={filters.category}
              onChange={handleChange}
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Estado</label>
            <select
              name="active"
              value={filters.active}
              onChange={handleChange}
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Plataforma</label>
            <select
              name="platform"
              value={filters.platform}
              onChange={handleChange}
            >
              <option value="">Todas</option>
              <option value="amazon">
                <FaAmazon /> Amazon
              </option>
              <option value="prestashop">
                <FaShoppingCart /> PrestaShop
              </option>
            </select>
          </div>

          <div className="filter-group">
            <label>Stock</label>
            <select name="stock" value={filters.stock} onChange={handleChange}>
              <option value="">Todos</option>
              <option value="in">En stock</option>
              <option value="out">Sin stock</option>
            </select>
          </div>

          <div className="filter-group price-range">
            <div className="price-filter">
              <label>Precio mínimo</label>
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
              <label>Precio máximo</label>
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
