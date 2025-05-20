// frontend/src/components/user/UserFormModal.jsx
import React, { useState } from "react";
import { FaUser, FaEnvelope, FaIdBadge } from "react-icons/fa";
import Button from "../common/Button";
import Input from "../common/Input";
import "./UserFormModal.css";

const UserFormModal = ({
  onClose,
  onSubmit,
  user = null,
  title,
  currentUserRole,
}) => {
  const [formData, setFormData] = useState({
    name: user ? user.name : "",
    email: user ? user.email : "",
    role: user ? user.role : "guest",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Manejar cambios en el formulario
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Limpiar errores
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  // Validar formulario
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "El nombre es obligatorio";
    }

    if (!formData.email.trim()) {
      newErrors.email = "El email es obligatorio";
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      newErrors.email = "El email no es válido";
    }

    if (!formData.role) {
      newErrors.role = "El rol es obligatorio";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error("Error al enviar formulario:", error);
      if (error.response?.data?.errors) {
        // Formatear errores de API
        const apiErrors = {};
        error.response.data.errors.forEach((err) => {
          apiErrors[err.param] = err.msg;
        });
        setErrors(apiErrors);
      } else {
        setErrors({
          form:
            error.response?.data?.message || "Error al procesar la solicitud",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="user-form" onSubmit={handleSubmit}>
          {errors.form && <div className="form-error">{errors.form}</div>}

          <Input
            label="Nombre"
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            error={errors.name}
            icon={<FaUser />}
            required
            fullWidth
          />

          <Input
            label="Email"
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            icon={<FaEnvelope />}
            required
            fullWidth
            disabled={user !== null} // Solo se puede editar en creación
          />

          <div className="form-group">
            <label htmlFor="role" className="select-label">
              <FaIdBadge className="select-icon" />
              Rol
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className={`role-select ${errors.role ? "has-error" : ""}`}
              disabled={user?.role === "root" && currentUserRole !== "root"}
            >
              <option value="guest">Usuario</option>
              <option value="admin">Administrador</option>
              {/* Solo root puede asignar rol root */}
              {currentUserRole === "root" && (
                <option value="root">Super Administrador</option>
              )}
            </select>
            {errors.role && <div className="input-error">{errors.role}</div>}
          </div>

          <div className="modal-actions">
            <Button
              type="button"
              variant="outlined"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="filled" disabled={loading}>
              {loading ? "Guardando..." : user ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserFormModal;
