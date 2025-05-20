// frontend/src/pages/ResetPassword.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaLock, FaCheck, FaTimes } from "react-icons/fa";
import { authService } from "../services/api";
import Input from "../components/common/Input";
import Button from "../components/common/Button";
import ToastNotifier from "../components/common/ToastNotifier";
import "./ResetPassword.css";

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [validToken, setValidToken] = useState(false);
  const [userInfo, setUserInfo] = useState({ name: "", email: "" });
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    message: "",
  });
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ visible: false, message: "", type: "" });

  // Verificar token al cargar
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const response = await authService.verifyResetToken(token);

        if (response.valid) {
          setValidToken(true);
          setUserInfo({
            name: response.name || "",
            email: response.email || "",
          });
        } else {
          setValidToken(false);
          setError("El enlace ha expirado o no es válido");
        }
      } catch (error) {
        console.error("Error verificando token:", error);
        setValidToken(false);
        setError("Error al verificar el enlace");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      verifyToken();
    } else {
      setLoading(false);
      setValidToken(false);
      setError("Enlace inválido");
    }
  }, [token]);

  // Manejar cambios en el formulario
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Evaluar fortaleza de contraseña
    if (name === "password") {
      const score = calculatePasswordStrength(value);
      setPasswordStrength(score);
    }

    // Limpiar error
    setError("");
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
    if (!formData.password) return null;

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

  // Manejar envío de formulario
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validación
    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (passwordStrength.score < 2) {
      setError("La contraseña es demasiado débil");
      return;
    }

    setLoading(true);

    try {
      await authService.resetPassword(token, { password: formData.password });

      // Mostrar mensaje de éxito
      setToast({
        visible: true,
        message: "Contraseña actualizada correctamente",
        type: "success",
      });

      // Redirigir a login después de 2 segundos
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      console.error("Error al resetear contraseña:", error);
      setError(
        error.response?.data?.message || "Error al actualizar contraseña"
      );
    } finally {
      setLoading(false);
    }
  };

  // Mostrar spinner mientras carga
  if (loading) {
    return (
      <div className="reset-password-container">
        <div className="reset-password-card loading">
          <div className="loading-spinner"></div>
          <p>Verificando enlace...</p>
        </div>
      </div>
    );
  }

  // Mostrar error si el token no es válido
  if (!validToken) {
    return (
      <div className="reset-password-container">
        <div className="reset-password-card error">
          <h2>Enlace inválido</h2>
          <p>{error}</p>
          <Button variant="outlined" onClick={() => navigate("/login")}>
            Volver al inicio de sesión
          </Button>
        </div>
      </div>
    );
  }

  // Formulario para resetear contraseña
  return (
    <div className="reset-password-container">
      <div className="reset-password-card">
        <h2>Establece tu contraseña</h2>
        <p className="user-info">
          <strong>{userInfo.name}</strong>
          <span className="user-email">{userInfo.email}</span>
        </p>

        <form className="reset-password-form" onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <Input
            label="Nueva contraseña"
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            icon={<FaLock />}
            required
            fullWidth
          />

          {renderStrengthIndicator()}

          <Input
            label="Confirmar contraseña"
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            icon={
              formData.confirmPassword &&
              (formData.confirmPassword === formData.password ? (
                <FaCheck style={{ color: "green" }} />
              ) : (
                <FaTimes style={{ color: "red" }} />
              ))
            }
            required
            fullWidth
          />

          <Button type="submit" variant="filled" fullWidth disabled={loading}>
            {loading ? "Guardando..." : "Establecer contraseña"}
          </Button>
        </form>
      </div>

      {toast.visible && (
        <ToastNotifier message={toast.message} type={toast.type} />
      )}
    </div>
  );
};

export default ResetPassword;
