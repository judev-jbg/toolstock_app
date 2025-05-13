import Switch from "./Switch";
import TagLine from "./TagLine";
import useCopyToClipboard from "../hooks/useCopyToClipboard";

// eslint-disable-next-line react/prop-types
const OrderHeader = ({ order, onSwitchChange }) => {
  const handleSwitchChange = (id, isChecked, actionSwitch) => {
    onSwitchChange(id, isChecked, actionSwitch);
  };
  const copyToClipboard = useCopyToClipboard();
  const handleCopySingle = (text) => {
    copyToClipboard(text);
  };
  return (
    <div className="order-header">
      <span className="row-data">
        <span className="row-data-group order-id">
          <span className="label">Nº de pedido:</span>
          <span onClick={() => handleCopySingle(order.amazonOrderId)}>
            {order.amazonOrderId}
          </span>
        </span>
        <span className="row-data-group separator">
          <TagLine statusOrder={order.orderStatus} />
        </span>
        <span className="row-data-group separator">
          <Switch
            label="Sin stock" // eslint-disable-next-line react/prop-types
            checked={order.pendingWithoutStock}
            onChange={handleSwitchChange}
            // eslint-disable-next-line react/prop-types
            id={`stock-${order.amazonOrderId}`}
            action="stock"
          />
        </span>
        <span className="row-data-group separator">
          <Switch
            label="Seleccionar para enviar"
            // eslint-disable-next-line react/prop-types
            checked={order.markForShipment}
            onChange={handleSwitchChange}
            // eslint-disable-next-line react/prop-types
            id={`ship-${order.amazonOrderId}`}
            action="ship"
          />
        </span>
        {order.pendingWithoutStock === 1 ? (
          <span className="row-data-group separator">
            <Switch
              label="Envio Fake"
              // eslint-disable-next-line react/prop-types
              checked={order.isShipFake}
              onChange={handleSwitchChange}
              // eslint-disable-next-line react/prop-types
              id={`fake-${order.amazonOrderId}`}
              action="fake"
            />
          </span>
        ) : (
          ""
        )}
      </span>
      <span className="row-data">
        <span className="row-data-group">
          {order.qOrders > 1 ? (
            <>
              <span className="label">Pedidos de este comprador:</span>
              <span>{order.qOrders}</span>
            </>
          ) : (
            <span className="label">Nuevo comprador</span>
          )}
        </span>
        <span className="row-data-group separator">
          {order.qOrderShip > 1 ? (
            <>
              <span className="label">Envíos a esta dirección:</span>
              <span>{order.qOrderShip}</span>
            </>
          ) : (
            <span className="label">Nueva dirección</span>
          )}
        </span>
        {order.expeditionTraking && (
          <span className="row-data-group separator">
            <>
              <span className="label">Expedición:</span>
              <span>{order.expeditionTraking}</span>
            </>
          </span>
        )}
        {order.expeditionTraking && (
          <span className="row-data-group separator">
            <a
              className="link-ship"
              target="_blank"
              href={`http://extranet.gls-spain.es/Extranet/public/ExpedicionASM.aspx?codigo=${
                order.expeditionTraking
              }&cpDst=${
                order.shipPostalCode && order.shipPostalCode.length === 4
                  ? `0${order.shipPostalCode}`
                  : order.shipPostalCode
              }`}
            >
              Ver envío
            </a>
          </span>
        )}
      </span>
    </div>
  );
};

export default OrderHeader;
