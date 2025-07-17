import React, { createContext, useContext, useState } from "react";
import {
  Snackbar,
  Alert,
  AlertTitle,
  Badge,
  IconButton,
  Menu,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Box,
  Typography,
  Divider,
  Button,
  Paper,
} from "@mui/material";

import {
  MdClose as CloseIcon,
  MdNotifications as NotificationsIcon,
  MdInfo as InfoIcon,
  MdWarning as WarningIcon,
  MdError as ErrorIcon,
  MdCheckCircle as SuccessIcon,
  MdClear as ClearIcon,
} from "react-icons/md";

import { formatDate } from "../utils/formatters";

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotification must be used within a NotificationProvider"
    );
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
    action: null,
  });

  const [notifications, setNotifications] = useState([]);
  const [notificationAnchor, setNotificationAnchor] = useState(null);

  // Generar ID único para notificaciones
  const generateId = () => Date.now() + Math.random();

  // Agregar notificación a la lista
  const addNotification = (notification) => {
    const newNotification = {
      id: generateId(),
      timestamp: new Date(),
      read: false,
      ...notification,
    };

    setNotifications((prev) => [newNotification, ...prev.slice(0, 49)]); // Máximo 50 notificaciones
    return newNotification.id;
  };

  // Mostrar snackbar
  const showSnackbar = (message, severity = "info", action = null) => {
    setSnackbar({
      open: true,
      message,
      severity,
      action,
    });

    // También agregar a la lista de notificaciones
    addNotification({
      type: "snackbar",
      message,
      severity,
      title: severity.charAt(0).toUpperCase() + severity.slice(1),
    });
  };

  const hideSnackbar = () => {
    setSnackbar((prev) => ({
      ...prev,
      open: false,
    }));
  };

  // Métodos de conveniencia
  const showSuccess = (message, action) =>
    showSnackbar(message, "success", action);
  const showError = (message, action) => showSnackbar(message, "error", action);
  const showWarning = (message, action) =>
    showSnackbar(message, "warning", action);
  const showInfo = (message, action) => showSnackbar(message, "info", action);

  // Notificaciones persistentes
  const showPersistentNotification = (
    title,
    message,
    severity = "info",
    actions = []
  ) => {
    return addNotification({
      type: "persistent",
      title,
      message,
      severity,
      actions,
      persistent: true,
    });
  };

  // Marcar notificación como leída
  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((notif) => (notif.id === id ? { ...notif, read: true } : notif))
    );
  };

  // Marcar todas como leídas
  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((notif) => ({ ...notif, read: true })));
  };

  // Eliminar notificación
  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((notif) => notif.id !== id));
  };

  // Limpiar todas las notificaciones
  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // Obtener conteo de no leídas
  const getUnreadCount = () => {
    return notifications.filter((notif) => !notif.read).length;
  };

  // Handlers para el menú
  const handleNotificationMenuOpen = (event) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleNotificationMenuClose = () => {
    setNotificationAnchor(null);
  };

  // Iconos por tipo de notificación
  const getNotificationIcon = (severity) => {
    switch (severity) {
      case "success":
        return <SuccessIcon color="success" />;
      case "error":
        return <ErrorIcon color="error" />;
      case "warning":
        return <WarningIcon color="warning" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  // Componente de centro de notificaciones
  const NotificationCenter = () => (
    <Menu
      anchorEl={notificationAnchor}
      open={Boolean(notificationAnchor)}
      onClose={handleNotificationMenuClose}
      PaperProps={{
        elevation: 0,
        sx: {
          overflow: "visible",
          filter: "drop-shadow(0px 2px 8px rgba(0,0,0,0.32))",
          mt: 1.5,
          minWidth: 350,
          maxWidth: 400,
          maxHeight: 500,
          left: "initial !important",
          right: 90,
          top: 64 + "px !important",
        },
      }}
      transformOrigin={{ horizontal: "right", vertical: "top" }}
      anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
    >
      <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: "divider" }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="subtitle1" fontWeight="bold">
            Notificaciones
          </Typography>
          <Box>
            <Button size="small" onClick={markAllAsRead}>
              Marcar todas
            </Button>
            <IconButton size="small" onClick={clearAllNotifications}>
              <ClearIcon />
            </IconButton>
          </Box>
        </Box>
      </Box>

      <Box sx={{ maxHeight: 400, overflowY: "auto" }}>
        {notifications.length === 0 ? (
          <Box sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              No hay notificaciones
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0 }}>
            {notifications.map((notification) => (
              <ListItem
                key={notification.id}
                sx={{
                  bgcolor: notification.read ? "transparent" : "action.hover",
                  borderBottom: 1,
                  borderColor: "divider",
                  cursor: "pointer",
                }}
                onClick={() => markAsRead(notification.id)}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {getNotificationIcon(notification.severity)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography
                      variant="subtitle2"
                      fontWeight={notification.read ? "normal" : "bold"}
                    >
                      {notification.title}
                    </Typography>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {notification.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(notification.timestamp)}
                      </Typography>
                    </Box>
                  }
                />
                {!notification.read && (
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: "primary.main",
                      ml: 1,
                    }}
                  />
                )}
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Menu>
  );

  // Botón de notificaciones para el header
  const NotificationButton = () => (
    <>
      <IconButton
        onClick={handleNotificationMenuOpen}
        sx={{
          color: "text.primary",
          "&:hover": {
            bgcolor: "action.hover",
          },
        }}
      >
        <Badge badgeContent={getUnreadCount()} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <NotificationCenter />
    </>
  );

  const value = {
    showSnackbar,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showPersistentNotification,
    notifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAllNotifications,
    NotificationButton,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={hideSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        action={
          <Box sx={{ display: "flex", gap: 1 }}>
            {snackbar.action}
            <IconButton size="small" color="inherit" onClick={hideSnackbar}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        }
      >
        <Alert
          onClose={hideSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </NotificationContext.Provider>
  );
};
