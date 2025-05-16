import axios from "axios";

// Configurar la URL base según el entorno
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// Crear instancia de axios con la URL base
const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para añadir el token a las solicitudes
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar errores de respuesta
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Manejar errores de autenticación (token inválido o expirado)
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      const currentPath = window.location.pathname;
      if (currentPath !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Servicio para autenticación
export const authService = {
  login: async (email, password) => {
    const response = await api.post("/auth/login", { email, password });

    return response.data;
  },
  register: async (userData) => {
    const response = await api.post("/auth/register", userData);
    return response.data;
  },
  getProfile: async () => {
    const response = await api.get("/auth/profile");
    return response.data;
  },
  updateProfile: async (userData) => {
    const response = await api.put("/auth/profile", userData);
    return response.data;
  },
  updateAvatar: async (userAvatar) => {
    const response = await api.post("/auth/upload-avatar", userAvatar);
    return response.data;
  },
};

// Servicio para pedidos
export const orderService = {
  getOrders: async (filters = {}) => {
    const response = await api.get("/orders", { params: filters });
    return response.data;
  },
  getOrderById: async (id) => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },
  updateOrderStatus: async (id, statusData) => {
    const response = await api.patch(`/orders/${id}`, statusData);
    return response.data;
  },
  // getPendingOrders: async (params = {}) => {
  //   const response = await api.get("/orders/pending", { params });
  //   return response.data;
  // },
  getOutOfStockOrders: async (params = {}) => {
    const response = await api.get("/orders/outofstock", { params });
    return response.data;
  },
  getOrdersReadyToShip: async () => {
    const response = await api.get("/orders/readytoship");
    return response.data;
  },

  getOrderCounts: async () => {
    const response = await api.get("/orders/counts");
    return response.data;
  },

  downloadShipmentExcel: async (shipments, fileName) => {
    // Utilizar una librería como XLSX para generar Excel en el lado del cliente
    const XLSX = await import("xlsx");

    // Filtrar campos que no deberían estar en el Excel
    const filteredShipments = shipments.map((shipment) => {
      // Clonar el objeto para no modificar el original
      const filtered = { ...shipment };

      // Eliminar campos que no deberían ir en el Excel
      delete filtered.id;
      delete filtered.idOrder;
      delete filtered.exported;
      delete filtered.engraved;
      delete filtered.process;
      delete filtered.fileGenerateName;
      delete filtered.updateDateTime;

      return filtered;
    });

    // Crear WorkSheet
    const worksheet = XLSX.utils.json_to_sheet(filteredShipments);

    // Crear WorkBook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Envios");

    // Descargar archivo
    const cleanFileName = fileName.replace(/\.xlsx$/i, "");
    XLSX.writeFile(workbook, `${cleanFileName}.xlsx`);

    return true;
  },

  // Método para obtener pedidos pendientes hasta hoy
  getPendingOrdersUntilToday: async (params = {}) => {
    const response = await api.get("/api/orders/pending/until-today", {
      params,
    });
    return response.data;
  },

  // Método para obtener pedidos vencidos
  getDelayedOrders: async (params = {}) => {
    const response = await api.get("/api/orders/pending/delayed", { params });
    return response.data;
  },

  markOrderForShipment: async (orderId, isMarked) => {
    const response = await api.patch(`/orders/${orderId}/mark-for-shipment`, {
      markForShipment: isMarked,
    });
    return response.data;
  },

  updateOrderStockStatus: async (orderId, isOutOfStock) => {
    const response = await api.patch(`/orders/${orderId}/stock`, {
      pendingWithoutStock: isOutOfStock,
    });
    return response.data;
  },

  getShipmentsHistory: async () => {
    const response = await api.get("/orders/shipments/history");
    return response.data;
  },

  getShipmentsByFileName: async (fileName) => {
    const response = await api.get(`/orders/shipments/file/${fileName}`);
    return response.data;
  },

  updateOrderToShipment: async (data) => {
    const response = await api.patch(`/orders/shipment/${data.idOrder}`, {
      columnName: data.columnName,
      columnValue: data.columnValue,
    });
    return response.data;
  },

  processShipments: async () => {
    const response = await api.post("/orders/shipments/process", {
      shipmentType: "isFile",
    });
    return response.data;
  },

  syncAmazonOrders: async (days = 7) => {
    const response = await api.post("/integrations/amazon/sync-orders", {
      days,
    });
    return response.data;
  },
};

// Servicio para envíos
export const shippingService = {
  createGLSShipment: async (shipmentData) => {
    const response = await api.post("/shipping/gls/create", shipmentData);
    return response.data;
  },
  getGLSShipmentLabel: async (expeditionNumber) => {
    const response = await api.get(`/shipping/gls/label/${expeditionNumber}`, {
      responseType: "blob",
    });
    return response.data;
  },
  generateGLSShipmentsCsv: async (shipments) => {
    const response = await api.post(
      "/shipping/gls/generate-csv",
      { shipments },
      {
        responseType: "blob",
      }
    );
    return response.data;
  },
  prepareShipmentsFromOrders: async () => {
    const response = await api.post(
      "/shipping/gls/prepare-shipments",
      {},
      {
        responseType: "blob",
      }
    );
    return response.data;
  },
};

// Servicio para integraciones
export const integrationService = {
  // Amazon
  syncAmazonOrders: async (days = 7) => {
    const response = await api.post("/integrations/amazon/sync-orders", {
      days,
    });
    return response.data;
  },

  // PrestaShop
  syncPrestashopOrders: async (days = 7) => {
    const response = await api.post("/integrations/prestashop/sync-orders", {
      days,
    });
    return response.data;
  },

  // Sincronización general
  fullSync: async () => {
    const response = await api.post("/integrations/sync/full");
    return response.data;
  },
};

export const catalogService = {
  getProducts: async (filters = {}) => {
    const response = await api.get("/catalog", { params: filters });
    return response.data;
  },
  getProductById: async (id) => {
    const response = await api.get(`/catalog/${id}`);
    return response.data;
  },
};

export const messageService = {
  getMessages: async (filters = {}) => {
    const response = await api.get("/messages", { params: filters });
    return response.data;
  },
  getMessageById: async (id) => {
    const response = await api.get(`/messages/${id}`);
    return response.data;
  },
  replyToMessage: async (id, messageData) => {
    const response = await api.post(`/messages/${id}/reply`, messageData);
    return response.data;
  },
};

export default api;
