import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FaBars,
  FaTimes,
  FaHome,
  FaBoxOpen,
  FaList,
  FaComment,
  FaSignOutAlt,
  FaUser,
  FaCog,
} from "react-icons/fa";
import { useAuth } from "../../contexts/AuthContext";
import Logo from "../common/Logo";
import "./MainLayout.css";

const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Función para verificar la ruta activa
  const isActive = (path) => {
    return location.pathname === path;
  };

  // Manejar cierre de sesión
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Alternar sidebar
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="main-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-header">
          <Logo />
          <button className="toggle-button" onClick={toggleSidebar}>
            {isSidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>

        <nav className="sidebar-nav">
          <ul>
            <li>
              <Link
                to="/"
                className={`sidebar-link ${isActive("/") ? "active" : ""}`}
              >
                <FaHome className="sidebar-icon" />
                <span className="sidebar-text">Dashboard</span>
              </Link>
            </li>
            <li>
              <Link
                to="/orders"
                className={`sidebar-link ${
                  isActive("/orders") ? "active" : ""
                }`}
              >
                <FaBoxOpen className="sidebar-icon" />
                <span className="sidebar-text">Pedidos</span>
              </Link>
            </li>
            <li>
              <Link
                to="/catalog"
                className={`sidebar-link ${
                  isActive("/catalog") ? "active" : ""
                }`}
              >
                <FaList className="sidebar-icon" />
                <span className="sidebar-text">Catálogo</span>
              </Link>
            </li>
            <li>
              <Link
                to="/messages"
                className={`sidebar-link ${
                  isActive("/messages") ? "active" : ""
                }`}
              >
                <FaComment className="sidebar-icon" />
                <span className="sidebar-text">Mensajes</span>
              </Link>
            </li>
          </ul>
        </nav>

        <div className="sidebar-footer">
          <ul>
            <li>
              <Link
                to="/profile"
                className={`sidebar-link ${
                  isActive("/profile") ? "active" : ""
                }`}
              >
                <FaUser className="sidebar-icon" />
                <span className="sidebar-text">Perfil</span>
              </Link>
            </li>
            {user && (user.role === "admin" || user.role === "root") && (
              <li>
                <Link
                  to="/settings"
                  className={`sidebar-link ${
                    isActive("/settings") ? "active" : ""
                  }`}
                >
                  <FaCog className="sidebar-icon" />
                  <span className="sidebar-text">Configuración</span>
                </Link>
              </li>
            )}
            <li>
              <button
                className="sidebar-link logout-button"
                onClick={handleLogout}
              >
                <FaSignOutAlt className="sidebar-icon" />
                <span className="sidebar-text">Cerrar Sesión</span>
              </button>
            </li>
          </ul>
        </div>
      </aside>

      {/* Contenido principal */}
      <main className={`main-content ${isSidebarOpen ? "" : "expanded"}`}>
        <div className="content-container">{children}</div>
      </main>
    </div>
  );
};

export default MainLayout;
