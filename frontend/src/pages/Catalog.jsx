import React, { useState, useEffect, useMemo } from "react";
import {
  MdInventory,
  MdEdit,
  MdSearch,
  MdUpload,
  MdDashboard,
} from "react-icons/md";
import { productService } from "../services/api";
import DataTable from "../components/common/DataTable";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import BulkStockModal from "../components/catalog/BulkStockModal";
import ImportExcelModal from "../components/catalog/ImportExcelModal";
import ToastNotifier from "../components/common/ToastNotifier";
import { formatCurrency, formatDateTime } from "../utils/formatters";
import PVPMConfigModal from "../components/catalog/PVPMConfigModal";
import { MdSettings, MdWarning, MdHistory } from "react-icons/md";
import { pricingService } from "../services/api";
import { useNavigate } from "react-router-dom";
import ProductPricingModal from "../components/catalog/ProductPricingModal";
import "./Catalog.css";

const Catalog = () => {
  const navigate = useNavigate();
  const [showProductPricingModal, setShowProductPricingModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  // Estados principales
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // Estados de importación
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  // Estados de estadísticas y notificaciones
  const [stats, setStats] = useState(null);
  const [toast, setToast] = useState(null);

  // Estados de precios
  const [showPVPMConfigModal, setShowPVPMConfigModal] = useState(false);
  const [pendingActionsCount, setPendingActionsCount] = useState(0);

  // Cargar datos inicial
  useEffect(() => {
    loadProducts();
    loadBrands();
    loadStats();
    loadPendingActions();
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
    } catch (error) {
      console.error("Error loading products:", error);
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

  // Función para cargar acciones pendientes de precios
  const loadPendingActions = async () => {
    try {
      const data = await pricingService.getPendingActions();
      const total = Object.values(data.pendingActions).reduce(
        (sum, action) => sum + action.count,
        0
      );
      setPendingActionsCount(total);
    } catch (error) {
      console.error("Error loading pending actions:", error);
    }
  };

  // Función para importar productos desde Excel
  const handleImportProducts = async (file) => {
    try {
      setImportLoading(true);
      showToast("Importando productos desde Excel...", "info");

      const results = await productService.importProducts(file);

      if (results.results.errors.length > 0) {
        showToast(
          `Importación parcial: ${results.results.processed} procesados, ${results.results.errors.length} errores`,
          "info"
        );
      } else {
        showToast(
          `Importación exitosa: ${results.results.created} creados, ${results.results.updated} actualizados`,
          "success"
        );
      }

      // Cerrar modal y recargar datos
      setShowImportModal(false);
      loadProducts();
      loadStats();

      // Mostrar información de sincronización de Amazon si está disponible
      if (results.amazonSync) {
        setTimeout(() => {
          showToast(
            `Sincronización Amazon: ${
              results.amazonSync.created + results.amazonSync.updated
            } productos sincronizados`,
            "info"
          );
        }, 2000);
      }
    } catch (error) {
      console.error("Error importing products:", error);
      showToast(
        "Error importando productos: " +
          (error.response?.data?.message || error.message),
        "error"
      );
    } finally {
      setImportLoading(false);
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

  // Función para actualizar configuración de PVPM
  const handlePVPMConfigUpdate = () => {
    setShowPVPMConfigModal(false);
    loadProducts();
    loadStats();
    loadPendingActions();
    showToast("Configuración de PVPM actualizada", "success");
  };

  // Función para mostrar toast
  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Manejar cambio de página
  const handlePageChange = (page) => {
    setCurrentPage(page);
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
      field: "erp_sku",
      width: "150px",
      render: (product) => (
        <div className="product-sku">
          <strong>{product.erp_sku || product.amz_sellerSku}</strong>
          {product.amz_asin && (
            <div className="product-asin">ASIN: {product.amz_asin}</div>
          )}
        </div>
      ),
    },
    {
      title: "Producto",
      field: "erp_name",
      render: (product) => (
        <div className="product-info">
          <div className="product-title">
            {product.erp_name || product.amz_title}
          </div>
          {(product.erp_manufacturer || product.amz_brand) && (
            <div className="product-brand">
              {product.erp_manufacturer || product.amz_brand}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Coste",
      field: "erp_cost",
      width: "100px",
      render: (product) => (
        <span className="product-cost">
          {product.erp_cost ? formatCurrency(product.erp_cost) : "-"}
        </span>
      ),
    },
    {
      title: "Estado ERP",
      field: "amz_status",
      width: "120px",
      render: (product) => {
        const status =
          product.amz_status ||
          (product.erp_status === 0 ? "Active" : "Inactive");
        return (
          <span className={`status-chip ${status.toLowerCase()}`}>
            {status}
          </span>
        );
      },
    },
    {
      title: "Stock AMZ",
      field: "stock-amz",
      width: "100px",
      render: (product) => (
        <div className="stock-info">
          <span className="stock-quantity">{product.amz_quantity || 0}</span>
          {product.amz_fulfillmentChannel && (
            <span className="stock-channel">
              {product.amz_fulfillmentChannel}
            </span>
          )}
        </div>
      ),
    },
    {
      title: "Precio WEB",
      field: "erp_price",
      width: "120px",
      render: (product) => (
        <span className="product-price">
          {product.erp_price ? formatCurrency(product.erp_price * 1.21) : "-"}
        </span>
      ),
    },
    {
      title: "Precio AMZ",
      field: "amz_price",
      width: "120px",
      render: (product) => (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
        >
          <span className="product-price">
            {product.amz_price ? formatCurrency(product.amz_price) : "-"}
          </span>
          {product.pricing?.fixedPrice > 0 && (
            <span
              style={{
                fontSize: "0.75rem",
                color: "var(--warning-color)",
                fontWeight: "600",
              }}
            >
              FIJO
            </span>
          )}
        </div>
      ),
    },
    {
      title: "Última actualización",
      field: "updatedAt",
      width: "180px",
      render: (product) => (
        <div className="update-info">
          <div>{formatDateTime(product.updatedAt)}</div>
          {product.amz_syncStatus === "error" && (
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
    setSelectedProduct(product);
    setShowProductPricingModal(true);
  };

  const handleProductPricingUpdate = () => {
    setShowProductPricingModal(false);
    setSelectedProduct(null);
    loadProducts();
    showToast("Configuración de producto actualizada", "success");
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
          <h1>Catálogo de Productos</h1>
        </div>
        <div className="catalog-actions">
          <Button
            variant="outlined"
            icon={<MdWarning />}
            onClick={() => navigate("/catalog/pending-actions")}
            style={
              pendingActionsCount > 0
                ? {
                    backgroundColor: "var(--warning-color)",
                    color: "white",
                    borderColor: "var(--warning-color)",
                  }
                : {}
            }
          >
            Acciones Pendientes
            {pendingActionsCount > 0 && `(${pendingActionsCount})`}
          </Button>
          <Button
            variant="outlined"
            icon={<MdDashboard />}
            onClick={() => navigate("/catalog/pricing-dashboard")}
          >
            Dashboard Pricing
          </Button>
          <Button
            variant="outlined"
            icon={<MdUpload />}
            onClick={() => setShowImportModal(true)}
          >
            Importar Excel
          </Button>
          <Button
            variant="outlined"
            icon={<MdHistory />}
            onClick={() => navigate("/catalog/price-history")}
          >
            Historial
          </Button>
          <Button
            variant="outlined"
            icon={<MdSettings />}
            onClick={() => setShowPVPMConfigModal(true)}
          >
            Config. PVPM
          </Button>
        </div>
      </div>

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

      {selectedProducts.length > 0 && (
        <div className="selection-feedback">
          <div className="selection-info">
            <span className="selection-count">
              {selectedProducts.length} producto
              {selectedProducts.length !== 1 ? "s" : ""} seleccionado
              {selectedProducts.length !== 1 ? "s" : ""}
            </span>
            <button
              className="clear-selection-btn"
              onClick={() => setSelectedProducts([])}
              title="Limpiar selección"
            >
              Limpiar selección
            </button>
          </div>
          <div className="selection-actions">
            <Button
              variant="filled"
              icon={<MdInventory />}
              onClick={() => setShowBulkStockModal(true)}
              size="small"
            >
              Actualizar Stock
            </Button>
          </div>
        </div>
      )}
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
      {/* Modal de importación de Excel */}
      {showImportModal && (
        <ImportExcelModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImportProducts}
          loading={importLoading}
        />
      )}
      {/* Modal de configuracion PVPM */}
      {showPVPMConfigModal && (
        <PVPMConfigModal
          onClose={() => setShowPVPMConfigModal(false)}
          onUpdate={handlePVPMConfigUpdate}
        />
      )}
      {/* Modal de configuración de producto */}
      {showProductPricingModal && selectedProduct && (
        <ProductPricingModal
          product={selectedProduct}
          onClose={() => setShowProductPricingModal(false)}
          onUpdate={handleProductPricingUpdate}
        />
      )}
      {/* Toast de notificaciones */}
      {toast && <ToastNotifier message={toast.message} type={toast.type} />}
    </div>
  );
};

export default Catalog;
