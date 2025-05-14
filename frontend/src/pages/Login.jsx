import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaUser, FaLock } from "react-icons/fa";
import { useAuth } from "../contexts/AuthContext";
import Input from "../components/common/Input";
import Button from "../components/common/Button";
import "./Login.css";

const Login = () => {
  const navigate = useNavigate();
  const { login, error, setError, user } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  useEffect(() => {
    if (error) {
      setLocalError(error);
    }
  }, [error]);

  // Manejar cambios en el formulario
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Limpiar error al modificar el formulario
    setLocalError(null);
    if (error) {
      setError(null);
    }
  };

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validación básica
    if (!formData.email || !formData.password) {
      setLocalError("Por favor completa todos los campos");
      return;
    }

    setLoading(true);

    try {
      const success = await login(formData.email, formData.password);

      if (success) {
        navigate("/");
      }
    } catch (error) {
      console.error("Error de inicio de sesión:", error);
      // setError(error.response?.data?.message || "Error al iniciar sesión");
      setLocalError(error.response?.data?.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img
            src="/public/img/logo.png"
            alt="Toolstock Logo"
            className="login-logo"
          />
          <h1>Iniciar Sesión</h1>
          <p>Accede a tu cuenta de Toolstock Manager</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {localError && <div className="login-error">{localError}</div>}

          <Input
            label="Correo electrónico"
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Introduce tu correo electrónico"
            required
            icon={<FaUser />}
            fullWidth
          />

          <Input
            label="Contraseña"
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Introduce tu contraseña"
            required
            icon={<FaLock />}
            fullWidth
          />

          <Button
            type="submit"
            variant="primary"
            size="large"
            fullWidth
            disabled={loading}
          >
            {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
