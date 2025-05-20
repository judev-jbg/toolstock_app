import React, { useState, useEffect } from "react";
import { authService } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import ToastNotifier from "../components/common/ToastNotifier";
import {
  FaPlus,
  FaSearch,
  FaEdit,
  FaTrash,
  FaLock,
  FaUserAlt,
} from "react-icons/fa";
import "./Settings.css";
import UserFormModal from "../components/user/UserFormModal";
import ConfirmModal from "../components/common/ConfirmModal";

const Settings = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("active");
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState({ visible: false, message: "", type: "" });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState({ type: "", message: "" });

  // Cargar usuarios
  useEffect(() => {
    fetchUsers();
  }, [statusFilter]);

  // Función para cargar usuarios con filtros
  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Crear objeto de filtros
      const filters = {};

      // Aplicar filtro de estado
      if (statusFilter !== "all") {
        filters.status = statusFilter;
      }

      // Aplicar búsqueda si hay
      if (searchTerm.trim()) {
        filters.search = searchTerm.trim();
      }

      const data = await authService.getUsers(filters);
      setUsers(data.users);
    } catch (error) {
      console.error("Error al cargar usuarios:", error);
      showToastMessage("Error al cargar usuarios", "error");
    } finally {
      setLoading(false);
    }
  };

  // Función para mostrar toast
  const showToastMessage = (message, type) => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast({ visible: false, message: "", type: "" });
    }, 3000);
  };

  // Manejar cambio de filtro
  const handleFilterChange = (filter) => {
    setStatusFilter(filter);
  };

  // Manejar búsqueda
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    // Implementar búsqueda debounced
    const timeoutId = setTimeout(() => {
      fetchUsers();
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  // Abrir modal de creación
  const handleCreateUser = () => {
    setShowCreateModal(true);
  };

  // Abrir modal de edición
  const handleEditUser = (user) => {
    setCurrentUser(user);
    setShowEditModal(true);
  };

  // Manejar creación de usuario
  const handleCreateUserSubmit = async (userData) => {
    try {
      setLoading(true);
      await authService.createUser(userData);
      showToastMessage(
        "Usuario creado correctamente. Se ha enviado un correo de activación.",
        "success"
      );
      setShowCreateModal(false);
      fetchUsers(); // Recargar la lista
    } catch (error) {
      console.error("Error al crear usuario:", error);
      throw error; // Re-lanzar para que el formulario lo maneje
    } finally {
      setLoading(false);
    }
  };
  // Manejar edición de usuario
  const handleEditUserSubmit = async (userData) => {
    try {
      setLoading(true);
      await authService.updateUser(currentUser._id, userData);
      showToastMessage("Usuario actualizado correctamente", "success");
      setShowEditModal(false);
      fetchUsers(); // Recargar la lista
    } catch (error) {
      console.error("Error al actualizar usuario:", error);
      throw error; // Re-lanzar para que el formulario lo maneje
    } finally {
      setLoading(false);
    }
  };

  // Confirmar toggle de estado
  const handleToggleUserStatus = (user) => {
    setCurrentUser(user);
    setConfirmAction({
      type: "toggle-status",
      message: `¿Estás seguro de que deseas ${
        user.active ? "desactivar" : "activar"
      } al usuario ${user.name}?`,
    });
    setShowConfirmModal(true);
  };

  // Confirmar reseteo de contraseña
  const handleResetPassword = (user) => {
    setCurrentUser(user);
    setConfirmAction({
      type: "reset-password",
      message: `¿Estás seguro de que deseas enviar un correo de reseteo de contraseña a ${user.name}?`,
    });
    setShowConfirmModal(true);
  };

  // Ejecutar acción confirmada
  const executeConfirmedAction = async () => {
    setShowConfirmModal(false);

    if (!currentUser) return;

    try {
      switch (confirmAction.type) {
        case "toggle-status": {
          const toggleResult = await authService.toggleUserStatus(
            currentUser._id
          );
          showToastMessage(toggleResult.message, "success");
          break;
        }
        case "reset-password": {
          const resetResult = await authService.resetUserPassword(
            currentUser._id
          );
          showToastMessage(resetResult.message, "success");
          break;
        }
        default:
          break;
      }

      // Recargar datos
      fetchUsers();
    } catch (error) {
      console.error(`Error ejecutando acción ${confirmAction.type}:`, error);
      showToastMessage(
        error.response?.data?.message || "Error al ejecutar la acción",
        "error"
      );
    }
  };

  // Renderizar tabla de usuarios
  const renderUsersTable = () => {
    if (loading) {
      return <div className="loading-indicator">Cargando usuarios...</div>;
    }

    if (users.length === 0) {
      return <div className="empty-state">No se encontraron usuarios</div>;
    }

    return (
      <div className="table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`role-chip ${u.role}`}>
                    {u.role === "root"
                      ? "Super Admin"
                      : u.role === "admin"
                      ? "Administrador"
                      : "Usuario"}
                  </span>
                </td>
                <td>
                  <span
                    className={`status-chip ${
                      u.active ? "active" : "inactive"
                    }`}
                  >
                    {u.active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="actions-cell">
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => handleEditUser(u)}
                    icon={<FaEdit />}
                    aria-label="Editar"
                  />

                  <Button
                    variant="text"
                    size="small"
                    onClick={() => handleToggleUserStatus(u)}
                    icon={u.active ? <FaTrash /> : <FaUserAlt />}
                    aria-label={u.active ? "Desactivar" : "Activar"}
                  />

                  {/* Solo root puede resetear contraseñas */}
                  {user.role === "root" && (
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => handleResetPassword(u)}
                      icon={<FaLock />}
                      aria-label="Resetear contraseña"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1 className="page-title">Configuración de Usuarios</h1>
        <Button
          variant="fab"
          onClick={handleCreateUser}
          icon={<FaPlus />}
        ></Button>
      </div>

      <div className="filters-row">
        <div className="status-filters">
          <button
            className={`filter-chip ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => handleFilterChange("all")}
          >
            Todos
          </button>
          <button
            className={`filter-chip ${
              statusFilter === "active" ? "active" : ""
            }`}
            onClick={() => handleFilterChange("active")}
          >
            Activos
          </button>
          <button
            className={`filter-chip ${
              statusFilter === "inactive" ? "active" : ""
            }`}
            onClick={() => handleFilterChange("inactive")}
          >
            Inactivos
          </button>
        </div>

        <div className="search-container">
          <Input
            label="Buscar por nombre o email"
            value={searchTerm}
            onChange={handleSearch}
            icon={<FaSearch />}
          />
        </div>
      </div>

      {renderUsersTable()}

      {/* Modales de creación, edición y confirmación */}
      {showCreateModal && (
        <UserFormModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateUserSubmit}
          title="Crear Usuario"
          currentUserRole={user.role}
        />
      )}

      {showEditModal && currentUser && (
        <UserFormModal
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditUserSubmit}
          user={currentUser}
          title="Editar Usuario"
          currentUserRole={user.role}
        />
      )}

      {showConfirmModal && (
        <ConfirmModal
          message={confirmAction.message}
          onConfirm={executeConfirmedAction}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}

      {toast.visible && (
        <ToastNotifier message={toast.message} type={toast.type} />
      )}
    </div>
  );
};

export default Settings;
