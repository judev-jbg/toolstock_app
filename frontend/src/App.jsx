import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import MainLayout from "./components/layout/MainLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Catalog from "./pages/Catalog";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import CatalogPendingActions from "./pages/CatalogPendingActions";
import CatalogPriceHistory from "./pages/CatalogPriceHistory";
import CatalogPricingDashboard from "./pages/CatalogPricingDashboard";

// Componente para rutas protegidas
const ProtectedRoute = ({ children }) => {
  const { user, loading, token } = useAuth();

  // Mostrar algo mientras se verifica la autenticación
  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  if (!user || !token) {
    return <Navigate to="/login" />;
  }

  return children;
};

// Componente para rutas de administrador
const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  // Mostrar algo mientras se verifica la autenticación
  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  if (!user || (user.role !== "admin" && user.role !== "root")) {
    return <Navigate to="/" />;
  }

  return children;
};

// Componente principal con rutas
const AppRoutes = () => {
  return (
    <Routes>
      {/* Ruta pública: Login */}
      <Route path="/login" element={<Login />} />

      {/* Rutas protegidas */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Dashboard />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/orders"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Orders />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/catalog"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Catalog />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/catalog/pending-actions"
        element={
          <ProtectedRoute>
            <MainLayout>
              <CatalogPendingActions />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/catalog/pricing-dashboard"
        element={
          <ProtectedRoute>
            <MainLayout>
              <CatalogPricingDashboard />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/catalog/price-history"
        element={
          <ProtectedRoute>
            <MainLayout>
              <CatalogPriceHistory />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/messages"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Messages />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Profile />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* Ruta de administración */}
      <Route
        path="/settings"
        element={
          <AdminRoute>
            <MainLayout>
              <Settings />
            </MainLayout>
          </AdminRoute>
        }
      />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/activate-account/:token" element={<ResetPassword />} />

      {/* Ruta para 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// Componente principal envuelto en el contexto de autenticación
function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
