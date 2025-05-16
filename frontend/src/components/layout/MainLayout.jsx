import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  MdOutlineDashboard,
  MdDashboard,
  MdOutlineShoppingBasket,
  MdShoppingBasket,
  MdInventory2,
  MdOutlineInventory2,
  MdMessage,
  MdOutlineMessage,
  MdManageAccounts,
  MdOutlineManageAccounts,
  MdSettingsSuggest,
  MdOutlineSettingsSuggest,
  MdOutlineLogout,
  MdMenu,
} from "react-icons/md";
import { TbMenu3 } from "react-icons/tb";
import { useAuth } from "../../contexts/AuthContext";
import Logo from "../common/Logo";
import Button from "../common/Button";
import "./MainLayout.css";

const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Función para verificar la ruta activa
  const isActive = (path) => {
    return location.pathname === path;
  };

  // Manejar cierre de sesión
  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    logout();
    navigate("/login");
    setShowLogoutConfirm(false);
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
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
            {isSidebarOpen ? <TbMenu3 /> : <MdMenu />}
          </button>
        </div>

        <nav className="sidebar-nav">
          <ul>
            <li>
              <Link
                to="/"
                className={`sidebar-link ${isActive("/") ? "active" : ""}`}
              >
                {isActive("/") ? (
                  <MdDashboard className="sidebar-icon" />
                ) : (
                  <MdOutlineDashboard className="sidebar-icon" />
                )}

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
                {isActive("/orders") ? (
                  <MdShoppingBasket className="sidebar-icon" />
                ) : (
                  <MdOutlineShoppingBasket className="sidebar-icon" />
                )}

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
                {isActive("/catalog") ? (
                  <MdInventory2 className="sidebar-icon" />
                ) : (
                  <MdOutlineInventory2 className="sidebar-icon" />
                )}

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
                {isActive("/messages") ? (
                  <MdMessage className="sidebar-icon" />
                ) : (
                  <MdOutlineMessage className="sidebar-icon" />
                )}

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
                {isActive("/profile") ? (
                  <MdManageAccounts className="sidebar-icon" />
                ) : (
                  <MdOutlineManageAccounts className="sidebar-icon" />
                )}

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
                  {isActive("/settings") ? (
                    <MdSettingsSuggest className="sidebar-icon" />
                  ) : (
                    <MdOutlineSettingsSuggest className="sidebar-icon" />
                  )}

                  <span className="sidebar-text">Configuración</span>
                </Link>
              </li>
            )}
            <li>
              <button
                className="sidebar-link logout-button"
                onClick={handleLogoutClick}
              >
                <MdOutlineLogout className="sidebar-icon" />
                <span className="sidebar-text">Cerrar Sesión</span>
              </button>
              {showLogoutConfirm && (
                <div className="logout-confirm-overlay">
                  <div className="logout-confirm-dialog">
                    <h3>Cerrar Sesión</h3>
                    <p>¿Estás seguro que deseas cerrar sesión?</p>
                    <div className="logout-confirm-actions">
                      <Button variant="outline" onClick={cancelLogout}>
                        Cancelar
                      </Button>
                      <Button variant="danger" onClick={confirmLogout}>
                        Cerrar Sesión
                      </Button>
                    </div>
                  </div>
                </div>
              )}
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
