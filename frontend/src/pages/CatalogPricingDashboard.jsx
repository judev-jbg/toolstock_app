import React, { useState, useEffect } from "react";
import {
  MdDashboard,
  MdTrendingUp,
  MdInventory,
  MdTimeline,
  MdRefresh,
} from "react-icons/md";
import { pricingService } from "../services/api";
import Button from "../components/common/Button";
import ToastNotifier from "../components/common/ToastNotifier";
import { formatCurrency, formatDateTime } from "../utils/formatters";
import "./CatalogPricingDashboard.css";

const CatalogPricingDashboard = () => {
  const [stats, setStats] = useState(null);
  const [topActivity, setTopActivity] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [statsData, activityData, trendsData] = await Promise.all([
        pricingService.getPricingStats(),
        pricingService.getTopActivityProducts(10),
        pricingService.getPricingTrends("week"),
      ]);

      setStats(statsData);
      setTopActivity(activityData.topProducts);
      setTrends(trendsData.trends);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      showToast("Error cargando datos del dashboard", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const calculateTrendHeight = (value, maxValue) => {
    return maxValue > 0 ? Math.max((value / maxValue) * 100, 4) : 4;
  };

  if (loading) {
    return (
      <div className="pricing-dashboard">
        <div style={{ textAlign: "center", padding: "4rem" }}>
          <div className="loading-spinner"></div>
          <p>Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  const maxTrendValue = Math.max(...trends.map((t) => t.totalChanges), 1);

  return (
    <div className="pricing-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="dashboard-title">
          <MdDashboard
            style={{ color: "var(--primary-color)", fontSize: "2rem" }}
          />
          <h1>Dashboard de Pricing</h1>
        </div>
        <Button
          variant="outlined"
          icon={<MdRefresh />}
          onClick={loadDashboardData}
        >
          Actualizar
        </Button>
      </div>

      {/* Dashboard Grid */}
      <div className="dashboard-grid">
        {/* Estadísticas Generales */}
        <div className="dashboard-card">
          <div className="card-header">
            <div className="card-title">
              <MdInventory />
              Estadísticas Generales
            </div>
          </div>
          <div className="card-content">
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{stats?.totalProducts || 0}</div>
                <div className="stat-label">Total Productos</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{stats?.withPricing || 0}</div>
                <div className="stat-label">Con Pricing</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">
                  {stats?.autoUpdateEnabled || 0}
                </div>
                <div className="stat-label">Auto-Update</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{stats?.belowPvpmCount || 0}</div>
                <div className="stat-label">Bajo PVPM</div>
              </div>
            </div>
          </div>
        </div>

        {/* PVPM Stats */}
        <div className="dashboard-card">
          <div className="card-header">
            <div className="card-title">
              <MdTrendingUp />
              Estadísticas PVPM
            </div>
          </div>
          <div className="card-content">
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">
                  {formatCurrency(stats?.pvpmStats?.average || 0)}
                </div>
                <div className="stat-label">Promedio</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">
                  {formatCurrency(stats?.pvpmStats?.minimum || 0)}
                </div>
                <div className="stat-label">Mínimo</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">
                  {formatCurrency(stats?.pvpmStats?.maximum || 0)}
                </div>
                <div className="stat-label">Máximo</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">
                  {stats?.lastPriceUpdate
                    ? formatDateTime(stats.lastPriceUpdate)
                    : "N/A"}
                </div>
                <div className="stat-label">Última Actualización</div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Activity Products */}
        <div className="dashboard-card">
          <div className="card-header">
            <div className="card-title">
              <MdTimeline />
              Mayor Actividad
            </div>
          </div>
          <div className="card-content">
            <div className="activity-list">
              {topActivity.length > 0 ? (
                topActivity.map((product, index) => (
                  <div
                    key={`${product._id}-${index}`}
                    className="activity-item"
                  >
                    <div className="activity-product">
                      <div className="activity-sku">{product.sku}</div>
                      <div className="activity-name">
                        {product.name?.substring(0, 30)}
                        {product.name?.length > 30 ? "..." : ""}
                      </div>
                    </div>
                    <div className="activity-changes">
                      {product.changeCount} cambios
                    </div>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  No hay actividad reciente
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tendencias de la Semana */}
        <div className="dashboard-card">
          <div className="card-header">
            <div className="card-title">
              <MdTrendingUp />
              Tendencias (7 días)
            </div>
          </div>
          <div className="card-content">
            <div className="trends-chart">
              {trends.length > 0 ? (
                trends.map((trend, index) => (
                  <div
                    key={index}
                    className="trend-bar"
                    style={{
                      height: `${calculateTrendHeight(
                        trend.totalChanges,
                        maxTrendValue
                      )}%`,
                    }}
                  >
                    <div className="trend-value">{trend.totalChanges}</div>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    color: "rgba(255,255,255,0.6)",
                    width: "100%",
                  }}
                >
                  No hay datos de tendencias
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toast de notificaciones */}
      {toast && <ToastNotifier message={toast.message} type={toast.type} />}
    </div>
  );
};

export default CatalogPricingDashboard;
