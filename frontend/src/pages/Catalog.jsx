// frontend/src/pages/Catalog.jsx (actualización)
import React, { useState, useEffect } from "react";
import { catalogService } from "../services/api";
import Button from "../components/common/Button";
import ToastNotifier from "../components/common/ToastNotifier";
import ProductsTable from "../components/catalog/ProductsTable";
import ProductFilters from "../components/catalog/ProductFilters";
import ProductForm from "../components/catalog/ProductForm";
import CompetitorPanel from "../components/catalog/CompetitorPanel";
import { FaPlus, FaTimes } from "react-icons/fa";
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

  // Cargar productos
  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

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

  return (
    // frontend/src/pages/Catalog.jsx (continuación)
    <div className="catalog-container">
      <div className="catalog-header">
        <h1 className="page-title">Catálogo de Productos</h1>
        <Button
          variant="fab"
          onClick={handleNewProduct}
          icon={<FaPlus />}
        ></Button>
      </div>

      {!showForm && !showCompetitorPanel && (
        <>
          <ProductFilters onFilter={handleFilter} categories={categories} />

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

      {toast.visible && (
        <ToastNotifier message={toast.message} type={toast.type} />
      )}
    </div>
  );
};

export default Catalog;
