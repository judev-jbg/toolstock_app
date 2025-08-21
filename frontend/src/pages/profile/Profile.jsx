import React, { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Avatar,
  Grid,
  Divider,
  IconButton,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  MdOutlineEdit as EditIcon,
  MdCancel as CancelIcon,
  MdVideoCameraFront as PhotoCameraIcon,
} from "react-icons/md";
import { FaCloudArrowUp as SaveIcon } from "react-icons/fa6";

import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { authService } from "../../services/api";
const baseURL = "http://localhost:4000/uploads/avatars";

export const Profile = () => {
  const { user, updateProfile } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    currentPassword: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditToggle = () => {
    if (isEditing) {
      setFormData({
        name: user?.name || "",
        email: user?.email || "",
        currentPassword: "",
        password: "",
        confirmPassword: "",
      });
    }
    setIsEditing(!isEditing);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password && formData.password !== formData.confirmPassword) {
      showError("Las contraseñas no coinciden");
      return;
    }

    if (formData.password && !formData.currentPassword) {
      showError("Debe proporcionar la contraseña actual para cambiarla");
      return;
    }

    setIsLoading(true);

    try {
      const updateData = {
        name: formData.name,
      };

      if (formData.password) {
        updateData.currentPassword = formData.currentPassword;
        updateData.password = formData.password;
      }

      const result = await updateProfile(updateData);

      if (result.success) {
        showSuccess("Perfil actualizado correctamente");
        setIsEditing(false);
        setFormData((prev) => ({
          ...prev,
          currentPassword: "",
          password: "",
          confirmPassword: "",
        }));
      } else {
        showError(result.error || "Error al actualizar el perfil");
      }
    } catch (error) {
      showError("Error al actualizar el perfil");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith("image/")) {
      showError("Solo se permiten archivos de imagen");
      return;
    }

    // Validar tamaño (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
      showError("El archivo debe ser menor a 5MB");
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      await authService.updateAvatar(formData);

      // Refrescar la página para mostrar el nuevo avatar
      window.location.reload();

      showSuccess("Avatar actualizado correctamente");
    } catch (error) {
      showError("Error al actualizar el avatar");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Mi Perfil
      </Typography>

      <Grid container spacing={3}>
        {/* Información del perfil */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: "center" }}>
              <Box
                sx={{ position: "relative", display: "inline-block", mb: 2 }}
              >
                <Avatar
                  sx={{
                    width: 120,
                    height: 120,
                    bgcolor: "primary.main",
                    fontSize: "2rem",
                  }}
                  src={user?.avatar ? `${baseURL}/${user.avatar}` : undefined}
                >
                  {user?.name?.charAt(0).toUpperCase()}
                </Avatar>

                <IconButton
                  component="label"
                  sx={{
                    position: "absolute",
                    bottom: -4,
                    right: -4,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    "&:hover": {
                      bgcolor: "primary.dark",
                    },
                  }}
                  disabled={isLoading}
                >
                  <PhotoCameraIcon />
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleAvatarUpload}
                  />
                </IconButton>
              </Box>

              <Typography variant="h6" gutterBottom>
                {user?.name}
              </Typography>

              <Typography variant="body2" color="text.secondary" gutterBottom>
                {user?.email}
              </Typography>

              <Box
                sx={{
                  display: "inline-block",
                  px: 2,
                  py: 0.5,
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  borderRadius: 1,
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  textTransform: "uppercase",
                }}
              >
                {user?.role}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Formulario de edición */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 3,
              }}
            >
              <Typography variant="h6">Información Personal</Typography>

              <Box>
                {isEditing ? (
                  <>
                    <Button
                      onClick={handleEditToggle}
                      startIcon={<CancelIcon />}
                      sx={{ mr: 1 }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      variant="contained"
                      startIcon={
                        isLoading ? (
                          <CircularProgress size={20} />
                        ) : (
                          <SaveIcon />
                        )
                      }
                      disabled={isLoading}
                    >
                      Guardar
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleEditToggle}
                    startIcon={<EditIcon />}
                    variant="outlined"
                  >
                    Editar
                  </Button>
                )}
              </Box>
            </Box>

            <Divider sx={{ mb: 3 }} />

            <Box component="form" onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Nombre"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={!isEditing || isLoading}
                    required
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Correo electrónico"
                    name="email"
                    value={formData.email}
                    disabled={true}
                    helperText="El correo electrónico no se puede modificar"
                  />
                </Grid>

                {isEditing && (
                  <>
                    <Grid item xs={12}>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        Para cambiar tu contraseña, completa los siguientes
                        campos. Si no deseas cambiarla, déjalos en blanco.
                      </Alert>
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Contraseña actual"
                        name="currentPassword"
                        type="password"
                        value={formData.currentPassword}
                        onChange={handleChange}
                        disabled={isLoading}
                      />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Nueva contraseña"
                        name="password"
                        type="password"
                        value={formData.password}
                        onChange={handleChange}
                        disabled={isLoading}
                      />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Confirmar nueva contraseña"
                        name="confirmPassword"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        disabled={isLoading}
                      />
                    </Grid>
                  </>
                )}
              </Grid>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};
