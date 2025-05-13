import React, { useState, useEffect } from "react";
import {
  FaBoxOpen,
  FaExclamationTriangle,
  FaSync,
  FaTruck,
} from "react-icons/fa";
import Button from "../components/common/Button";
import { orderService, integrationService } from "../services/api";
import "./Dashboard.css";

const Dashboard = () => {
  const [orderStats, setOrderStats] = useState({
    pending: 0,
    outOfStock: 0,
    readyToShip: 0,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Cargar estadísticas al montar el componente
  useEffect(() => {
    fetchStats();
  }, []);

  // Obtener estadísticas de pedidos
  const fetchStats = async () => {
    setLoading(true);
    try {
      // Obtener estadísticas de pedidos pendientes
      const pendingResponse = await orderService.getPendingOrders();
      const pendingCount = pendingResponse.pagination?.total || 0;

      // Obtener estadísticas de pedidos sin stock
      const outOfStockResponse = await orderService.getOutOfStockOrders();
      const outOfStockCount = outOfStockResponse.pagination?.total || 0;

      // Obtener estadísticas de pedidos listos para enviar
      const readyToShipResponse = await orderService.getOrdersReadyToShip();
      const readyToShipCount = readyToShipResponse.length || 0;

      // Actualizar estado
      setOrderStats({
        pending: pendingCount,
        outOfStock: outOfStockCount,
        readyToShip: readyToShipCount,
      });
    } catch (error) {
      console.error("Error al obtener estadísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar pedidos de Amazon
  const handleSyncAmazon = async () => {
    setSyncing(true);
    try {
      await integrationService.syncAmazonOrders(3); // Últimos 3 días
      // Recargar estadísticas
      await fetchStats();
    } catch (error) {
      console.error("Error al sincronizar pedidos de Amazon:", error);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <Button onClick={handleSyncAmazon} disabled={syncing} icon={<FaSync />}>
          {syncing ? "Sincronizando..." : "Sincronizar Pedidos"}
        </Button>
      </div>

      <div className="stats-grid">
        {/* Tarjeta de Pedidos Pendientes */}
        <div className="stat-card">
          <div className="stat-icon pending">
            <FaBoxOpen />
          </div>
          <div className="stat-content">
            <h3>Pedidos Pendientes</h3>
            {loading ? (
              <div className="stat-loading">Cargando...</div>
            ) : (
              <div className="stat-value">{orderStats.pending}</div>
            )}
          </div>
        </div>

        {/* Tarjeta de Pedidos Sin Stock */}
        <div className="stat-card">
          <div className="stat-icon warning">
            <FaExclamationTriangle />
          </div>
          <div className="stat-content">
            <h3>Sin Stock</h3>
            {loading ? (
              <div className="stat-loading">Cargando...</div>
            ) : (
              <div className="stat-value">{orderStats.outOfStock}</div>
            )}
          </div>
        </div>

        {/* Tarjeta de Pedidos Listos para Enviar */}
        <div className="stat-card">
          <div className="stat-icon success">
            <FaTruck />
          </div>
          <div className="stat-content">
            <h3>Listos para Enviar</h3>
            {loading ? (
              <div className="stat-loading">Cargando...</div>
            ) : (
              <div className="stat-value">{orderStats.readyToShip}</div>
            )}
          </div>
        </div>
      </div>

      {/* Aquí se pueden añadir más secciones como gráficos, actividad reciente, etc. */}
    </div>
  );
};

export default Dashboard;
