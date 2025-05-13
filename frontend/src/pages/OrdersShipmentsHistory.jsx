import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ShipmentsTable from "../components/orders/ShipmentsTable";
import ToastNotifier from "../components/common/ToastNotifier";
import ImageWithOutOrders from "../components/common/ImageWithOutOrders";
import { orderService } from "../services/api";
import "./OrdersShipmentsHistory.css";

const OrdersShipmentsHistory = () => {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ visible: false, message: "", type: "" });

  // Obtener historial de envíos al cargar la página
  useEffect(() => {
    const fetchShipments = async () => {
      try {
        setLoading(true);
        const response = await orderService.getShipmentsHistory();

        if (response && response.success) {
          setShipments(response.shipments || []);
        } else {
          showToast("No se pudo cargar la lista de Envíos", "error");
        }
      } catch (error) {
        console.error("Error al obtener la lista de envíos:", error);
        showToast("Error al cargar la lista de envíos", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchShipments();
  }, []);

  // Mostrar notificación toast
  const showToast = (message, type) => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast({ visible: false, message: "", type: "" });
    }, 3000);
  };

  // Función para procesar la descarga de un envío
  const handleShipmentExport = async (fileName) => {
    try {
      setLoading(true);

      // Obtener shipments por nombre de archivo
      const historyResponse = await orderService.getShipmentsByFileName(
        fileName
      );

      if (historyResponse && historyResponse.success) {
        // Descargar Excel
        await orderService.downloadShipmentExcel(
          historyResponse.shipments,
          fileName
        );
        showToast("Descargando Excel...", "success");
      } else {
        showToast("Error al obtener datos del envío", "error");
      }
    } catch (error) {
      console.error("Error al descargar envío:", error);
      showToast("Error de conexión", "error");
    } finally {
      setLoading(false);
    }
  };

  // Volver a la página de órdenes
  const handleBackToOrders = () => {
    navigate("/orders");
  };

  return (
    <div className="shipments-history-container">
      <div className="content-wrapper">
        <h1>Historial de ficheros de envíos</h1>

        <div className="actions-top">
          <button
            className="back-button"
            onClick={handleBackToOrders}
            disabled={loading}
          >
            Volver
          </button>
        </div>

        {loading ? (
          <div className="loading">Cargando lista de ficheros...</div>
        ) : shipments.length === 0 ? (
          <ImageWithOutOrders message="No hay historial de envíos" />
        ) : (
          <ShipmentsTable
            data={shipments}
            onExportClick={handleShipmentExport}
          />
        )}
      </div>

      {toast.visible && (
        <ToastNotifier message={toast.message} type={toast.type} />
      )}
    </div>
  );
};

export default OrdersShipmentsHistory;
