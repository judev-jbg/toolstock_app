// frontend/src/pages/Orders.jsx (actualización)
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { FaSync, FaTruck, FaCheck } from "react-icons/fa";
import Button from "../components/common/Button";
import OrderFilters from "../components/orders/OrderFilters";
import OrderDetail from "../components/orders/OrderDetail";
import { orderService } from "../services/api";
import "./Orders.css";

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("pending");
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [error, setError] = useState(null);
  let navigate = useNavigate();

  // Cargar órdenes al montar y cuando cambia el filtro
  useEffect(() => {
    fetchOrders();
  }, [activeFilter]);

  // Obtener órdenes según el filtro activo
  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      let response;
      switch (activeFilter) {
        case "pending":
          response = await orderService.getPendingOrders();
          break;
        case "pendingUntilToday":
          response = await orderService.getPendingOrdersUntilToday();
          break;
        case "delayed":
          response = await orderService.getDelayedOrders();
          break;
        case "outOfStock":
          response = await orderService.getOutOfStockOrders();
          break;
        case "outOfStockUntilToday":
          response = await orderService.getOutOfStockOrdersUntilToday();
          break;
        case "outOfStockDelayed":
          response = await orderService.getOutOfStockDelayedOrders();
          break;
        case "shipFake":
          response = await orderService.getShipFakeOrders();
          break;
        default:
          response = await orderService.getPendingOrders();
      }

      setOrders(response.orders || []);
    } catch (error) {
      console.error("Error al obtener órdenes:", error);
      setError("Error al cargar los pedidos. Por favor, inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // Manejar cambio de filtro
  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setSelectedOrders([]);
  };

  // Manejar marcado de pedido para envío
  const handleMarkForShipment = async (orderId, isMarked) => {
    try {
      await orderService.markOrderForShipment(orderId, isMarked);

      // Actualizar estado local
      setOrders(
        orders.map((order) => {
          if (order._id === orderId || order.amazonOrderId === orderId) {
            return { ...order, markForShipment: isMarked };
          }
          return order;
        })
      );

      // Actualizar seleccionados
      if (isMarked) {
        setSelectedOrders([...selectedOrders, orderId]);
      } else {
        setSelectedOrders(selectedOrders.filter((id) => id !== orderId));
      }
    } catch (error) {
      console.error("Error al marcar pedido para envío:", error);
    }
  };

  // Manejar cambio de estado sin stock
  const handleToggleOutOfStock = async (orderId, isOutOfStock) => {
    try {
      await orderService.updateOrderStockStatus(orderId, isOutOfStock);

      // Actualizar estado local
      setOrders(
        orders.map((order) => {
          if (order._id === orderId || order.amazonOrderId === orderId) {
            return { ...order, pendingWithoutStock: isOutOfStock };
          }
          return order;
        })
      );
    } catch (error) {
      console.error("Error al actualizar estado de stock:", error);
    }
  };

  // Preparar envíos de pedidos seleccionados
  const handlePrepareShipment = () => {
    if (selectedOrders.length > 0) {
      navigate("/orders-to-ship");
    }
  };

  // Sincronizar pedidos
  const handleSyncOrders = async () => {
    try {
      setLoading(true);
      await orderService.syncAmazonOrders(3); // Últimos 3 días
      await fetchOrders(); // Recargar pedidos
    } catch (error) {
      console.error("Error al sincronizar pedidos:", error);
      setError("Error al sincronizar pedidos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="orders-page">
      <div className="orders-header">
        <h1>Pedidos</h1>
        <div className="header-actions">
          <Button
            variant="outline"
            icon={<FaSync />}
            onClick={handleSyncOrders}
            disabled={loading}
          >
            {loading ? "Sincronizando..." : "Sincronizar"}
          </Button>

          <Button
            icon={<FaTruck />}
            onClick={handlePrepareShipment}
            disabled={loading || selectedOrders.length === 0}
          >
            Preparar Envíos
            {selectedOrders.length > 0 && (
              <span className="selection-count">({selectedOrders.length})</span>
            )}
          </Button>
        </div>
      </div>

      <OrderFilters
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
      />

      {error && <div className="error-message">{error}</div>}

      <div className="orders-container">
        {loading ? (
          <div className="loading-indicator">Cargando pedidos...</div>
        ) : orders.length === 0 ? (
          <div className="no-orders">
            No hay pedidos que coincidan con el filtro seleccionado
          </div>
        ) : (
          orders.map((order) => (
            <OrderDetail
              key={order._id || order.amazonOrderId}
              order={order}
              onMarkForShipment={handleMarkForShipment}
              onToggleOutOfStock={handleToggleOutOfStock}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Orders;
