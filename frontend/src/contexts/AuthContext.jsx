import React, { createContext, useState, useEffect } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import { authService } from "../services/api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Configurar axios para incluir el token en las solicitudes
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  // Verificar token al cargar
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // Verificar si el token ha expirado
        const decoded = jwtDecode(token);
        const currentTime = Date.now() / 1000;

        if (decoded.exp < currentTime) {
          // Token expirado
          logout();
          setError("Sesión expirada. Por favor, inicia sesión nuevamente.");
        } else {
          // Token válido, obtener perfil de usuario
          try {
            const response = await authService.getProfile();
            setUser(response);
          } catch (profileError) {
            console.error("Error al obtener perfil:", profileError);
            logout();
          }
        }
      } catch (error) {
        console.error("Error verificando token:", error);
        logout();
        setError(
          "Error de autenticación. Por favor, inicia sesión nuevamente."
        );
      } finally {
        setLoading(false);
      }
    };
    verifyToken();
  }, [token]);

  // Iniciar sesión
  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      setUser(null);
      setToken(null);
      localStorage.removeItem("token");

      const response = await authService.login(email, password);

      console.log(response);

      if (response && response.token) {
        // Guardar token en localStorage
        localStorage.setItem("token", response.token);
        setToken(response.token);
        setUser(response);

        axios.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${response.token}`;

        return true;
      } else {
        setError("Credenciales inválidas");
        return false;
      }
    } catch (error) {
      console.error("Error de inicio de sesión:", error);
      setError(error.response?.data?.message || "Error de inicio de sesión");
      setUser(null);
      setToken(null);
      localStorage.removeItem("token");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Cerrar sesión
  const logout = () => {
    try {
      // Opcional: notificar al backend sobre el logout
      // await authService.logout();

      // Limpiar estado local
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);

      // Limpiar headers de axios
      delete axios.defaults.headers.common["Authorization"];

      return true;
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      return false;
    }
  };

  // Actualizar perfil
  const updateProfile = async (userData) => {
    try {
      setLoading(true);

      const response = await authService.updateProfile(userData);

      setUser(response.data);

      // Si se actualizó el token, guardarlo
      if (response.data.token) {
        localStorage.setItem("token", response.data.token);
        setToken(response.data.token);
      }

      return { success: true };
    } catch (error) {
      console.error("Error actualizando perfil:", error);
      setError(error.response?.data?.message || "Error actualizando perfil");
      return { success: false, error: error.response?.data?.message };
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        login,
        logout,
        updateProfile,
        setError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizado para usar el contexto de autenticación
export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
};
