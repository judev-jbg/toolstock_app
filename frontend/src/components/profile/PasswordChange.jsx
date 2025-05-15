// Archivo nuevo: frontend/src/components/profile/PasswordChange.jsx

import React, { useState } from "react";
import { FaLock, FaCheck, FaTimes } from "react-icons/fa";
import Input from "../common/Input";
import Button from "../common/Button";

const PasswordChange = ({ onChangePassword, loading }) => {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    message: "",
  });

  // Manejar cambios en el formulario
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Evaluar fortaleza de contraseña nueva
    if (name === "newPassword") {
      const score = calculatePasswordStrength(value);
      setPasswordStrength(score);
    }

    // Limpiar error
    setError("");
  };

  // Manejar envío del formulario
  const handleSubmit = (e) => {
    e.preventDefault();

    // Validación de contraseña
    if (formData.newPassword !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (formData.newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (passwordStrength.score < 2) {
      setError("La contraseña es demasiado débil");
      return;
    }

    // Enviar datos al padre
    onChangePassword(formData);
  };

  // Calcular fortaleza de contraseña
  const calculatePasswordStrength = (password) => {
    if (!password) {
      return { score: 0, message: "" };
    }

    let score = 0;
    let message = "";

    // Longitud mínima
    if (password.length >= 8) score++;

    // Caracteres especiales
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

    // Letras y números
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;

    // Mensaje según puntuación
    switch (score) {
      case 0:
      case 1:
        message = "Débil";
        break;
      case 2:
        message = "Moderada";
        break;
      case 3:
        message = "Fuerte";
        break;
      case 4:
        message = "Muy fuerte";
        break;
      default:
        message = "";
    }

    return { score, message };
  };

  // Renderizar indicador de fortaleza
  const renderStrengthIndicator = () => {
    if (!formData.newPassword) return null;

    const { score, message } = passwordStrength;
    const colors = ["#ff4d4f", "#ffa940", "#52c41a", "#1890ff"];
    const color = colors[Math.min(score, 3)];

    return (
      <div className="password-strength">
        <div className="strength-bars">
          {Array(4)
            .fill(0)
            .map((_, index) => (
              <div
                key={index}
                className="strength-bar"
                style={{
                  backgroundColor: index < score ? color : "#e8e8e8",
                  height: "4px",
                  flex: 1,
                  marginRight: index < 3 ? "4px" : 0,
                  borderRadius: "2px",
                }}
              />
            ))}
        </div>
        <span style={{ color, fontSize: "0.8rem", marginTop: "4px" }}>
          {message}
        </span>
      </div>
    );
  };

  return (
    <form className="password-change-form" onSubmit={handleSubmit}>
      <h3>Cambiar Contraseña</h3>

      {error && <div className="form-error">{error}</div>}

      <Input
        label="Contraseña actual"
        type="password"
        id="currentPassword"
        name="currentPassword"
        value={formData.currentPassword}
        onChange={handleChange}
        icon={<FaLock />}
        required
        fullWidth
      />

      <Input
        label="Nueva contraseña"
        type="password"
        id="newPassword"
        name="newPassword"
        value={formData.newPassword}
        onChange={handleChange}
        icon={<FaLock />}
        required
        fullWidth
      />

      {renderStrengthIndicator()}

      <Input
        label="Confirmar nueva contraseña"
        type="password"
        id="confirmPassword"
        name="confirmPassword"
        value={formData.confirmPassword}
        onChange={handleChange}
        icon={
          formData.confirmPassword &&
          (formData.confirmPassword === formData.newPassword ? (
            <FaCheck style={{ color: "green" }} />
          ) : (
            <FaTimes style={{ color: "red" }} />
          ))
        }
        required
        fullWidth
      />

      <Button type="submit" variant="primary" disabled={loading} fullWidth>
        {loading ? "Actualizando..." : "Cambiar Contraseña"}
      </Button>
    </form>
  );
};

export default PasswordChange;
