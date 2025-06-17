import React, { useState, useEffect } from "react";
import {
  MdWarning,
  MdScale,
  MdCalculate,
  MdTrendingDown,
  MdSync,
  MdCheckCircle,
  MdRefresh,
  MdBuild,
} from "react-icons/md";
import { pricingService, productService } from "../services/api";
import Button from "../components/common/Button";
import DataTable from "../components/common/DataTable";
import ToastNotifier from "../components/common/ToastNotifier";
import "./CatalogPendingActions.css";

const CatalogPendingActions = () => {
  const [pendingActions, setPendingActions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processingActions, setProcessingActions] = useState({});
  const [toast, setToast] = useState(null);
  const [detailedView, setDetailedView] = useState(null);
  const [detailedProducts, setDetailedProducts] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadPendingActions();
  }, []);

  const loadPendingActions = async () => {
    try {
      setLoading(true);
      const data = await pricingService.getPendingActions();
      setPendingActions(data.pendingActions);
    } catch (error) {
      console.error("Error loading pending actions:", error);
      showToast("Error cargando acciones pendientes", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleActionClick = async (actionType) => {
    setProcessingActions((prev) => ({ ...prev, [actionType]: true }));

    try {
      switch (actionType) {
        case "recalculate_pvpm":
          await handleRecalculatePVPM();
          break;
        case "update_prices":
          await handleUpdatePrices();
          break;
        case "sync_products":
          await handleSyncProducts();
          break;
        default:
          showToast(`Acción ${actionType} no implementada`, "info");
      }
    } catch (error) {
      showToast(`Error ejecutando acción: ${error.message}`, "error");
    } finally {
      setProcessingActions((prev) => ({ ...prev, [actionType]: false }));
    }
  };

  const handleRecalculatePVPM = async () => {
    try {
      const result = await pricingService.recalculateBulkPVPM({
        filters: { withoutWeight: false },
        updatePrices: false,
      });

      showToast(
        `PVPM recalculado para ${result.results.successful} productos`,
        "success"
      );

      loadPendingActions();
    } catch (error) {
      console.error("Error recalculando PVPM:", error);
      throw new Error("Error recalculando PVPM");
    }
  };

  const handleUpdatePrices = async () => {
    try {
      const result = await pricingService.recalculateBulkPVPM({
        filters: { belowPVPM: true },
        updatePrices: true,
      });

      showToast(
        `Precios actualizados para ${result.results.priceUpdatesQueued} productos`,
        "success"
      );

      loadPendingActions();
    } catch (error) {
      console.error("Error actualizando precios:", error);
      throw new Error("Error actualizando precios");
    }
  };

  const handleSyncProducts = async () => {
    try {
      await productService.syncProducts();
      showToast("Sincronización de productos iniciada", "success");

      // Recargar después de un delay para dar tiempo a la sincronización
      setTimeout(() => {
        loadPendingActions();
      }, 5000);
    } catch (error) {
      console.error("Error sincronizando productos:", error);
      throw new Error("Error sincronizando productos");
    }
  };

  const loadDetailedProducts = async (actionType) => {
    try {
      setLoadingDetails(true);

      const products = await getProductsForAction(actionType);
      setDetailedProducts(products);
      setDetailedView(actionType);
    } catch (error) {
      console.error("Error loading detailed products:", error);
      showToast("Error cargando detalles", "error");
    } finally {
      setLoadingDetails(false);
    }
  };

  const getProductsForAction = async (actionType) => {
    try {
      const response = await pricingService.getPendingActionProducts(
        actionType,
        {
          page: 1,
          limit: 50,
        }
      );
      return response.products;
    } catch (error) {
      console.error("Error loading products for action:", error);
      return [];
    }
  };
  const getActionIcon = (action) => {
    const icons = {
      update_weight: MdScale,
      recalculate_pvpm: MdCalculate,
      update_price: MdTrendingDown,
      fix_sync: MdSync,
    };
    return icons[action] || MdWarning;
  };

  if (loading) {
    return (
      <div className="pending-actions-page">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <span>Cargando acciones pendientes...</span>
        </div>
      </div>
    );
  }

  const totalActions = Object.values(pendingActions).reduce(
    (sum, action) => sum + action.count,
    0
  );

  if (totalActions === 0) {
    return (
      <div className="pending-actions-page">
        <div className="pending-actions-header">
          <div className="pending-actions-title">
            <MdCheckCircle style={{ color: "var(--success-color)" }} />
            <h1>Acciones Pendientes</h1>
          </div>
        </div>

        <div className="empty-state">
          <MdCheckCircle />
          <h2>¡Todo al día!</h2>
          <p>No hay acciones pendientes en el catálogo</p>
          <Button
            variant="outlined"
            icon={<MdRefresh />}
            onClick={loadPendingActions}
          >
            Actualizar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pending-actions-page">
      {/* Header */}
      <div className="pending-actions-header">
        <div className="pending-actions-title">
          <MdWarning />
          <h1>Acciones Pendientes</h1>
        </div>
        <Button
          variant="outlined"
          icon={<MdRefresh />}
          onClick={loadPendingActions}
          disabled={Object.values(processingActions).some(Boolean)}
        >
          Actualizar
        </Button>
      </div>

      {/* Resumen de acciones */}
      <div className="actions-summary">
        {Object.entries(pendingActions).map(([key, action]) => {
          const IconComponent = getActionIcon(action.action);
          const isProcessing = processingActions[action.action];

          return (
            <div
              key={key}
              className={`action-summary-card priority-${action.priority}`}
            >
              <div className="action-header">
                <IconComponent className="action-icon" />
                <div className="action-count">{action.count}</div>
              </div>

              <div className="action-title">{action.description}</div>

              <div className={`action-priority ${action.priority}`}>
                <MdWarning size={12} />
                {action.priority.toUpperCase()}
              </div>

              {action.count > 0 && (
                <>
                  <Button
                    className="action-button"
                    variant="filled"
                    size="small"
                    onClick={() => handleActionClick(action.action)}
                    disabled={isProcessing}
                    icon={isProcessing ? null : <MdBuild />}
                  >
                    {isProcessing ? "Procesando..." : "Resolver"}
                  </Button>

                  <Button
                    className="action-button"
                    variant="outlined"
                    size="small"
                    onClick={() => loadDetailedProducts(action.action)}
                    disabled={loadingDetails}
                    style={{ marginTop: "0.5rem" }}
                  >
                    Ver Detalles
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Acciones masivas */}
      {totalActions > 5 && (
        <div className="bulk-actions">
          <div className="bulk-actions-info">
            <MdWarning size={24} />
            <span className="bulk-actions-text">
              {totalActions} acciones pendientes detectadas
            </span>
          </div>
          <div className="bulk-actions-buttons">
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleActionClick("recalculate_pvpm")}
              disabled={processingActions.recalculate_pvpm}
              style={{
                backgroundColor: "white",
                color: "var(--background-dark)",
              }}
            >
              Recalcular PVPM
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleActionClick("update_prices")}
              disabled={processingActions.update_prices}
              style={{
                backgroundColor: "white",
                color: "var(--background-dark)",
              }}
            >
              Actualizar Precios
            </Button>
          </div>
        </div>
      )}

      {/* Vista detallada */}
      {detailedView && (
        <div className="action-details">
          <div className="action-section">
            <div className="action-section-header">
              <div className="action-section-title">
                <MdWarning />
                Productos Afectados -{" "}
                {pendingActions[detailedView]?.description}
              </div>
              <div className="action-section-count">
                {detailedProducts.length}
              </div>
            </div>
            <div className="action-section-content">
              {loadingDetails ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <span>Cargando productos...</span>
                </div>
              ) : detailedProducts.length > 0 ? (
                <DataTable
                  data={detailedProducts}
                  columns={[
                    {
                      title: "SKU",
                      field: "erp_sku",
                      width: "150px",
                    },
                    {
                      title: "Producto",
                      field: "erp_name",
                      render: (product) => (
                        <div>
                          <div>{product.erp_name}</div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "rgba(255,255,255,0.6)",
                            }}
                          >
                            {product.erp_manufacturer}
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: "Problema",
                      field: "issue",
                      width: "200px",
                    },
                    {
                      title: "Acciones",
                      width: "120px",
                      render: (product) => (
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => console.log("Fix product:", product)}
                        >
                          Resolver
                        </Button>
                      ),
                    },
                  ]}
                  emptyMessage="No hay productos para mostrar"
                />
              ) : (
                <div className="empty-state">
                  <MdCheckCircle />
                  <p>No hay productos con este problema</p>
                </div>
              )}

              <div style={{ marginTop: "1rem", textAlign: "right" }}>
                <Button
                  variant="outlined"
                  onClick={() => setDetailedView(null)}
                >
                  Cerrar Detalles
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast de notificaciones */}
      {toast && <ToastNotifier message={toast.message} type={toast.type} />}
    </div>
  );
};

export default CatalogPendingActions;
