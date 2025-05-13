import React, { useState, useEffect } from "react";
import { FaSync, FaTruck } from "react-icons/fa";
import Button from "../components/common/Button";
import OrdersFilter from "../components/orders/OrdersFilter";
import OrderCard from "../components/orders/OrderCard";
import { orderService } from "../services/api";
import "./Orders.css";

const Orders = () => {
  // Estado para los filtros
  const [filters, setFilters] = useState([
    {
      id: "pending",
      resource: "/api/orders/pending",
      label: "Pendientes de envío",
      count: 0,
      newBlock: false,
      active: true,
    },
    {
      id: "pending-today",
      resource: "/api/orders/pending/until-today",
      label: "Vencen hoy",
      count: 0,
      newBlock: false,
      active: false,
    },
    {
      id: "pending-delayed",
      resource: "/api/orders/pending/delayed",
      label: "Vencidos",
      count: 0,
      newBlock: false,
      active: false,
    },
    {
      id: "outofstock",
      resource: "/api/orders/outofstock",
      label: "Sin stock",
      count: 0,
      newBlock: true,
      active: false,
    },
    {
      id: "outofstock-today",
      resource: "/api/orders/outofstock/until-today",
      label: "Vencen hoy (sin stock)",
      count: 0,
      newBlock: false,
      active: false,
    },
    {
      id: "outofstock-delayed",
      resource: "/api/orders/outofstock/delayed",
      label: "Vencidos (sin stock)",
      count: 0,
      newBlock: false,
      active: false,
    },
    {
      id: "shipfake",
      resource: "/api/orders/shipfake",
      label: "Envíos fake",
      count: 0,
      newBlock: true,
      active: false,
    },
  ]);

  // Estado para órdenes
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilterId, setActiveFilterId] = useState("pending");

  // Cargar órdenes al montar y cuando cambia el filtro activo
  useEffect(() => {
    fetchOrders();
  }, [activeFilterId]);

  // Cargar contadores para todos los filtros
  useEffect(() => {
    fetchAllCounts();
  }, []);

  // Obtener órdenes según el filtro activo
  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      // Encontrar el recurso correspondiente al filtro activo
      const activeFilter = filters.find(
        (filter) => filter.id === activeFilterId
      );
      if (!activeFilter) return;

      const response = await fetch(activeFilter.resource);
      const data = await response.json();

      setOrders(data.orders || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
      setError("Error al cargar los pedidos. Por favor, inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // Obtener contadores para todos los filtros
  const fetchAllCounts = async () => {
    try {
      // Crear un array de promesas para todas las solicitudes
      const promises = filters.map((filter) =>
        fetch(filter.resource)
          .then((response) => response.json())
          .then((data) => ({
            id: filter.id,
            count: data.pagination?.total || 0,
          }))
          .catch((error) => {
            console.error(`Error fetching count for ${filter.id}:`, error);
            return { id: filter.id, count: 0 };
          })
      );

      // Esperar a que se completen todas las solicitudes
      const results = await Promise.all(promises);

      // Actualizar los contadores en el estado de filtros
      setFilters((prevFilters) =>
        prevFilters.map((filter) => {
          const result = results.find((r) => r.id === filter.id);
          return {
            ...filter,
            count: result?.count || 0,
          };
        })
      );
    } catch (error) {
      console.error("Error fetching filter counts:", error);
    }
  };

  // Manejar cambio de filtro
  const handleFilterChange = (filterId) => {
    setActiveFilterId(filterId);

    // Actualizar filtros activos
    setFilters((prevFilters) =>
      prevFilters.map((filter) => ({
        ...filter,
        active: filter.id === filterId,
      }))
    );
  };

  // Sincronizar pedidos de Amazon
  const handleSyncOrders = async () => {
    try {
      setSyncing(true);
      await orderService.syncAmazonOrders(3); // Últimos 3 días

      // Recargar datos
      await fetchOrders();
      await fetchAllCounts();

      setSyncing(false);
    } catch (error) {
      console.error("Error synchronizing orders:", error);
      setError("Error al sincronizar pedidos");
      setSyncing(false);
    }
  };

  // Manejar cambio de estado "Marcar para envío"
  const handleToggleMarkForShipment = async (orderId, newState) => {
    try {
      await orderService.markOrderForShipment(orderId, newState);

      // Actualizar estado local
      setOrders((prevOrders) =>
        prevOrders.map((order) => {
          if ((order._id || order.amazonOrderId) === orderId) {
            return {
              ...order,
              markForShipment: newState,
            };
          }
          return order;
        })
      );

      // Recargar contadores
      await fetchAllCounts();
    } catch (error) {
      console.error("Error updating order mark for shipment:", error);
      setError("Error al actualizar el estado de envío");
    }
  };

  // Manejar cambio de estado "Sin stock"
  const handleToggleOutOfStock = async (orderId, newState) => {
    try {
      await orderService.updateOrderStockStatus(orderId, newState);

      // Actualizar estado local
      setOrders((prevOrders) =>
        prevOrders.map((order) => {
          if ((order._id || order.amazonOrderId) === orderId) {
            return {
              ...order,
              pendingWithoutStock: newState,
            };
          }
          return order;
        })
      );

      // Recargar contadores
      await fetchAllCounts();
    } catch (error) {
      console.error("Error updating order stock status:", error);
      setError("Error al actualizar el estado de stock");
    }
  };

  // Navegar a la página de preparación de envíos
  const handlePrepareShipments = () => {
    // Implementar navegación a página de envíos
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
            disabled={syncing}
          >
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </Button>

          <Button icon={<FaTruck />} onClick={handlePrepareShipments}>
            Preparar Envíos
          </Button>
        </div>
      </div>

      <OrdersFilter
        filters={filters}
        activeFilter={activeFilterId}
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
            <OrderCard
              key={order._id || order.amazonOrderId}
              order={order}
              onToggleMarkForShipment={handleToggleMarkForShipment}
              onToggleOutOfStock={handleToggleOutOfStock}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Orders;
