import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Container,
  Alert,
  InputAdornment,
  IconButton,
  CircularProgress,
} from "@mui/material";

import { MdEmail as EmailIcon } from "react-icons/md";
import {
  IoMdLock as LockIcon,
  IoMdEye as VisibilityIcon,
  IoMdEyeOff as VisibilityOffIcon,
} from "react-icons/io";

import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";

export const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { login, user, error, setError } = useAuth();
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  useEffect(() => {
    // Limpiar errores al desmontar
    return () => {
      setError(null);
    };
  }, [setError]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Limpiar error cuando el usuario empiece a escribir
    if (error) {
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      showError("Por favor, complete todos los campos");
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(formData.email, formData.password);

      if (result.success) {
        showSuccess("Inicio de sesión exitoso");
        navigate("/dashboard");
      } else {
        showError(result.error || "Error al iniciar sesión");
      }
    } catch (err) {
      showError("Error de conexión. Intente nuevamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          py: 4,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 4,
            width: "100%",
            maxWidth: 400,
            borderRadius: 3,
            border: 1,
            borderColor: "divider",
          }}
        >
          {/* Logo y título */}
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{
                fontWeight: 700,
                background:
                  "linear-gradient(45deg,rgb(116, 141, 252),rgb(85, 112, 233))",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Toolstock
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Inicia sesión para acceder al panel de administración
            </Typography>
          </Box>

          {/* Mensaje de error */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Formulario */}
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Correo electrónico"
              name="email"
              autoComplete="email"
              autoFocus
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Contraseña"
              type={showPassword ? "text" : "password"}
              id="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              disabled={isLoading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={handleTogglePasswordVisibility}
                      edge="end"
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <VisibilityOffIcon />
                      ) : (
                        <VisibilityIcon />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading}
              sx={{
                mt: 1,
                mb: 2,
                py: 1.5,
                color: "#f5f5f5",
                background:
                  "linear-gradient(45deg,rgb(113, 138, 250), #5164b8)",
                "&:hover": {
                  background:
                    "linear-gradient(45deg,rgb(91, 113, 211),rgb(58, 85, 204))",
                },
                "&:disabled": {
                  background: "action.disabledBackground",
                },
              }}
            >
              {isLoading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Iniciar sesión"
              )}
            </Button>
          </Box>

          {/* Footer */}
          <Box sx={{ textAlign: "center", mt: 3 }}>
            <Typography variant="caption" color="text.secondary">
              © 2024 Toolstock. Todos los derechos reservados.
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};
