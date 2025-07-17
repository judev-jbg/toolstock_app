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

  getUserById: async (id) => {
    const response = await api.get(`/auth/users/${id}`);
    return response.data;
  },

  createUser: async (userData) => {
    const response = await api.post("/auth/register", userData);
    return response.data;
  },

  updateUser: async (id, userData) => {
    const response = await api.put(`/auth/users/${id}`, userData);
    return response.data;
  },

  toggleUserStatus: async (id) => {
    const response = await api.patch(`/auth/users/${id}/toggle-status`);
    return response.data;
  },

  resetUserPassword: async (id) => {
    const response = await api.post(`/auth/users/${id}/reset-password`);
    return response.data;
  },

  deleteUser: async (id) => {
    const response = await api.delete(`/auth/users/${id}`);
    return response.data;
  },
};

// Servicio para productos
export const productService = {
  getProducts: async (params = {}) => {
    const response = await api.get("/products", { params });
    return response.data;
  },

  getBrands: async () => {
    const response = await api.get("/products/brands");
    return response.data;
  },

  getStats: async () => {
    const response = await api.get("/products/stats");
    return response.data;
  },

  getProductById: async (id) => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  updateProduct: async (id, productData) => {
    const response = await api.put(`/products/${id}`, productData);
    return response.data;
  },

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

  downloadImportTemplate: () => {
    window.open(`${baseURL}/products/import/template`, "_blank");
  },

  syncProducts: async () => {
    const response = await api.post("/products/sync");
    return response.data;
  },

  updateProductStock: async (id, quantity) => {
    const response = await api.put(`/products/${id}/stock`, { quantity });
    return response.data;
  },

  bulkUpdateStock: async (updates) => {
    const response = await api.put("/products/bulk-stock", { updates });
    return response.data;
  },

  checkSyncNeeded: async () => {
    const response = await api.get("/products/sync-needed");
    return response.data;
  },

  // Funciones de debug (solo para admin/root)
  getAvailableEndpoints: async () => {
    const response = await api.get("/products/debug/endpoints");
    return response.data;
  },

  getTestOrders: async () => {
    const response = await api.get("/products/debug/test-orders");
    return response.data;
  },

  checkAmazonConfig: async () => {
    const response = await api.get("/products/debug/config-check");
    return response.data;
  },

  // Funciones de jobs (solo para admin/root)
  getJobsStatus: async () => {
    const response = await api.get("/products/jobs/status");
    return response.data;
  },

  executeJob: async (jobName) => {
    const response = await api.post(`/products/jobs/execute/${jobName}`);
    return response.data;
  },

  getJobsInfo: async () => {
    const response = await api.get("/products/jobs/info");
    return response.data;
  },
};

export default api;
