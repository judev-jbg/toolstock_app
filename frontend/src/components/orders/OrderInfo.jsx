import TagRadius from "./TagRadius";
import Flag from "./Flag";
import Witness from "./Witness";
import Label from "./Label";
import useFormatDate from "../hooks/useFormatDate";
import useIsOutOfTime from "../hooks/useIsOutOfTime";
import useAddressFormatter from "../hooks/useAddressFormatter";
import useCountry from "../hooks/useCountry";

const OrderInfo = ({ order }) => {
  const {
    billAddress1,
    billAddress2,
    billAddress3,
    billPostalCode,
    billCity,
    billState,
    shipAddress1,
    shipAddress2,
    shipAddress3,
    shipPostalCode,
    shipCity,
    shipState,
  } = order;
  const addressShipData = {
    shipAddress1,
    shipAddress2,
    shipAddress3,
    shipPostalCode,
    shipCity,
    shipState,
  };
  const addressBillData = {
    billAddress1,
    billAddress2,
    billAddress3,
    billPostalCode,
    billCity,
    billState,
  };
  const getCountryName = useCountry();
  return (
    <div className="order-info">
      <div className="order-info-sumary">
        <div className="order-info-title">Datos del pedido</div>
        <span className="order-info-channel">
          <Label
            text={order.salesChannel}
            tooltipText="Canal"
            positionTooltip="right"
            needSplit={false}
          />
          <Flag channel={order.salesChannel} />
        </span>

        <Label
          text={useFormatDate(order.purchaseDate)}
          tooltipText="Fecha de compra"
          positionTooltip="right"
          needSplit={false}
        />
        <span className="order-info-latest-ship">
          <Label
            text={useFormatDate(order.latestShipDate)}
            tooltipText="Fecha tope de envío"
            positionTooltip="right"
            needSplit={false}
          />
          {useIsOutOfTime(order.latestShipDate) && (
            <span className="order-info-witness">
              <Witness />
            </span>
          )}
        </span>
        <Label
          text={useFormatDate(order.latestDeliveryDate)}
          tooltipText="Fecha tope de entrega"
          positionTooltip="right"
          needSplit={false}
        />
        <span className="order-info-tag-conatiner">
          {order.isBusinessOrder === 1 && (
            <TagRadius label="Empresarial" tooltipText="Cliente" />
          )}
          {order.items[0].itemTax > 0 ? (
            <TagRadius label="Pago con IVA" tooltipText="Tipo de pago" />
          ) : (
            <TagRadius label="Pago sin IVA" tooltipText="Tipo de pago" />
          )}
        </span>
      </div>
      <div className="order-info-bill-invoice">
        <div className="order-info-title">
          Datos del comprador y facturación
        </div>
        <Label
          text={order.buyerName}
          tooltipText="Usuario"
          positionTooltip="left"
          needSplit={!order.isBusinessOrder}
        />
        {order.billName && (
          <Label
            text={order.billName}
            tooltipText="Facturacion"
            positionTooltip="left"
            needSplit={!order.isBusinessOrder}
          />
        )}
        {order.buyerTaxRegistrationId && (
          <Label
            text={order.buyerTaxRegistrationId.replace("ES", "")}
            tooltipText="NIF"
            positionTooltip="left"
            needSplit={false}
          />
        )}

        {order.billAddress1 && (
          <Label
            text={useAddressFormatter(addressBillData)}
            tooltipText="Dirección"
            positionTooltip="left"
            needSplit={false}
          />
        )}

        {order.billCity && (
          <Label
            text={order.billCity}
            tooltipText="Ciudad"
            positionTooltip="left"
            needSplit={false}
          />
        )}
        {order.billState && (
          <Label
            text={order.billState}
            tooltipText="Provincia"
            positionTooltip="left"
            needSplit={false}
          />
        )}
        {order.billPostalCode && (
          <Label
            text={
              order.billPostalCode && order.billPostalCode.length === 4
                ? `0${order.billPostalCode}`
                : order.billPostalCode
            }
            tooltipText="Provincia"
            positionTooltip="left"
            needSplit={false}
          />
        )}
        {order.billCountry && (
          <Label
            text={getCountryName(order.billCountry)}
            tooltipText="País"
            positionTooltip="left"
            needSplit={false}
          />
        )}

        {order.buyerPhoneNumber && (
          <Label
            text={order.buyerPhoneNumber}
            tooltipText="Teléfono"
            positionTooltip="left"
            needSplit={false}
          />
        )}
        {order.buyerEmail && (
          <Label
            text={order.buyerEmail}
            tooltipText="Email"
            positionTooltip="left"
            needSplit={false}
          />
        )}
      </div>
      <div className="order-info-shipping">
        <div className="order-info-title">Datos del envío</div>

        {order.purchaseOrderNumber ? (
          <Label
            text={order.recipientName.replace(
              "PO" + order.purchaseOrderNumber,
              ""
            )}
            tooltipText="Destinatario"
            positionTooltip="left"
            needSplit={!order.isBusinessOrder}
          />
        ) : (
          <Label
            text={order.recipientName}
            tooltipText="Destinatario"
            positionTooltip="left"
            needSplit={!order.isBusinessOrder}
          />
        )}

        <Label
          text={useAddressFormatter(addressShipData)}
          tooltipText="Dirección"
          positionTooltip="left"
          needSplit={false}
        />
        {order.shipState && (
          <Label
            text={order.shipState}
            tooltipText="Provincia"
            positionTooltip="left"
            needSplit={false}
          />
        )}

        {order.shipCity && (
          <Label
            text={order.shipCity}
            tooltipText="Ciudad"
            positionTooltip="left"
            needSplit={false}
          />
        )}

        <Label
          text={
            order.shipPostalCode && order.shipPostalCode.length === 4
              ? `0${order.shipPostalCode}`
              : order.shipPostalCode
          }
          tooltipText="Codigo Postal"
          positionTooltip="left"
          needSplit={false}
        />
        <Label
          text={getCountryName(order.shipCountry)}
          tooltipText="País"
          positionTooltip="left"
          needSplit={false}
        />
        {order.shipPhoneNumber && (
          <Label
            text={order.shipPhoneNumber}
            tooltipText="Teléfono"
            positionTooltip="left"
            needSplit={false}
          />
        )}

        <Label
          text="orders@toolstock.info"
          tooltipText="Email"
          positionTooltip="left"
          needSplit={false}
        />
        <Label
          text={order.amazonOrderId}
          tooltipText="Dpto"
          positionTooltip="left"
          needSplit={false}
        />
        {order.deliveryInstructions && (
          <Label
            text={order.deliveryInstructions}
            tooltipText="Obs"
            positionTooltip="left"
            needSplit={false}
          />
        )}

        {order.purchaseOrderNumber && (
          <Label
            text={order.purchaseOrderNumber}
            tooltipText="RefC"
            positionTooltip="left"
            needSplit={false}
          />
        )}
      </div>
    </div>
  );
};

export default OrderInfo;
