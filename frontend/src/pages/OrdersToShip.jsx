import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import OrdersTable from "../components/orders/OrdersTable";
import ToastNotifier from "../components/common/ToastNotifier";
import ImageWithOutOrders from "../components/common/ImageWithOutOrders";
import { orderService } from "../services/api";
import "./OrdersToShip.css";

const OrdersToShip = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ visible: false, message: "", type: "" });

  // Obtener órdenes listas para enviar al cargar la página
  useEffect(() => {
    const fetchOrdersToShip = async () => {
      try {
        setLoading(true);
        const response = await orderService.getOrdersReadyToShip();

        if (response) {
          setOrders(response || []);
        } else {
          showToast("No se pudieron cargar las órdenes", "error");
        }
      } catch (error) {
        console.error("Error al obtener órdenes para enviar:", error);
        showToast("Error al cargar órdenes", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchOrdersToShip();
  }, []);

  // Mostrar notificación toast
  const showToast = (message, type) => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast({ visible: false, message: "", type: "" });
    }, 3000);
  };

  // Función para actualizar el valor de una celda
  const handleCellUpdate = async (rowId, columnName, columnValue) => {
    try {
      const response = await orderService.updateOrderToShipment({
        columnName,
        columnValue,
        idOrder: rowId,
      });

      if (response && response.success) {
        // Actualizar estado local con el nuevo valor
        setOrders(
          orders.map((order) => {
            if (order.idOrder === rowId) {
              return { ...order, [columnName.toLowerCase()]: columnValue };
            }
            return order;
          })
        );
        showToast("Dato actualizado correctamente", "success");
        return true;
      } else {
        showToast("No se pudo actualizar el dato", "error");
        return false;
      }
    } catch (error) {
      console.error("Error al actualizar celda:", error);
      showToast("Error de conexión", "error");
      return false;
    }
  };

  // Función para procesar el envío de órdenes
  const handleShipmentProcess = async () => {
    try {
      setLoading(true);
      // Proceso de envío
      const response = await orderService.processShipments({
        shipmentType: "isFile",
      });

      if (response && response.fileName) {
        // Obtener historial de envío
        const historyResponse = await orderService.getShipmentsByFileName(
          response.fileName
        );

        if (historyResponse && historyResponse.shipments) {
          // Descargar Excel
          await orderService.downloadShipmentExcel(
            historyResponse.shipments,
            response.fileName
          );
          showToast("Proceso completado. Descargando Excel...", "success");

          // Redirigir después de un breve retraso
          setTimeout(() => {
            navigate("/orders");
          }, 2000);
        } else {
          showToast("Error al obtener historial de órdenes", "error");
        }
      } else {
        showToast("Error al procesar envíos", "error");
      }
    } catch (error) {
      console.error("Error en el proceso de envío:", error);
      showToast("Error de conexión", "error");
    } finally {
      setLoading(false);
    }
  };

  // Función para volver a la página principal
  const handleBackToOrders = () => {
    navigate("/orders");
  };

  return (
    <div className="orders-to-ship-container">
      <div className="content-wrapper">
        <h1>Pedidos listos para Enviar</h1>

        <div className="actions-top">
          <button
            className="back-button"
            onClick={handleBackToOrders}
            disabled={loading}
          >
            Volver
          </button>
          <button
            className="process-button"
            onClick={handleShipmentProcess}
            disabled={loading || orders.length === 0}
          >
            Procesar Envíos
          </button>
        </div>

        {loading ? (
          <div className="loading">Cargando órdenes...</div>
        ) : orders.length === 0 ? (
          <ImageWithOutOrders />
        ) : (
          <OrdersTable data={orders} onCellUpdate={handleCellUpdate} />
        )}

        <button
          className="fab-button"
          onClick={handleShipmentProcess}
          disabled={loading || orders.length === 0}
        >
          <span>✓</span>
        </button>
      </div>

      {toast.visible && (
        <ToastNotifier message={toast.message} type={toast.type} />
      )}
    </div>
  );
};

export default OrdersToShip;
