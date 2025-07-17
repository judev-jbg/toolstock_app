import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "./contexts/AuthContext";
import { AppLayout } from "./components/layout/AppLayout";
import { Login } from "./pages/auth/Login";
import { Dashboard } from "./pages/dashboard/Dashboard";
import { Profile } from "./pages/profile/Profile";
import { Catalog } from "./pages/catalog/Catalog";
import { Users } from "./pages/users/Users";
import { AdminPanel } from "./pages/admin/AdminPanel";
import { Analytics } from "./pages/analytics/Analytics";
import { NotFound } from "./pages/NotFound";

// Componente para rutas protegidas
const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const { user, loading, hasRole } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles.length > 0 && !hasRole(requiredRoles)) {
    return <Navigate to="/404" replace />;
  }

  return children;
};

// Componente para rutas públicas (solo accesibles sin autenticación)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />

      {/* Rutas protegidas */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requiredRoles={["admin", "root"]}>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/catalog"
        element={
          <ProtectedRoute requiredRoles={["admin", "root"]}>
            <AppLayout>
              <Catalog />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute requiredRoles={["admin", "root"]}>
            <AppLayout>
              <Analytics />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute requiredRoles={["admin", "root", "guest"]}>
            <AppLayout>
              <Profile />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute requiredRoles={["root"]}>
            <AppLayout>
              <Users />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRoles={["root"]}>
            <AppLayout>
              <AdminPanel />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Página 404 */}
      <Route path="/404" element={<NotFound />} />

      {/* Ruta raíz - redirigir según autenticación */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Capturar todas las demás rutas */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
