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
  getProfile: async () => {
    const response = await api.get("/auth/profile");
    return response.data;
  },
  updateProfile: async (userData) => {
    const response = await api.put("/auth/profile", userData);
    return response.data;
  },
  updateAvatar: async (userAvatar) => {
    const response = await api.post("/auth/upload-avatar", userAvatar, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  getUsers: async (filters = {}) => {
    const response = await api.get("/auth/users", { params: filters });
    return response.data;
  },

  // Obtener usuario por ID
  getUserById: async (id) => {
    const response = await api.get(`/auth/users/${id}`);
    return response.data;
  },

  // Crear un nuevo usuario
  createUser: async (userData) => {
    const response = await api.post("/auth/register", userData);
    return response.data;
  },

  // Actualizar usuario
  updateUser: async (id, userData) => {
    const response = await api.put(`/auth/users/${id}`, userData);
    return response.data;
  },

  // Activar/Desactivar usuario
  toggleUserStatus: async (id) => {
    const response = await api.patch(`/auth/users/${id}/toggle-status`);
    return response.data;
  },

  // Resetear contraseña (solo root)
  resetUserPassword: async (id) => {
    const response = await api.post(`/auth/users/${id}/reset-password`);
    return response.data;
  },

  // Eliminar usuario
  deleteUser: async (id) => {
    const response = await api.delete(`/auth/users/${id}`);
    return response.data;
  },
};

// Servicio para productos
export const productService = {
  // Obtener productos con filtros y paginación
  getProducts: async (params = {}) => {
    const response = await api.get("/products", { params });
    return response.data;
  },

  // Obtener marcas disponibles
  getBrands: async () => {
    const response = await api.get("/products/brands");
    return response.data;
  },

  // Obtener estadísticas de productos
  getStats: async () => {
    const response = await api.get("/products/stats");
    return response.data;
  },

  // Obtener producto por ID
  getProductById: async (id) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  // Importar productos desde Excel
  importProducts: async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post("/products/import", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 300000, // 5 minutos timeout para importación
    });
    return response.data;
  },

  // Descargar plantilla de importación
  downloadImportTemplate: () => {
    window.open(`${baseURL}/products/import/template`, "_blank");
  },

  // Sincronizar productos con Amazon
  syncProducts: async () => {
    const response = await api.post("/products/sync");
    return response.data;
  },

  // Sincronizar status de productos usando reporte de merchant listings
  syncProductStatus: async () => {
    const response = await api.post("/products/sync-status");
    return response.data;
  },

  // Solicitar reporte de merchant listings
  requestListingsReport: async () => {
    const response = await api.post("/products/request-listings-report");
    return response.data;
  },

  // Verificar estado de un reporte
  checkReportStatus: async (reportId) => {
    const response = await api.get(`/products/report-status/${reportId}`);
    return response.data;
  },

  // Obtener reportes disponibles
  getAvailableReports: async () => {
    const response = await api.get("/products/available-reports");
    return response.data;
  },

  // Actualizar stock de un producto
  updateProductStock: async (id, quantity) => {
    const response = await api.put(`/products/${id}/stock`, { quantity });
    return response.data;
  },

  // Actualizar stock de múltiples productos
  bulkUpdateStock: async (updates) => {
    const response = await api.put("/products/bulk-stock", { updates });
    return response.data;
  },

  // Verificar si hay productos que necesitan sincronización
  checkSyncNeeded: async () => {
    const response = await api.get("/products/sync-needed");
    return response.data;
  },
};

// Servicio para pricing
export const pricingService = {
  // Configuración
  getConfig: async () => {
    const response = await api.get("/pricing/config");
    return response.data;
  },

  updateConfig: async (config) => {
    const response = await api.put("/pricing/config", config);
    return response.data;
  },

  // Cálculo de PVPM
  calculatePVPM: async (productId) => {
    const response = await api.post(`/pricing/calculate-pvpm/${productId}`);
    return response.data;
  },

  recalculateBulkPVPM: async (params = {}) => {
    const response = await api.post("/pricing/recalculate-pvpm", params);
    return response.data;
  },

  // Actualización de precios
  updatePrice: async (productId, newPrice, reason = "manual") => {
    const response = await api.put(`/pricing/update-price/${productId}`, {
      newPrice,
      reason,
    });
    return response.data;
  },

  // Configuración por producto
  updateProductSettings: async (productId, settings) => {
    const response = await api.put(
      `/pricing/product-settings/${productId}`,
      settings
    );
    return response.data;
  },

  // Historial y acciones pendientes
  getPriceHistory: async (params = {}) => {
    const response = await api.get("/pricing/price-history", { params });
    return response.data;
  },

  getPendingActions: async () => {
    const response = await api.get("/pricing/pending-actions");
    return response.data;
  },
  getPendingActionProducts: async (actionType, params = {}) => {
    const response = await api.get(`/pricing/pending-actions/${actionType}`, {
      params,
    });
    return response.data;
  },
  getPriceHistoryStats: async (params = {}) => {
    const response = await api.get("/pricing/price-history/stats", { params });
    return response.data;
  },

  getPricingStats: async () => {
    const response = await api.get("/pricing/stats");
    return response.data;
  },

  getTopActivityProducts: async (limit = 10) => {
    const response = await api.get("/pricing/top-activity", {
      params: { limit },
    });
    return response.data;
  },

  getPricingTrends: async (period = "week") => {
    const response = await api.get("/pricing/trends", {
      params: { period },
    });
    return response.data;
  },
};

export default api;
