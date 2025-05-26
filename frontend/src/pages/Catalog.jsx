import React, { useState, useEffect, useMemo } from "react";
import {
  MdSync,
  MdInventory,
  MdEdit,
  MdSearch,
  MdFilterList,
  MdCheckBox,
  MdCheckBoxOutlineBlank,
} from "react-icons/md";
import { productService } from "../services/api";
import DataTable from "../components/common/DataTable";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import BulkStockModal from "../components/catalog/BulkStockModal";
import ToastNotifier from "../components/common/ToastNotifier";
import { formatCurrency, formatDateTime } from "../utils/formatters";
import "./Catalog.css";

const Catalog = () => {
  // Estados principales
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estados de filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [brands, setBrands] = useState([]);

  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize] = useState(20);

  // Estados de selección y acciones
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showBulkStockModal, setShowBulkStockModal] = useState(false);
  const [bulkStockLoading, setBulkStockLoading] = useState(false);

  // Estados de estadísticas y notificaciones
  const [stats, setStats] = useState(null);
  const [toast, setToast] = useState(null);
  const [syncLoading, setSyncLoading] = useState(false);

  // Cargar datos inicial
  useEffect(() => {
    loadProducts();
    loadBrands();
    loadStats();
  }, [currentPage, searchTerm, selectedBrand, selectedStatus]);

  // Función para cargar productos
  const loadProducts = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: pageSize,
        search: searchTerm,
        brand: selectedBrand,
        status: selectedStatus,
        sortBy: "updatedAt",
        sortOrder: "desc",
      };

      const response = await productService.getProducts(params);
      setProducts(response.products);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.totalItems);
      setError(null);
    } catch (error) {
      console.error("Error loading products:", error);
      setError("Error cargando productos");
      showToast("Error cargando productos", "error");
    } finally {
      setLoading(false);
    }
  };

  // Función para cargar marcas
  const loadBrands = async () => {
    try {
      const brandsData = await productService.getBrands();
      setBrands(brandsData);
    } catch (error) {
      console.error("Error loading brands:", error);
    }
  };

  // Función para cargar estadísticas
  const loadStats = async () => {
    try {
      const statsData = await productService.getStats();
      setStats(statsData);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  // Función para sincronizar productos
  const handleSync = async () => {
    try {
      setSyncLoading(true);
      showToast("Iniciando sincronización completa...", "info");

      const results = await productService.syncProducts();

      if (results.results.created > 0 || results.results.updated > 0) {
        showToast(
          `Sincronización completada: ${results.results.created} creados, ${results.results.updated} actualizados`,
          "success"
        );
      } else {
        showToast("Sincronización completada - No hay cambios", "info");
      }

      loadProducts();
      loadStats();
    } catch (error) {
      console.error("Error syncing products:", error);
      showToast(
        "Error en la sincronización: " +
          (error.response?.data?.message || error.message),
        "error"
      );
    } finally {
      setSyncLoading(false);
    }
  };

  // Función para sincronizar status de productos
  const handleSyncStatus = async () => {
    try {
      setSyncLoading(true);
      showToast(
        "Iniciando sincronización de status (esto puede tomar varios minutos)...",
        "info"
      );

      const results = await productService.syncProductStatus();

      if (results.results.productsUpdated > 0) {
        showToast(
          `Sincronización de status completada: ${results.results.productsUpdated} productos actualizados`,
          "success"
        );
      } else {
        showToast(
          "Sincronización de status completada - No hay cambios",
          "info"
        );
      }

      loadProducts();
      loadStats();
    } catch (error) {
      console.error("Error syncing product status:", error);
      showToast(
        "Error en la sincronización de status: " +
          (error.response?.data?.message || error.message),
        "error"
      );
    } finally {
      setSyncLoading(false);
    }
  };

  // Función para actualizar stock masivo
  const handleBulkStockUpdate = async (updates) => {
    try {
      setBulkStockLoading(true);
      const result = await productService.bulkUpdateStock(updates);

      if (result.results.failed > 0) {
        showToast(
          `Actualización parcial: ${result.results.successful} exitosos, ${result.results.failed} fallidos`,
          "info"
        );
      } else {
        showToast(
          `Stock actualizado para ${result.results.successful} productos`,
          "success"
        );
      }

      setSelectedProducts([]);
      setShowBulkStockModal(false);
      loadProducts();
    } catch (error) {
      console.error("Error updating stock:", error);
      showToast("Error actualizando stock", "error");
    } finally {
      setBulkStockLoading(false);
    }
  };

  // Función para mostrar toast
  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Manejar cambio de página
  const handlePageChange = (page) => {
    setCurrentPage(page);
    setSelectedProducts([]);
  };

  // Manejar cambio de búsqueda
  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
    setSelectedProducts([]);
  };

  // Manejar cambio de filtro de estado
  const handleStatusFilter = (status) => {
    setSelectedStatus(status);
    setCurrentPage(1);
    setSelectedProducts([]);
  };

  // Manejar cambio de marca
  const handleBrandChange = (brand) => {
    setSelectedBrand(brand);
    setCurrentPage(1);
    setSelectedProducts([]);
  };

  // Obtener productos seleccionados para el modal
  const selectedProductsData = useMemo(() => {
    return products.filter((product) => selectedProducts.includes(product._id));
  }, [products, selectedProducts]);

  // Configuración de columnas para la tabla
  const columns = [
    {
      title: "SKU",
      field: "sellerSku",
      width: "150px",
      render: (product) => (
        <div className="product-sku">
          <strong>{product.sellerSku}</strong>
          {product.asin && (
            <div className="product-asin">ASIN: {product.asin}</div>
          )}
        </div>
      ),
    },
    {
      title: "Producto",
      field: "title",
      render: (product) => (
        <div className="product-info">
          <div className="product-title">{product.title}</div>
          {product.brand && (
            <div className="product-brand">{product.brand}</div>
          )}
        </div>
      ),
    },
    {
      title: "Estado",
      field: "status",
      width: "120px",
      render: (product) => (
        <span className={`status-chip ${product.status.toLowerCase()}`}>
          {product.status}
        </span>
      ),
    },
    {
      title: "Stock",
      field: "quantity",
      width: "100px",
      render: (product) => (
        <div className="stock-info">
          <span className="stock-quantity">{product.quantity || 0}</span>
          <span className="stock-channel">{product.fulfillmentChannel}</span>
        </div>
      ),
    },
    {
      title: "Precio",
      field: "price",
      width: "120px",
      render: (product) => (
        <span className="product-price">
          {product.price ? formatCurrency(product.price) : "-"}
        </span>
      ),
    },
    {
      title: "Última actualización",
      field: "updatedAt",
      width: "180px",
      render: (product) => (
        <div className="update-info">
          <div>{formatDateTime(product.updatedAt)}</div>
          {product.syncStatus === "error" && (
            <div className="sync-error">Error de sincronización</div>
          )}
        </div>
      ),
    },
    {
      title: "Acciones",
      width: "120px",
      render: (product) => (
        <div className="product-actions">
          <Button
            variant="text"
            size="small"
            icon={<MdEdit />}
            onClick={() => handleEditProduct(product)}
          >
            Editar
          </Button>
        </div>
      ),
    },
  ];

  // Función placeholder para editar producto
  const handleEditProduct = (product) => {
    console.log("Edit product:", product);
    // TODO: Implementar modal de edición
  };

  // Filtros de estado
  const statusFilters = [
    { value: "all", label: "Todos", count: stats?.total || 0 },
    { value: "Active", label: "Activos", count: stats?.byStatus?.Active || 0 },
    {
      value: "Inactive",
      label: "Inactivos",
      count: stats?.byStatus?.Inactive || 0,
    },
    {
      value: "Incomplete",
      label: "Incompletos",
      count: stats?.byStatus?.Incomplete || 0,
    },
  ];

  return (
    <div className="catalog-page">
      {/* Header */}
      <div className="catalog-header">
        <div className="catalog-title">
          <MdInventory />
          <h1>Catálogo de Productos</h1>
        </div>
        <div className="catalog-actions">
          <Button
            variant="outlined"
            icon={<MdSync />}
            onClick={handleSync}
            disabled={syncLoading}
          >
            {syncLoading ? "Sincronizando..." : "Sincronizar"}
          </Button>
          {selectedProducts.length > 0 && (
            <Button
              variant="filled"
              icon={<MdInventory />}
              onClick={() => setShowBulkStockModal(true)}
            >
              Actualizar Stock ({selectedProducts.length})
            </Button>
          )}
        </div>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="catalog-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total productos</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.byStatus.Active || 0}</div>
            <div className="stat-label">Activos</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.byStatus.Inactive || 0}</div>
            <div className="stat-label">Inactivos</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.byStatus.Incomplete || 0}</div>
            <div className="stat-label">Incompletos</div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="catalog-filters">
        <div className="search-section">
          <Input
            label="Buscar por SKU, ASIN o título..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            icon={<MdSearch />}
          />
        </div>

        <div className="brand-filter">
          <select
            value={selectedBrand}
            onChange={(e) => handleBrandChange(e.target.value)}
          >
            <option value="all">Todas las marcas</option>
            {brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Chips de estado */}
      <div className="status-chips">
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            className={`status-chip-filter ${
              selectedStatus === filter.value ? "active" : ""
            }`}
            onClick={() => handleStatusFilter(filter.value)}
          >
            {filter.label} ({filter.count})
          </button>
        ))}
      </div>

      {/* Tabla de productos */}
      <DataTable
        data={products}
        columns={columns}
        loading={loading}
        emptyMessage="No hay productos disponibles"
        showSelection={true}
        selectedRows={selectedProducts}
        onRowSelect={setSelectedProducts}
        showPagination={true}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        className="products-table"
      />

      {/* Modal de actualización masiva de stock */}
      {showBulkStockModal && (
        <BulkStockModal
          products={selectedProductsData}
          onClose={() => setShowBulkStockModal(false)}
          onUpdate={handleBulkStockUpdate}
          loading={bulkStockLoading}
        />
      )}

      {/* Toast de notificaciones */}
      {toast && <ToastNotifier message={toast.message} type={toast.type} />}
    </div>
  );
};

export default Catalog;
