import React, { useState } from "react";
import {
  FaBox,
  FaExclamationTriangle,
  FaTruck,
  FaCheck,
  FaTimes,
} from "react-icons/fa";
import moment from "moment";
import "moment/locale/es";
import "./OrderCard.css";

// Configurar moment para que use el idioma español
moment.locale("es");

const OrderCard = ({ order, onToggleMarkForShipment, onToggleOutOfStock }) => {
  const [expanded, setExpanded] = useState(false);

  // Formatear fechas
  const formatDate = (dateString) => {
    if (!dateString) return "No disponible";
    return moment(dateString).format("DD MMM YYYY");
  };

  // Comprobar si la fecha de envío ha expirado
  const isShipDateExpired = () => {
    if (!order.latestShipDate) return false;
    return moment(order.latestShipDate).isBefore(moment().startOf("day"));
  };

  // Calcular el total del pedido
  const calculateTotal = () => {
    if (!order.items || order.items.length === 0) return 0;

    return order.items
      .reduce((total, item) => {
        const itemTotal = parseFloat(item.itemPrice || 0);
        const shippingTotal = parseFloat(item.shippingPrice || 0);
        return total + itemTotal + shippingTotal;
      }, 0)
      .toFixed(2);
  };

  // Manejar cambio de estado "Marcar para envío"
  const handleMarkForShipmentChange = () => {
    onToggleMarkForShipment(
      order._id || order.amazonOrderId,
      !order.markForShipment
    );
  };

  // Manejar cambio de estado "Sin stock"
  const handleOutOfStockChange = () => {
    onToggleOutOfStock(
      order._id || order.amazonOrderId,
      !order.pendingWithoutStock
    );
  };

  return (
    <div className={`order-card ${expanded ? "expanded" : ""}`}>
      <div className="order-header" onClick={() => setExpanded(!expanded)}>
        <div className="order-id">
          <FaBox className="order-icon" />
          <span>{order.amazonOrderId || order.prestashopOrderId}</span>
        </div>

        <div className="order-status">
          <span
            className={`status-badge ${isShipDateExpired() ? "expired" : ""}`}
          >
            {order.orderStatus}
          </span>
          {isShipDateExpired() && (
            <FaExclamationTriangle
              className="warning-icon"
              title="Fecha de envío vencida"
            />
          )}
        </div>

        <div className="order-date">
          <span className="label">Fecha de compra:</span>
          <span>{formatDate(order.purchaseDate)}</span>
        </div>

        <div className="order-actions">
          <button
            className={`action-button ${
              order.pendingWithoutStock ? "active" : ""
            }`}
            onClick={(e) => {
              e.stopPropagation();
              handleOutOfStockChange();
            }}
            title={
              order.pendingWithoutStock
                ? "Marcar con stock"
                : "Marcar sin stock"
            }
          >
            {order.pendingWithoutStock ? (
              <FaCheck />
            ) : (
              <FaExclamationTriangle />
            )}
            <span>Sin stock</span>
          </button>

          <button
            className={`action-button ${order.markForShipment ? "active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              handleMarkForShipmentChange();
            }}
            title={
              order.markForShipment
                ? "Desmarcar para envío"
                : "Marcar para envío"
            }
          >
            {order.markForShipment ? <FaCheck /> : <FaTruck />}
            <span>Marcar para envío</span>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="order-details">
          <div className="order-section">
            <h3>Datos del pedido</h3>
            <div className="details-grid">
              <div className="detail-item">
                <span className="label">Canal de venta:</span>
                <span>{order.salesChannel || "Amazon"}</span>
              </div>
              <div className="detail-item">
                <span className="label">Comprador:</span>
                <span>{order.buyerName}</span>
              </div>
              <div className="detail-item">
                <span className="label">Email:</span>
                <span>{order.buyerEmail}</span>
              </div>
              <div className="detail-item">
                <span className="label">Teléfono:</span>
                <span>{order.buyerPhoneNumber || "No disponible"}</span>
              </div>
              <div className="detail-item">
                <span className="label">Fecha límite envío:</span>
                <span className={isShipDateExpired() ? "expired-text" : ""}>
                  {formatDate(order.latestShipDate)}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Fecha límite entrega:</span>
                <span>{formatDate(order.latestDeliveryDate)}</span>
              </div>
            </div>
          </div>

          <div className="order-section">
            <h3>Dirección de envío</h3>
            <div className="details-grid">
              <div className="detail-item">
                <span className="label">Destinatario:</span>
                <span>{order.recipientName}</span>
              </div>
              <div className="detail-item full-width">
                <span className="label">Dirección:</span>
                <span>
                  {[order.shipAddress1, order.shipAddress2, order.shipAddress3]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Ciudad:</span>
                <span>{order.shipCity}</span>
              </div>
              <div className="detail-item">
                <span className="label">Provincia:</span>
                <span>{order.shipState}</span>
              </div>
              <div className="detail-item">
                <span className="label">Código Postal:</span>
                <span>{order.shipPostalCode}</span>
              </div>
              <div className="detail-item">
                <span className="label">País:</span>
                <span>{order.shipCountry}</span>
              </div>
              <div className="detail-item">
                <span className="label">Teléfono:</span>
                <span>
                  {order.shipPhoneNumber ||
                    order.buyerPhoneNumber ||
                    "No disponible"}
                </span>
              </div>
              {order.deliveryInstructions && (
                <div className="detail-item full-width">
                  <span className="label">Instrucciones de entrega:</span>
                  <span>{order.deliveryInstructions}</span>
                </div>
              )}
            </div>
          </div>

          <div className="order-section">
            <h3>Productos</h3>
            <div className="products-table">
              <div className="products-header">
                <div className="product-cell">Producto</div>
                <div className="product-cell">Cantidad</div>
                <div className="product-cell">Precio</div>
              </div>
              {order.items &&
                order.items.map((item, index) => (
                  <div className="product-row" key={index}>
                    <div className="product-cell">
                      <div className="product-name">{item.productName}</div>
                      <div className="product-sku">SKU: {item.sku}</div>
                    </div>
                    <div className="product-cell">{item.quantityPurchased}</div>
                    <div className="product-cell">
                      {parseFloat(item.itemPrice).toFixed(2)} €
                    </div>
                  </div>
                ))}
              <div className="product-row total-row">
                <div className="product-cell"></div>
                <div className="product-cell">Total:</div>
                <div className="product-cell">{calculateTotal()} €</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderCard;
