// Actualizar src/pages/Profile.jsx
import React, { useState, useEffect } from "react";
import { FaUser, FaEnvelope, FaIdBadge } from "react-icons/fa";
import { useAuth } from "../contexts/AuthContext";
import Input from "../components/common/Input";
import Button from "../components/common/Button";
import PasswordChange from "../components/profile/PasswordChange";
import AvatarUpload from "../components/profile/AvatarUpload";
import ToastNotifier from "../components/common/ToastNotifier";
import { authService } from "../services/api";
import "./Profile.css";

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "",
  });
  const [initialFormData, setInitialFormData] = useState({});
  const [toast, setToast] = useState({ visible: false, message: "", type: "" });
  const [passwordChangeMode, setPasswordChangeMode] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);

  // Cargar datos del usuario
  useEffect(() => {
    if (user) {
      const userData = {
        name: user.name || "",
        email: user.email || "",
        role: user.role || "",
      };
      setFormData(userData);
      setInitialFormData(userData);
    }
  }, [user]);

  // Verificar si hay cambios en el formulario
  const hasChanges = () => {
    return formData.name !== initialFormData.name || avatarFile !== null;
  };

  // Mostrar notificación toast
  const showToast = (message, type) => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast({ visible: false, message: "", type: "" });
    }, 3000);
  };

  // Manejar cambios en el formulario
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Solo actualizar si hay cambios
      if (!hasChanges()) {
        showToast("No hay cambios para guardar", "info");
        setLoading(false);
        return;
      }

      // Actualizar perfil
      const formDataToSend = {
        name: formData.name,
      };

      if (avatarFile) {
        // Crear FormData para subir avatar
        const avatarFormData = new FormData();
        avatarFormData.append("avatar", avatarFile);

        // Subir avatar
        try {
          const avatarResponse = await authService.updateAvatar(avatarFormData);
          formDataToSend.avatar = avatarResponse.avatar;
        } catch (error) {
          console.error("Error al subir avatar:", error);
          showToast("Error al subir avatar", "error");
          setLoading(false);
          return;
        }
      }

      const result = await updateProfile(formDataToSend);

      if (result.success) {
        showToast("Perfil actualizado correctamente", "success");
        // Actualizar datos iniciales para reflejar los cambios
        setInitialFormData({
          ...initialFormData,
          name: formData.name,
        });
      } else {
        showToast(result.error || "Error al actualizar perfil", "error");
      }
    } catch (error) {
      console.error("Error al actualizar perfil:", error);
      showToast("Error al actualizar perfil", "error");
    } finally {
      setLoading(false);
      setAvatarFile(null);
    }
  };

  // Manejar cambio de contraseña
  const handlePasswordChange = async (passwordData) => {
    setLoading(true);

    try {
      const result = await updateProfile({
        currentPassword: passwordData.currentPassword,
        password: passwordData.newPassword,
      });

      if (result.success) {
        showToast("Contraseña actualizada correctamente", "success");
        setPasswordChangeMode(false);
      } else {
        showToast(result.error || "Error al actualizar contraseña", "error");
      }
    } catch (error) {
      console.error("Error al cambiar contraseña:", error);
      showToast("Error al cambiar contraseña", "error");
    } finally {
      setLoading(false);
    }
  };

  // Manejar cambio de avatar
  const handleAvatarChange = (file) => {
    setAvatarFile(file);
  };

  // Mapear roles a nombres más amigables
  const getRoleName = (role) => {
    const roles = {
      guest: "Usuario",
      admin: "Administrador",
      root: "Super Administrador",
    };
    return roles[role] || role;
  };

  if (!user) {
    return <div className="loading">Cargando perfil...</div>;
  }

  return (
    <div className="profile-container">
      <h1 className="page-title">Mi Perfil</h1>

      <div className="profile-content">
        <div className="profile-sidebar">
          <AvatarUpload
            currentAvatar={user.avatar}
            onAvatarChange={handleAvatarChange}
            loading={loading}
          />

          <div className="profile-actions">
            <Button
              variant={passwordChangeMode ? "outline" : "primary"}
              onClick={() => setPasswordChangeMode(false)}
              fullWidth
            >
              Editar Perfil
            </Button>
            <Button
              variant={passwordChangeMode ? "primary" : "outline"}
              onClick={() => setPasswordChangeMode(true)}
              fullWidth
            >
              Cambiar Contraseña
            </Button>
          </div>
        </div>

        <div className="profile-main">
          {passwordChangeMode ? (
            <PasswordChange
              onChangePassword={handlePasswordChange}
              loading={loading}
            />
          ) : (
            <form className="profile-form" onSubmit={handleSubmit}>
              <h3>Información Personal</h3>

              <Input
                label="Nombre"
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                icon={<FaUser />}
                required
                fullWidth
              />

              <Input
                label="Correo electrónico"
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                icon={<FaEnvelope />}
                required
                fullWidth
                disabled={true}
              />

              <Input
                label="Rol en la aplicación"
                type="text"
                id="role"
                name="role"
                value={getRoleName(formData.role)}
                icon={<FaIdBadge />}
                fullWidth
                disabled={true}
              />

              <Button
                type="submit"
                variant="primary"
                disabled={loading || !hasChanges()}
              >
                {loading ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </form>
          )}
        </div>
      </div>

      {toast.visible && (
        <ToastNotifier message={toast.message} type={toast.type} />
      )}
    </div>
  );
};

export default Profile;
