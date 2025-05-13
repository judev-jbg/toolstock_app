import React from "react";
import useCopyToClipboard from "../hooks/useCopyToClipboard";
import ProductImage from "./ProductImage";

const OrderProducts = ({ order }) => {
  const copyToClipboard = useCopyToClipboard();
  const handleCopySingle = (text) => {
    copyToClipboard(text);
  };
  // Verificamos que order.items existe y es un array
  const items = order?.items || [];

  // Calculamos el total de todo el pedido
  const calculateOrderTotal = () => {
    let total = 0;
    items.forEach((item) => {
      // Sumamos precio con impuestos multiplicado por cantidad
      total += parseFloat(item.itemPrice) + parseFloat(item.shippingPrice);
    });
    return total.toFixed(2);
  };

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th className="text-left border-l">Imagen</th>
          <th className="text-left">Titulo / SKU</th>
          <th>Cantidad</th>
          <th>PxU (sIVA)</th>
          <th>PxU (cIVA)</th>
          <th className="border-l">Importe (cIVA)</th>
          <th>Importe (sIVA)</th>
          <th className="border-r">IVA</th>
        </tr>
      </thead>
      <tbody>
        {/* Renderizar productos desde aqui */}
        {items.map((item) => {
          // Calculamos importes
          const cantidadComprada = item.quantityPurchased;
          const precioUnidadSinIVA =
            parseFloat(item.vatExclusiveItemPrice) /
            parseFloat(item.quantityPurchased);
          const precioUnidadConIVA =
            parseFloat(item.itemTax) === 0
              ? parseFloat(item.vatExclusiveItemPrice) /
                parseFloat(item.quantityPurchased)
              : parseFloat(item.vatExclusiveItemPrice) /
                  parseFloat(item.quantityPurchased) +
                parseFloat(item.itemTax) / parseFloat(item.quantityPurchased);
          const subTotalProducto = parseFloat(item.itemPrice);

          const productoSoloIVA = parseFloat(item.itemTax);
          const productoSinIVA = (subTotalProducto - productoSoloIVA).toFixed(
            2
          );

          const envio = parseFloat(item.shippingPrice);
          const envioSinIVA =
            parseFloat(item.shippingPrice || 0) -
            parseFloat(item.shippingTax || 0);
          const envioSoloIVA = parseFloat(item.shippingTax || 0);

          // Totales
          const totalConIVA = subTotalProducto + envio;
          const totalSinIVA = totalConIVA - (productoSoloIVA + envioSoloIVA);
          const totalIVA = productoSoloIVA + envioSoloIVA;

          return (
            <tr key={item.orderItemId}>
              <td className="border-l">
                <span
                  style={{
                    display: "inline-block",
                    width: "70px",
                    height: "70px",
                  }}
                >
                  <ProductImage
                    referenciaProv={item.referenciaProv}
                    productName={item.productName}
                  />
                </span>
              </td>
              <td>
                <div
                  className="flex"
                  style={{
                    maxWidth: "40rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  <div className="text-end">
                    <div
                      style={{
                        fontWeight: 600,
                        marginRight: ".2rem",
                      }}
                    >
                      Titulo:
                    </div>
                    <div style={{ fontWeight: 600, marginRight: ".2rem" }}>
                      SKU:
                    </div>
                  </div>
                  <div
                    className="text-start"
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.productName}
                    </div>
                    <div
                      onClick={() => handleCopySingle(item.sku)}
                      className="sku"
                    >
                      {item.sku}
                    </div>
                  </div>
                </div>
              </td>
              <td className="text-center">{cantidadComprada}</td>
              <td className="text-center">{precioUnidadSinIVA} €</td>
              <td className="text-center">{precioUnidadConIVA.toFixed(2)} €</td>
              <td className="text-center border-l">
                <div className="flex justify-center items-center">
                  <div className="text-end me-1">
                    <div style={{ fontWeight: 600, marginRight: ".1rem" }}>
                      Sub total:
                    </div>
                    {envio > 0 && (
                      <>
                        <div style={{ fontWeight: 600, marginRight: ".1rem" }}>
                          Envio:
                        </div>
                        <div style={{ fontWeight: 600, marginRight: ".1rem" }}>
                          Total:
                        </div>
                      </>
                    )}
                  </div>
                  <div className="text-start">
                    <div>{subTotalProducto} €</div>
                    {envio > 0 && (
                      <>
                        <div>{envio} €</div>
                        <div>{totalConIVA} €</div>
                      </>
                    )}
                  </div>
                </div>
              </td>
              <td className="text-center">
                <div>{productoSinIVA} €</div>
                {envio > 0 && (
                  <>
                    <div>{envioSinIVA} €</div>
                    <div>{totalSinIVA} €</div>
                  </>
                )}
              </td>
              <td className="text-center border-r">
                <div>{productoSoloIVA} €</div>
                {envio > 0 && (
                  <>
                    <div>{envioSoloIVA} €</div>
                    <div>{totalIVA} €</div>
                  </>
                )}
              </td>
            </tr>
          );
        })}
        {/* Renderizar productos hasta aqui */}
        <tr>
          <td colSpan="8" className="text-right border-l border-r order-total">
            TOTAL DEL PEDIDO: {calculateOrderTotal()}€
          </td>
        </tr>
      </tbody>
    </table>
  );
};

export default OrderProducts;
