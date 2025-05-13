// frontend/src/components/orders/OrderFilters.jsx
import React, { useState, useEffect } from "react";
import "./OrderFilter.css";
import { orderService } from "../../services/api";

const OrderFilters = ({ onFilterChange }) => {
  const [activeFilter, setActiveFilter] = useState("pending");
  const [filterCounts, setFilterCounts] = useState({
    pending: 0,
    pendingUntilToday: 0,
    delayed: 0,
    outOfStock: 0,
    outOfStockUntilToday: 0,
    outOfStockDelayed: 0,
    shipFake: 0,
  });

  // Cargar contadores al iniciar
  useEffect(() => {
    fetchFilterCounts();
  }, []);

  // Obtener contadores de pedidos para cada filtro
  const fetchFilterCounts = async () => {
    try {
      // Implementar las llamadas para obtener el contador de cada categoría
      // Esto puede hacerse con llamadas paralelas o con un endpoint específico
      // que devuelva todos los contadores

      // Ejemplo simplificado:
      const pendingResponse = await orderService.getPendingOrders({
        countOnly: true,
      });
      const pendingTodayResponse =
        await orderService.getPendingOrdersUntilToday({ countOnly: true });
      // ... obtener los demás contadores

      setFilterCounts({
        pending: pendingResponse.total || 0,
        pendingUntilToday: pendingTodayResponse.total || 0,
        // ... actualizar los demás contadores
      });
    } catch (error) {
      console.error("Error al obtener contadores de filtros:", error);
    }
  };

  // Manejar el cambio de filtro
  const handleFilterClick = (filter) => {
    setActiveFilter(filter);
    onFilterChange(filter);
  };

  return (
    <div className="order-filters">
      <div className="filter-group">
        <button
          className={`filter-button ${
            activeFilter === "pending" ? "active" : ""
          }`}
          onClick={() => handleFilterClick("pending")}
        >
          Pendientes de envío
          <span className="filter-count">{filterCounts.pending}</span>
        </button>

        <button
          className={`filter-button ${
            activeFilter === "pendingUntilToday" ? "active" : ""
          }`}
          onClick={() => handleFilterClick("pendingUntilToday")}
        >
          Vencen hoy
          <span className="filter-count">{filterCounts.pendingUntilToday}</span>
        </button>

        <button
          className={`filter-button ${
            activeFilter === "delayed" ? "active" : ""
          }`}
          onClick={() => handleFilterClick("delayed")}
        >
          Vencidos
          <span className="filter-count">{filterCounts.delayed}</span>
        </button>
      </div>

      <div className="filter-divider"></div>

      <div className="filter-group">
        <button
          className={`filter-button ${
            activeFilter === "outOfStock" ? "active" : ""
          }`}
          onClick={() => handleFilterClick("outOfStock")}
        >
          Pendientes de envío - Sin stock
          <span className="filter-count">{filterCounts.outOfStock}</span>
        </button>

        {/* Botones para los demás filtros */}
      </div>
    </div>
  );
};

export default OrderFilters;
