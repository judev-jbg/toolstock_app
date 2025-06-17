import React, { useState, useEffect } from "react";
import {
  MdHistory,
  MdSearch,
  MdClear,
  MdTrendingUp,
  MdTrendingDown,
  MdArrowForward,
  MdAccessTime,
} from "react-icons/md";
import { pricingService } from "../services/api";
import DataTable from "../components/common/DataTable";
import Input from "../components/common/Input";
import Button from "../components/common/Button";
import ToastNotifier from "../components/common/ToastNotifier";
import { formatCurrency, formatDateTime } from "../utils/formatters";
import "./CatalogPriceHistory.css";

const CatalogPriceHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    reason: "all",
    productId: "",
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20,
  });
  const [stats, setStats] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadHistory();
  }, [pagination.currentPage, filters]);

  useEffect(() => {
    loadStats();
  }, [filters.dateFrom, filters.dateTo]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.currentPage,
        limit: pagination.itemsPerPage,
        ...filters,
      };

      // Filtrar parámetros vacíos
      Object.keys(params).forEach((key) => {
        if (params[key] === "" || params[key] === "all") {
          delete params[key];
        }
      });

      const response = await pricingService.getPriceHistory(params);
      setHistory(response.history);
      setPagination(response.pagination);
    } catch (error) {
      console.error("Error loading price history:", error);
      showToast("Error cargando historial de precios", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // Obtener estadísticas reales del historial
      const params = {};
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;

      const statsData = await pricingService.getPriceHistoryStats(params);
      setStats(statsData);
    } catch (error) {
      console.error("Error loading stats:", error);
      showToast("Error cargando estadísticas", "error");
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: "",
      dateTo: "",
      reason: "all",
      productId: "",
    });
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  const handlePageChange = (page) => {
    setPagination((prev) => ({ ...prev, currentPage: page }));
  };

  const getReasonLabel = (reason) => {
    const labels = {
      manual: "Manual",
      pvpm_change: "PVPM",
      pvpm_recalculation: "Recálculo PVPM",
      competitor_match: "Competencia",
      system: "Sistema",
      bulk_update: "Actualización masiva",
    };
    return labels[reason] || reason;
  };

  const getChangeDirection = (oldPrice, newPrice) => {
    if (newPrice > oldPrice) return "up";
    if (newPrice < oldPrice) return "down";
    return "same";
  };

  const calculateChangePercentage = (oldPrice, newPrice) => {
    if (oldPrice === 0) return 0;
    return ((newPrice - oldPrice) / oldPrice) * 100;
  };

  // Configuración de columnas para la tabla
  const columns = [
    {
      title: "Producto",
      field: "product",
      render: (item) => (
        <div className="product-info">
          <div className="product-sku">{item.erp_sku}</div>
          <div className="product-name">
            {item.erp_name || item.amz_title || "Sin nombre"}
          </div>
        </div>
      ),
    },
    {
      title: "Cambio de Precio",
      field: "priceChange",
      width: "200px",
      render: (item) => {
        const direction = getChangeDirection(
          item.change.previousPrice,
          item.change.newPrice
        );
        const percentage = calculateChangePercentage(
          item.change.previousPrice,
          item.change.newPrice
        );

        return (
          <div className="price-change">
            <div className="price-old">
              {formatCurrency(item.change.previousPrice)}
            </div>
            <MdArrowForward className={`price-arrow ${direction}`} />
            <div className="price-new">
              {formatCurrency(item.change.newPrice)}
            </div>
            {percentage !== 0 && (
              <div
                style={{
                  fontSize: "0.75rem",
                  color:
                    direction === "up"
                      ? "var(--success-color)"
                      : "var(--danger-color)",
                  fontWeight: "600",
                }}
              >
                {direction === "up" ? "+" : ""}
                {percentage.toFixed(1)}%
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Motivo",
      field: "reason",
      width: "150px",
      render: (item) => (
        <span className={`change-reason ${item.change.reason}`}>
          {getReasonLabel(item.change.reason)}
        </span>
      ),
    },
    {
      title: "Usuario",
      field: "changedBy",
      width: "120px",
      render: (item) => (
        <div className="change-author">
          {item.change.changedBy === "system"
            ? "Sistema"
            : item.change.changedBy}
        </div>
      ),
    },
    {
      title: "Fecha",
      field: "changedAt",
      width: "180px",
      render: (item) => (
        <div className="change-date">
          {formatDateTime(item.change.changedAt)}
        </div>
      ),
    },
  ];

  const reasonOptions = [
    { value: "all", label: "Todos los motivos" },
    { value: "manual", label: "Manual" },
    { value: "pvpm_change", label: "Cambio PVPM" },
    { value: "pvpm_recalculation", label: "Recálculo PVPM" },
    { value: "competitor_match", label: "Competencia" },
    { value: "system", label: "Sistema" },
    { value: "bulk_update", label: "Actualización masiva" },
  ];

  return (
    <div className="price-history-page">
      {/* Header */}
      <div className="price-history-header">
        <div className="price-history-title">
          <MdHistory />
          <h1>Historial de Cambios de Precio</h1>
        </div>
        <Button
          variant="outlined"
          icon={<MdClear />}
          onClick={clearFilters}
          disabled={Object.values(filters).every((v) => !v || v === "all")}
        >
          Limpiar Filtros
        </Button>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="history-stats">
          <div className="history-stat-card">
            <div className="stat-value">
              {stats.totalChanges.toLocaleString()}
            </div>
            <div className="stat-label">Total de Cambios</div>
          </div>
          <div className="history-stat-card">
            <div className="stat-value">{stats.thisMonth}</div>
            <div className="stat-label">Este Mes</div>
          </div>
          <div className="history-stat-card">
            <div className="stat-value">{stats.avgChangePercentage}%</div>
            <div className="stat-label">Cambio Promedio</div>
          </div>
          <div className="history-stat-card">
            <div className="stat-value">
              <MdAccessTime
                style={{ fontSize: "1.5rem", verticalAlign: "middle" }}
              />
            </div>
            <div className="stat-label">{formatDateTime(stats.lastUpdate)}</div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="history-filters">
        <div className="filter-group">
          <label className="filter-label">Fecha desde</label>
          <input
            type="date"
            className="filter-select"
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label className="filter-label">Fecha hasta</label>
          <input
            type="date"
            className="filter-select"
            value={filters.dateTo}
            onChange={(e) => handleFilterChange("dateTo", e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label className="filter-label">Motivo</label>
          <select
            className="filter-select"
            value={filters.reason}
            onChange={(e) => handleFilterChange("reason", e.target.value)}
          >
            {reasonOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">SKU Producto</label>
          <Input
            value={filters.productId}
            onChange={(e) =>
              handleFilterChange("productId", e.target.value.trim())
            }
            placeholder="Buscar por SKU..."
            icon={<MdSearch />}
          />
        </div>
      </div>

      {/* Tabla de historial */}
      <DataTable
        data={history}
        columns={columns}
        loading={loading}
        emptyMessage="No hay cambios de precio registrados"
        showPagination={true}
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.totalItems}
        pageSize={pagination.itemsPerPage}
        onPageChange={handlePageChange}
        className="history-table"
      />

      {/* Toast de notificaciones */}
      {toast && <ToastNotifier message={toast.message} type={toast.type} />}
    </div>
  );
};

export default CatalogPriceHistory;
