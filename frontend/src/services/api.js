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
      window.location.href = "/login";
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
  getPendingOrders: async (params = {}) => {
    const response = await api.get("/orders/pending", { params });
    return response.data;
  },
  getOutOfStockOrders: async (params = {}) => {
    const response = await api.get("/orders/outofstock", { params });
    return response.data;
  },
  getOrdersReadyToShip: async () => {
    const response = await api.get("/orders/readytoship");
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
  uploadAmazonReport: async (file) => {
    const formData = new FormData();
    formData.append("report", file);

    const response = await api.post(
      "/integrations/amazon/upload-report",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  },

  // PrestaShop
  syncPrestashopOrders: async (days = 7) => {
    const response = await api.post("/integrations/prestashop/sync-orders", {
      days,
    });
    return response.data;
  },
  syncFromAmazon: async (options = {}) => {
    const response = await api.post(
      "/integrations/prestashop/sync-from-amazon",
      options
    );
    return response.data;
  },

  // Sincronización general
  fullSync: async () => {
    const response = await api.post("/integrations/sync/full");
    return response.data;
  },

  // ERP
  exportOrdersForERP: async (options = {}) => {
    const response = await api.post("/integrations/erp/export-orders", options);
    return response.data;
  },
  importOrderUpdates: async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post(
      "/integrations/erp/import-updates",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

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

export default api;
