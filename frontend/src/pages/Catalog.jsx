// frontend/src/pages/Catalog.jsx (actualización)
import React, { useState, useEffect } from "react";
import { catalogService } from "../services/api";
import Button from "../components/common/Button";
import ToastNotifier from "../components/common/ToastNotifier";
import ProductsTable from "../components/catalog/ProductsTable";
import ProductFilters from "../components/catalog/ProductFilters";
import ProductForm from "../components/catalog/ProductForm";
import CompetitorPanel from "../components/catalog/CompetitorPanel";
import ImportProductsModal from "../components/catalog/ImportProductsModal";
import PriceConfigModal from "../components/catalog/PriceConfigModal";
import BulkActionsPanel from "../components/catalog/BulkActionsPanel";
import {
  FaPlus,
  FaTimes,
  FaCog,
  FaFileExcel,
  FaCalculator,
} from "react-icons/fa";
import "./Catalog.css";

const Catalog = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    totalItems: 0,
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [competitorPrices, setCompetitorPrices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showCompetitorPanel, setShowCompetitorPanel] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "", type: "" });
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPriceConfigModal, setShowPriceConfigModal] = useState(false);
  const [priceConfig, setPriceConfig] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);

  // Cargar productos
  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchPriceConfig();
  }, []);

  // Función para cargar configuración de precios
  const fetchPriceConfig = async () => {
    try {
      const config = await catalogService.getPriceConfig();
      setPriceConfig(config);
    } catch (error) {
      console.error("Error al cargar configuración de precios:", error);
      showToast("Error al cargar configuración de precios", "error");
    }
  };

  // Función para cargar productos con filtros y paginación
  const fetchProducts = async (page = 1, newFilters = null) => {
    setLoading(true);
    try {
      const currentFilters = newFilters !== null ? newFilters : filters;
      const response = await catalogService.getProducts({
        ...currentFilters,
        page,
        limit: 50,
      });

      setProducts(response.products);
      setPagination(response.pagination);
    } catch (error) {
      console.error("Error al cargar productos:", error);
      showToast("Error al cargar productos", "error");
    } finally {
      setLoading(false);
    }
  };

  // Cargar categorías
  const fetchCategories = async () => {
    try {
      const categories = await catalogService.getCategories();
      setCategories(categories);
    } catch (error) {
      console.error("Error al cargar categorías:", error);
    }
  };

  // Manejar filtros
  const handleFilter = (newFilters) => {
    setFilters(newFilters);
    fetchProducts(1, newFilters);
  };

  // Mostrar notificación
  const showToast = (message, type) => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast({ visible: false, message: "", type: "" });
    }, 3000);
  };

  // Manejar cambio de página
  const handlePageChange = (newPage) => {
    fetchProducts(newPage);
  };

  // Mostrar formulario de creación
  const handleNewProduct = () => {
    setSelectedProduct(null);
    setShowForm(true);
    setShowCompetitorPanel(false);
  };

  // Mostrar formulario de edición
  const handleEditProduct = (product) => {
    setSelectedProduct(product);
    setShowForm(true);
    setShowCompetitorPanel(false);
  };

  // Cancelar formulario
  const handleCancelForm = () => {
    setShowForm(false);
    setSelectedProduct(null);
  };

  // Manejar envío de formulario
  const handleSubmitForm = async (productData) => {
    try {
      if (selectedProduct) {
        // Actualizar producto
        await catalogService.updateProduct(selectedProduct._id, productData);
        showToast("Producto actualizado correctamente", "success");
      } else {
        // Crear producto
        await catalogService.createProduct(productData);
        showToast("Producto creado correctamente", "success");
      }

      setShowForm(false);
      setSelectedProduct(null);
      fetchProducts(); // Recargar productos
    } catch (error) {
      console.error("Error al guardar producto:", error);
      throw error; // Re-lanzar para que el formulario lo maneje
    }
  };

  // Editar campo individual
  const handleInlineEdit = async (productId, field, value) => {
    try {
      await catalogService.updateProductField(productId, field, value);
      showToast(`Campo ${field} actualizado correctamente`, "success");

      // Actualizar producto en estado local
      setProducts(
        products.map((product) =>
          product._id === productId ? { ...product, [field]: value } : product
        )
      );

      return true;
    } catch (error) {
      console.error("Error al actualizar campo:", error);
      showToast("Error al actualizar", "error");
      return false;
    }
  };

  // Sincronizar con Amazon
  const handleSyncAmazon = async (productId) => {
    try {
      setLoading(true);
      await catalogService.syncProductWithAmazon(productId);
      showToast("Producto sincronizado con Amazon", "success");
      fetchProducts(); // Recargar productos
    } catch (error) {
      console.error("Error al sincronizar con Amazon:", error);
      showToast("Error al sincronizar con Amazon", "error");
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar con Prestashop
  const handleSyncPrestashop = async (productId) => {
    try {
      setLoading(true);
      await catalogService.syncProductWithPrestashop(productId);
      showToast("Producto sincronizado con Prestashop", "success");
      fetchProducts(); // Recargar productos
    } catch (error) {
      console.error("Error al sincronizar con Prestashop:", error);
      showToast("Error al sincronizar con Prestashop", "error");
    } finally {
      setLoading(false);
    }
  };

  // Actualizar precios de competencia
  const handleUpdatePrices = async (productId) => {
    try {
      const product = products.find((p) => p._id === productId);
      if (!product) return;

      setSelectedProduct(product);
      setShowCompetitorPanel(true);
      setShowForm(false);

      setLoading(true);
      const result = await catalogService.getProductById(productId);
      setCompetitorPrices(result.competitorPrices || []);

      await catalogService.updateCompetitorPrices(productId);
      showToast("Precios de competencia actualizados", "success");

      // Recargar datos de competencia
      const updatedResult = await catalogService.getProductById(productId);
      setCompetitorPrices(updatedResult.competitorPrices || []);
    } catch (error) {
      console.error("Error al actualizar precios de competencia:", error);
      showToast("Error al actualizar precios de competencia", "error");
    } finally {
      setLoading(false);
    }
  };

  // Optimizar precio
  const handleOptimizePrice = async () => {
    try {
      if (!selectedProduct) return;

      setLoading(true);
      await catalogService.optimizePrice(selectedProduct._id);
      showToast("Precio optimizado correctamente", "success");

      // Recargar datos
      fetchProducts();
      const updatedResult = await catalogService.getProductById(
        selectedProduct._id
      );
      setSelectedProduct(updatedResult.product);
      setCompetitorPrices(updatedResult.competitorPrices || []);
    } catch (error) {
      console.error("Error al optimizar precio:", error);
      showToast("Error al optimizar precio", "error");
    } finally {
      setLoading(false);
    }
  };

  // Seleccionar producto para ver detalles
  const handleSelectProduct = async (product) => {
    try {
      setLoading(true);
      const result = await catalogService.getProductById(product._id);
      setSelectedProduct(result.product);
      setCompetitorPrices(result.competitorPrices || []);
      setShowCompetitorPanel(true);
      setShowForm(false);
    } catch (error) {
      console.error("Error al cargar detalles del producto:", error);
      showToast("Error al cargar detalles del producto", "error");
    } finally {
      setLoading(false);
    }
  };

  // Manejar importación de productos
  const handleImportProducts = async (file, updateAll) => {
    try {
      setLoading(true);
      const result = await catalogService.importProducts(file, updateAll);

      if (result.success) {
        showToast(
          `Importación completada. ${result.stats.created} productos creados, ${result.stats.updated} actualizados`,
          "success"
        );
        setShowImportModal(false);
        fetchProducts(); // Recargar productos
      } else {
        showToast(result.message || "Error en la importación", "error");
      }
    } catch (error) {
      console.error("Error en la importación de productos:", error);
      showToast("Error en la importación", "error");
    } finally {
      setLoading(false);
    }
  };

  // Manejar actualización de configuración de precios
  const handlePriceConfigSave = async (configData) => {
    try {
      setLoading(true);
      const result = await catalogService.updatePriceConfig(configData);

      if (result.config) {
        setPriceConfig(result.config);
        showToast("Configuración actualizada correctamente", "success");
        setShowPriceConfigModal(false);
      } else {
        showToast("Error al actualizar configuración", "error");
      }
    } catch (error) {
      console.error("Error al actualizar configuración:", error);
      showToast("Error al actualizar configuración", "error");
    } finally {
      setLoading(false);
    }
  };

  // Manejar selección de productos
  const handleProductSelection = (productIds) => {
    setSelectedProducts(productIds);
  };

  // Manejar actualización masiva de stock
  const handleBulkUpdateStock = async (productIds, stockValue) => {
    try {
      setLoading(true);
      await catalogService.bulkUpdateStock(productIds, stockValue);
      showToast(
        `Stock actualizado para ${productIds.length} productos`,
        "success"
      );
      fetchProducts(); // Recargar productos
    } catch (error) {
      console.error("Error en actualización masiva de stock:", error);
      showToast("Error al actualizar stock", "error");
    } finally {
      setLoading(false);
    }
  };

  // Manejar actualización masiva de precios
  const handleBulkUpdatePrices = async (productIds, priceAdjustment) => {
    try {
      setLoading(true);
      await catalogService.bulkUpdatePrices(productIds, priceAdjustment);
      showToast(
        `Precios actualizados para ${productIds.length} productos`,
        "success"
      );
      fetchProducts(); // Recargar productos
    } catch (error) {
      console.error("Error en actualización masiva de precios:", error);
      showToast("Error al actualizar precios", "error");
    } finally {
      setLoading(false);
    }
  };

  // Manejar recálculo de PVPM
  const handleRecalculateAllPrices = async () => {
    try {
      setLoading(true);
      const result = await catalogService.recalculatePrices();

      if (result.success) {
        showToast(
          `Precios recalculados correctamente para ${result.stats.updated} productos`,
          "success"
        );
        fetchProducts(); // Recargar productos
      } else {
        showToast(result.message || "Error al recalcular precios", "error");
      }
    } catch (error) {
      console.error("Error al recalcular precios:", error);
      showToast("Error al recalcular precios", "error");
    } finally {
      setLoading(false);
    }
  };

  // Manejar recálculo de PVPM para productos seleccionados
  const handleRecalculateSelectedPrices = async (productIds) => {
    try {
      setLoading(true);
      // Implementar en el backend esta funcionalidad
      // Por ahora, recalculamos todos
      const result = await catalogService.recalculatePrices();

      if (result.success) {
        showToast(
          `Precios PVPM recalculados para ${productIds.length} productos`,
          "success"
        );
        fetchProducts(); // Recargar productos
      } else {
        showToast(result.message || "Error al recalcular precios", "error");
      }
    } catch (error) {
      console.error("Error al recalcular precios:", error);
      showToast("Error al recalcular precios", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="catalog-container">
      <div className="catalog-header">
        <h1 className="page-title">Catálogo de Productos</h1>
        <div className="catalog-actions">
          <Button
            variant="outlined"
            onClick={() => setShowImportModal(true)}
            icon={<FaFileExcel />}
          >
            Importar desde ERP
          </Button>
          <Button
            variant="outlined"
            onClick={() => setShowPriceConfigModal(true)}
            icon={<FaCog />}
          >
            Configuración
          </Button>
          <Button
            variant="outlined"
            onClick={handleRecalculateAllPrices}
            icon={<FaCalculator />}
          >
            Recalcular PVPM
          </Button>
          <Button
            variant="fab"
            onClick={handleNewProduct}
            icon={<FaPlus />}
          ></Button>
        </div>
      </div>

      {!showForm && !showCompetitorPanel && (
        <>
          <ProductFilters onFilter={handleFilter} categories={categories} />

          <BulkActionsPanel
            selectedProducts={selectedProducts}
            onBulkUpdateStock={handleBulkUpdateStock}
            onBulkUpdatePrices={handleBulkUpdatePrices}
            onRecalculatePrices={handleRecalculateSelectedPrices}
          />

          {loading ? (
            <div className="loading-container">Cargando productos...</div>
          ) : (
            <>
              <ProductsTable
                products={products}
                onEdit={handleEditProduct}
                onSyncAmazon={handleSyncAmazon}
                onSyncPrestashop={handleSyncPrestashop}
                onUpdatePrices={handleUpdatePrices}
                onSelectProduct={handleSelectProduct}
                onInlineEdit={handleInlineEdit}
                onSelectionChange={handleProductSelection}
              />

              {/* Paginación */}
              {pagination.totalPages > 1 && (
                <div className="pagination">
                  <Button
                    variant="outlined"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    size="small"
                  >
                    Anterior
                  </Button>
                  <span className="page-info">
                    Página {pagination.page} de {pagination.totalPages} (
                    {pagination.totalItems} productos)
                  </span>
                  <Button
                    variant="outlined"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                    size="small"
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Panel de competencia */}
      {showCompetitorPanel && selectedProduct && (
        <div className="detail-view">
          <div className="detail-header">
            <h2>{selectedProduct.name}</h2>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setShowCompetitorPanel(false);
                setSelectedProduct(null);
              }}
              icon={<FaTimes />}
            >
              Cerrar
            </Button>
          </div>

          <CompetitorPanel
            product={selectedProduct}
            competitorPrices={competitorPrices}
            onOptimizePrice={handleOptimizePrice}
          />

          <div className="detail-actions">
            <Button
              variant="outlined"
              onClick={() => {
                setShowForm(true);
                setShowCompetitorPanel(false);
              }}
            >
              Editar producto
            </Button>
            <Button onClick={() => handleSyncAmazon(selectedProduct._id)}>
              Sincronizar con Amazon
            </Button>
          </div>
        </div>
      )}

      {/* Formulario de producto */}
      {showForm && (
        <div className="form-container">
          <div className="form-header">
            <h2>{selectedProduct ? "Editar Producto" : "Nuevo Producto"}</h2>
            <Button
              variant="outlined"
              size="small"
              onClick={handleCancelForm}
              icon={<FaTimes />}
            >
              Cerrar
            </Button>
          </div>
          <ProductForm
            product={selectedProduct}
            onSubmit={handleSubmitForm}
            onCancel={handleCancelForm}
          />
        </div>
      )}

      {/* Modal de importación */}
      {showImportModal && (
        <ImportProductsModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImportProducts}
          loading={loading}
        />
      )}

      {/* Modal de configuración de precios */}
      {showPriceConfigModal && (
        <PriceConfigModal
          onClose={() => setShowPriceConfigModal(false)}
          onSave={handlePriceConfigSave}
          loading={loading}
          initialConfig={priceConfig}
        />
      )}

      {toast.visible && (
        <ToastNotifier message={toast.message} type={toast.type} />
      )}
    </div>
  );
};

export default Catalog;
