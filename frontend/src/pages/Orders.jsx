import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/orders/Header";
import Filters from "../components/orders/Filters";
import SearchBarModal from "../components/orders/SearchBarModal";
import OrderSkeleton from "../components/orders/OrderSkeleton";
import SearchNoResult from "../components/common/SearchNoResult";
import ToastNotifier from "../components/common/ToastNotifier";
import useAddressFormatter from "../hooks/useAddressFormatter";
import useCodCountry from "../hooks/useCodCountry";
import { orderService } from "../services/api";
import "./Orders.css";

const Orders = () => {
  const navigate = useNavigate();
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [switchStates, setSwitchStates] = useState({});
  const [orders, setOrders] = useState([]);
  const [itemsFilter, setItemsFilter] = useState([
    {
      id: 1,
      resource: "pending",
      label: "Pendientes de envío",
      newBlock: false,
      counter: 0,
      active: true,
    },
    {
      id: 2,
      resource: "pendingUntilToday",
      label: "Hoy",
      newBlock: false,
      counter: 0,
      active: false,
    },
    {
      id: 3,
      resource: "delayed",
      label: "Vencidos",
      newBlock: false,
      counter: 0,
      active: false,
    },
    {
      id: 4,
      resource: "outOfStock",
      label: "Pendientes de envío - Sin stock",
      newBlock: true,
      counter: 0,
      active: false,
    },
    {
      id: 5,
      resource: "outOfStockUntilToday",
      label: "Hoy",
      newBlock: false,
      counter: 0,
      active: false,
    },
    {
      id: 6,
      resource: "outOfStockDelayed",
      label: "Vencidos",
      newBlock: false,
      counter: 0,
      active: false,
    },
    {
      id: 7,
      resource: "shipFake",
      label: "Envíos fake",
      newBlock: true,
      counter: 0,
      active: false,
    },
  ]);
  const [showUpButton, setShowUpButton] = useState("");
  const [activeResource, setActiveResource] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [addressToFormat, setAddressToFormat] = useState(null);
  const [toast, setToast] = useState({ visible: false, message: "", type: "" });
  const formattedAddress = useAddressFormatter(addressToFormat);
  const getCountryCode = useCodCountry();

  // Mostrar notificación toast
  const showToast = (message, type) => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast({ visible: false, message: "", type: "" });
    }, 3000);
  };

  // Cargar todos los datos y contadores
  useEffect(() => {
    fetchAllOrders();
  }, []);

  // Actualizar switchStates cuando cambian las órdenes
  useEffect(() => {
    if (orders.length > 0 && orders[0]?.payload) {
      const initialSwitchStates = {};
      orders[0].payload.forEach((item) => {
        const id = `ship-${item.amazonOrderId}`;
        const initialValue = item.markForShipment || 0;
        initialSwitchStates[id] = initialValue;
      });
      setSwitchStates(initialSwitchStates);
    }
  }, [orders]);

  // Continuar con el proceso de envío cuando tengamos dirección formateada
  useEffect(() => {
    if (addressToFormat && formattedAddress) {
      continueWithShipmentRequest(
        addressToFormat.targetOrder,
        formattedAddress
      );
    }
  }, [addressToFormat, formattedAddress]);

  // Manejar scroll para botón de subir
  useEffect(() => {
    const handleScroll = () => {
      setShowUpButton(window.pageYOffset > 1500 ? "show" : "");
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Obtener todas las órdenes y actualizar contadores
  const fetchAllOrders = async () => {
    try {
      setIsLoading(true);

      // Obtener contadores
      const countsResponse = await orderService.getOrderCounts();

      // Actualizar contadores en filtros
      if (countsResponse) {
        setItemsFilter((prevFilters) => {
          return prevFilters.map((filter) => {
            let count = 0;

            switch (filter.resource) {
              case "pending":
                count = countsResponse.pending || 0;
                break;
              case "pendingUntilToday":
                count = countsResponse.pendingUntilToday || 0;
                break;
              case "delayed":
                count = countsResponse.delayed || 0;
                break;
              case "outOfStock":
                count = countsResponse.outOfStock || 0;
                break;
              case "outOfStockUntilToday":
                count = countsResponse.outOfStockUntilToday || 0;
                break;
              case "outOfStockDelayed":
                count = countsResponse.outOfStockDelayed || 0;
                break;
              case "shipFake":
                count = countsResponse.shipFake || 0;
                break;
              default:
                count = filter.counter;
            }

            return {
              ...filter,
              counter: count,
            };
          });
        });
      }

      // Obtener órdenes para el filtro activo
      const ordersResponse = await orderService.getPendingOrders();

      if (ordersResponse) {
        setOrders([
          {
            header: { status: "ok", content: 1, resource: "pending" },
            payload: ordersResponse.orders || [],
          },
        ]);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error al cargar órdenes:", error);
      showToast("Error al cargar órdenes", "error");
      setIsLoading(false);
    }
  };

  // Manejar clic en filtro
  const handleFilterClick = async (filterId) => {
    // Actualizar el filtro activo
    const updatedFilters = itemsFilter.map((filter) => ({
      ...filter,
      active: filter.id === filterId,
    }));

    setItemsFilter(updatedFilters);

    // Obtener el recurso del filtro seleccionado
    const selectedFilter = itemsFilter.find((filter) => filter.id === filterId);

    if (selectedFilter) {
      setActiveResource(selectedFilter.resource);
      setIsLoading(true);

      try {
        let response;

        switch (selectedFilter.resource) {
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

        if (response) {
          setOrders([
            {
              header: {
                status: "ok",
                content: 1,
                resource: selectedFilter.resource,
              },
              payload: response.orders || [],
            },
          ]);
        }
      } catch (error) {
        console.error(
          `Error al obtener órdenes para ${selectedFilter.resource}:`,
          error
        );
        showToast("Error al cargar órdenes", "error");
      }

      setIsLoading(false);
    }
  };

  // Abrir/cerrar modal de búsqueda
  const handlerModalSearch = () => {
    setIsOpenModal(!isOpenModal);
  };

  // Continuar con solicitud de envío
  const continueWithShipmentRequest = async (targetOrder, formattedAddress) => {
    try {
      // Obtener el código del país
      const countryName = getCountryCode(targetOrder.shipCountry);

      // Construir el cuerpo de la solicitud
      const requestBody = {
        servicio: 37,
        horario: 3,
        destinatario: targetOrder.recipientName || "",
        direccion: formattedAddress,
        pais: countryName || targetOrder.shipCountry,
        cp: targetOrder.shipPostalCode || "",
        poblacion: targetOrder.shipCity || "",
        telefono:
          targetOrder.shipPhoneNumber || targetOrder.buyerPhoneNumber || "",
        email: "orders@toolstock.info",
        departamento: targetOrder.amazonOrderId || "",
        contacto: targetOrder.recipientName || "",
        observaciones: targetOrder.deliveryInstructions || "",
        bultos: 1,
        movil:
          targetOrder.shipPhoneNumber || targetOrder.buyerPhoneNumber || "",
        refC: targetOrder.purchaseOrderNumber || "",
        idOrder: targetOrder.amazonOrderId || "",
        process: "isFile",
        value: 1,
        shipmentType: "usingFile",
      };

      // Realizar la solicitud POST
      const response = await orderService.addOrderToShipment(requestBody);

      if (response && response.success) {
        showToast("Pedido añadido correctamente", "success");
      } else {
        showToast("Error al añadir pedido para envío", "error");
      }

      // Limpiar el estado después de completar la solicitud
      setAddressToFormat(null);
    } catch (error) {
      console.error("Error al enviar la orden para despacho:", error);
      showToast("Error al procesar el envío", "error");

      // Revertir el cambio del switch en caso de error
      if (targetOrder && targetOrder.amazonOrderId) {
        setSwitchStates((prevStates) => ({
          ...prevStates,
          [`ship-${targetOrder.amazonOrderId}`]: 0,
        }));
      }

      // Limpiar el estado de dirección
      setAddressToFormat(null);
    }
  };

  // Manejar cambios en los switches
  const handleSwitchChange = async (id, isChecked, actionSwitch) => {
    // Determinar el prefijo según el tipo de acción
    let prefix = "";
    if (actionSwitch === "ship") {
      prefix = "ship-";
    } else if (actionSwitch === "stock") {
      prefix = "stock-";
    } else if (actionSwitch === "fake") {
      prefix = "fake-";
    } else {
      console.error(`Tipo de acción desconocido: ${actionSwitch}`);
      return;
    }

    // Extraer el ID de la orden
    const orderId = id.replace(prefix, "");

    // Buscar la orden correspondiente
    let targetOrder = null;
    orders.forEach((orderGroup) => {
      if (orderGroup && orderGroup.payload) {
        const foundOrder = orderGroup.payload.find(
          (order) => order.amazonOrderId === orderId
        );

        if (foundOrder) {
          targetOrder = foundOrder;
        }
      }
    });

    if (!targetOrder) {
      console.error(`No se encontró la orden con ID: ${orderId}`);
      return;
    }

    try {
      // Manejar cada tipo de acción
      if (actionSwitch === "ship") {
        if (isChecked) {
          // Preparar datos para formatear dirección
          setAddressToFormat({
            shipAddress1: targetOrder.shipAddress1,
            shipAddress2: targetOrder.shipAddress2,
            shipAddress3: targetOrder.shipAddress3,
            shipPostalCode: targetOrder.shipPostalCode,
            shipCity: targetOrder.shipCity,
            shipState: targetOrder.shipState,
            targetOrder,
          });
        } else {
          // Si el switch se desactivó, eliminar orden de envío
          const deleteResponse = await orderService.deleteOrderToShipment({
            idOrder: targetOrder.amazonOrderId,
            value: 0,
            shipmentType: "usingFile",
          });

          if (deleteResponse && deleteResponse.success) {
            showToast("Pedido eliminado de envíos", "success");
          } else {
            showToast("Error al eliminar pedido de envíos", "error");
            // Revertir switch si hay error
            setSwitchStates((prevStates) => ({
              ...prevStates,
              [id]: 1,
            }));
            return;
          }
        }

        // Actualizar estado del switch
        setSwitchStates((prevStates) => ({
          ...prevStates,
          [id]: isChecked ? 1 : 0,
        }));
      }
      // Manejar acción "stock"
      else if (actionSwitch === "stock") {
        const response = await orderService.updateOrderStockStatus(
          targetOrder.amazonOrderId,
          isChecked
        );

        if (response && response.success) {
          showToast(
            `Pedido marcado ${isChecked ? "sin" : "con"} stock`,
            "success"
          );

          // Actualizar contadores
          fetchAllOrders();
        } else {
          showToast("Error al actualizar estado de stock", "error");
          return;
        }
      }
      // Manejar acción "fake"
      else if (actionSwitch === "fake") {
        const response = await orderService.updateOrderShipFake(
          targetOrder.amazonOrderId,
          isChecked
        );

        if (response && response.success) {
          showToast(
            `Envío fake ${isChecked ? "activado" : "desactivado"}`,
            "success"
          );
        } else {
          showToast("Error al actualizar estado de envío fake", "error");
          return;
        }
      }
    } catch (error) {
      console.error(`Error al procesar la acción ${actionSwitch}:`, error);
      showToast("Error de conexión", "error");

      // Revertir switch en caso de error
      setSwitchStates((prevStates) => ({
        ...prevStates,
        [id]: isChecked ? 0 : 1,
      }));

      if (actionSwitch === "ship" && isChecked) {
        setAddressToFormat(null);
      }
    }
  };

  // Verificar si algún switch está activado
  const isAnySwitchChecked = Object.values(switchStates).some(
    (state) => state === 1 || state === true
  );

  // Manejar clic en botón de subir
  const handleUpButtonClick = () => {
    window.scroll(0, 0);
    setShowUpButton("");
  };

  // Navegar a la página de preparación de envíos
  const handlePrepareShipments = () => {
    navigate("/orders/to-ship");
  };

  // Navegar a la página de historial de envíos
  const handleShipmentsHistory = () => {
    navigate("/orders/shipments-history");
  };

  // Renderizado condicional de órdenes
  const renderOrders = () => {
    if (isLoading) {
      return Array(3)
        .fill(0)
        .map((_, index) => <OrderSkeleton key={index} />);
    }

    if (orders.length === 0 || orders[0].payload.length === 0) {
      return <SearchNoResult />;
    }

    const activeOrder = orders[0];

    if (!activeOrder || !activeOrder.payload) {
      return <SearchNoResult />;
    }

    if (activeOrder.payload.length === 0) {
      return <SearchNoResult />;
    }

    return activeOrder.payload.map((order, index) => (
      <Order
        key={order.amazonOrderId || index}
        order={order}
        onSwitchChange={handleSwitchChange}
      />
    ));
  };

  return (
    <div className="orders-page">
      <div className="orders-header">
        <h1>Pedidos</h1>
        <div className="header-actions">
          <button
            className="button-line"
            onClick={handleShipmentsHistory}
            disabled={isLoading}
          >
            Historial de envíos
          </button>

          {isAnySwitchChecked && (
            <button
              className="button"
              onClick={handlePrepareShipments}
              disabled={isLoading}
            >
              Preparar envíos
            </button>
          )}
        </div>
      </div>

      <Filters
        filters={itemsFilter}
        activeFilter={activeResource}
        onFilterChange={handleFilterClick}
      />

      <div className="search-container">
        <div className="search-bar" onClick={handlerModalSearch}>
          <span className="search-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
            >
              <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Buscar pedido..."
            className="input"
            readOnly
          />
        </div>
      </div>

      {toast.visible && (
        <ToastNotifier message={toast.message} type={toast.type} />
      )}

      <div className="orders-container">{renderOrders()}</div>

      <button
        className={`fab-button up-button ${showUpButton}`}
        onClick={handleUpButtonClick}
      >
        <span>↑</span>
      </button>

      {isOpenModal && (
        <SearchBarModal
          open={isOpenModal}
          close={() => {
            handlerModalSearch();
            document.getElementsByTagName("html")[0].removeAttribute("style");
          }}
          setOrders={setOrders}
          setItemsFilter={setItemsFilter}
        />
      )}
    </div>
  );
};

export default Orders;
