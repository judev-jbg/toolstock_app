// frontend/src/components/orders/OrderDetail.jsx
import React, { useState } from "react";
import "./OrderDetail.css";

const OrderDetail = ({
  order,
  onStatusChange,
  onMarkForShipment,
  onToggleOutOfStock,
}) => {
  const [expanded, setExpanded] = useState(false);

  // Calcular el total del pedido
  const calculateTotal = () => {
    if (!order.items || order.items.length === 0) return 0;

    return order.items
      .reduce((total, item) => {
        const itemTotal =
          parseFloat(item.itemPrice || 0) + parseFloat(item.shippingPrice || 0);
        return total + itemTotal;
      }, 0)
      .toFixed(2);
  };

  // Formatear dirección
  const formatAddress = () => {
    const parts = [
      order.shipAddress1,
      order.shipAddress2,
      order.shipAddress3,
      order.shipPostalCode,
      order.shipCity,
      order.shipState,
      order.shipCountry,
    ].filter(Boolean);

    return parts.join(", ");
  };

  return (
    <div className="order-detail">
      <div className="order-header" onClick={() => setExpanded(!expanded)}>
        <div className="order-id">
          <span>
            Nº de pedido: {order.amazonOrderId || order.prestashopOrderId}
          </span>
        </div>

        <div className="order-status">
          <span
            className={`status-badge ${
              isExpired(order.latestShipDate) ? "expired" : ""
            }`}
          >
            {order.orderStatus}
          </span>
        </div>

        <div className="order-actions">
          <div className="switch-container">
            <label>Sin stock</label>
            <input
              type="checkbox"
              checked={order.pendingWithoutStock}
              onChange={(e) => onToggleOutOfStock(order._id, e.target.checked)}
            />
            <span className="switch"></span>
          </div>

          <div className="switch-container">
            <label>Marcar para envío</label>
            <input
              type="checkbox"
              checked={order.markForShipment}
              onChange={(e) => onMarkForShipment(order._id, e.target.checked)}
            />
            <span className="switch"></span>
          </div>
        </div>
      </div>

      {expanded && (
        <>
          <div className="order-info">
            {/* Información del pedido, cliente, dirección, etc. */}
            {/* Similar a la implementación original */}
          </div>

          <div className="order-products">
            <h3>Productos</h3>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items &&
                  order.items.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <div className="product-name">{item.productName}</div>
                        <div className="product-sku">SKU: {item.sku}</div>
                      </td>
                      <td>{item.quantityPurchased}</td>
                      <td>
                        {parseFloat(
                          item.itemPrice / item.quantityPurchased
                        ).toFixed(2)}{" "}
                        €
                      </td>
                      <td>{parseFloat(item.itemPrice).toFixed(2)} €</td>
                    </tr>
                  ))}
                <tr className="total-row">
                  <td colSpan="3">Total</td>
                  <td>{calculateTotal()} €</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

function isExpired(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date < new Date();
}

export default OrderDetail;
