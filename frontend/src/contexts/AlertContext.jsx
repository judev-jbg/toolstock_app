import React, { createContext, useContext, useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  AlertTitle,
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from "@mui/material";

import {
  MdWarning as WarningIcon,
  MdError as ErrorIcon,
  MdInfo as InfoIcon,
  MdCheckCircle as SuccessIcon,
} from "react-icons/md";

import { useNotification } from "./NotificationContext";
import { productService } from "../services/api";

const AlertContext = createContext();

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
};

export const AlertProvider = ({ children }) => {
  const [alerts, setAlerts] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);

  const { showPersistentNotification } = useNotification();

  // Verificar alertas del sistema cada 5 minutos
  useEffect(() => {
    const checkSystemAlerts = async () => {
      try {
        // Verificar productos que necesitan sincronización
        const syncStatus = await productService.checkSyncNeeded();
        if (syncStatus.needsSync > 0) {
          addSystemAlert({
            id: "sync-needed",
            type: "warning",
            title: "Productos sin sincronizar",
            message: `${syncStatus.needsSync} productos necesitan sincronización con Amazon`,
            action: "sync-products",
            priority: "medium",
          });
        } else {
          removeSystemAlert("sync-needed");
        }

        // Verificar configuración de Amazon
        const amazonConfig = await productService.checkAmazonConfig();
        if (!amazonConfig.allConfigured) {
          addSystemAlert({
            id: "amazon-config",
            type: "error",
            title: "Configuración Amazon incompleta",
            message: "La configuración de Amazon SP-API está incompleta",
            action: "configure-amazon",
            priority: "high",
          });
        } else {
          removeSystemAlert("amazon-config");
        }

        // Verificar estado de jobs (solo para root)
        const jobsStatus = await productService.getJobsStatus();
        const inactiveJobs = Object.entries(jobsStatus.jobs || {}).filter(
          ([_, status]) => !status.isActive
        );
        if (inactiveJobs.length > 0) {
          addSystemAlert({
            id: "inactive-jobs",
            type: "warning",
            title: "Jobs inactivos detectados",
            message: `${inactiveJobs.length} jobs programados están inactivos`,
            action: "check-jobs",
            priority: "medium",
          });
        } else {
          removeSystemAlert("inactive-jobs");
        }
      } catch (error) {
        console.error("Error checking system alerts:", error);
      }
    };

    checkSystemAlerts();
    const interval = setInterval(checkSystemAlerts, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, []);

  // Agregar alerta del sistema
  const addSystemAlert = (alert) => {
    setSystemAlerts((prev) => {
      const existing = prev.find((a) => a.id === alert.id);
      if (existing) {
        return prev.map((a) =>
          a.id === alert.id ? { ...a, ...alert, lastSeen: new Date() } : a
        );
      }
      return [
        ...prev,
        { ...alert, createdAt: new Date(), lastSeen: new Date() },
      ];
    });
  };

  // Remover alerta del sistema
  const removeSystemAlert = (alertId) => {
    setSystemAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  // Mostrar alerta personalizada
  const showAlert = (alert) => {
    setSelectedAlert(alert);
    setAlertDialogOpen(true);
  };

  // Mostrar alerta de confirmación
  const showConfirmation = (title, message, onConfirm, onCancel) => {
    setSelectedAlert({
      type: "confirmation",
      title,
      message,
      onConfirm,
      onCancel,
    });
    setAlertDialogOpen(true);
  };

  // Obtener alerta por severidad
  const getAlertsBySeverity = (severity) => {
    return systemAlerts.filter((alert) => alert.type === severity);
  };

  // Obtener total de alertas
  const getTotalAlerts = () => {
    return systemAlerts.length;
  };

  // Obtener alertas críticas
  const getCriticalAlerts = () => {
    return systemAlerts.filter((alert) => alert.priority === "high");
  };

  // Iconos por tipo de alerta
  const getAlertIcon = (type) => {
    switch (type) {
      case "error":
        return <ErrorIcon color="error" />;
      case "warning":
        return <WarningIcon color="warning" />;
      case "success":
        return <SuccessIcon color="success" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  // Colores por prioridad
  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "error";
      case "medium":
        return "warning";
      case "low":
        return "info";
      default:
        return "default";
    }
  };

  // Componente de lista de alertas
  const AlertsList = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Alertas del Sistema ({systemAlerts.length})
      </Typography>

      {systemAlerts.length === 0 ? (
        <Alert severity="success">
          <AlertTitle>Todo en orden</AlertTitle>
          No hay alertas del sistema en este momento.
        </Alert>
      ) : (
        <List>
          {systemAlerts.map((alert) => (
            <ListItem
              key={alert.id}
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
                mb: 1,
                bgcolor: "background.paper",
              }}
            >
              <ListItemIcon>{getAlertIcon(alert.type)}</ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="subtitle2">{alert.title}</Typography>
                    <Chip
                      label={alert.priority}
                      size="small"
                      color={getPriorityColor(alert.priority)}
                    />
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {alert.message}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Detectado: {alert.createdAt?.toLocaleString()}
                    </Typography>
                  </Box>
                }
              />
              <Button
                size="small"
                onClick={() => showAlert(alert)}
                color={alert.type === "error" ? "error" : "primary"}
              >
                Ver detalles
              </Button>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );

  // Dialog para mostrar alertas
  const AlertDialog = () => (
    <Dialog
      open={alertDialogOpen}
      onClose={() => setAlertDialogOpen(false)}
      maxWidth="sm"
      fullWidth
    >
      {selectedAlert && (
        <>
          <DialogTitle>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {getAlertIcon(selectedAlert.type)}
              <Typography variant="h6">{selectedAlert.title}</Typography>
            </Box>
          </DialogTitle>

          <DialogContent>
            <Alert severity={selectedAlert.type} sx={{ mb: 2 }}>
              {selectedAlert.message}
            </Alert>

            {selectedAlert.details && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {selectedAlert.details}
                </Typography>
              </Box>
            )}
          </DialogContent>

          <DialogActions>
            <Button
              onClick={() => {
                selectedAlert.onCancel?.();
                setAlertDialogOpen(false);
              }}
            >
              {selectedAlert.type === "confirmation" ? "Cancelar" : "Cerrar"}
            </Button>

            {selectedAlert.type === "confirmation" && (
              <Button
                onClick={() => {
                  selectedAlert.onConfirm?.();
                  setAlertDialogOpen(false);
                }}
                variant="contained"
                color="primary"
              >
                Confirmar
              </Button>
            )}

            {selectedAlert.action && selectedAlert.type !== "confirmation" && (
              <Button
                onClick={() => {
                  // Aquí puedes manejar las acciones específicas
                  switch (selectedAlert.action) {
                    case "sync-products":
                      // Navegar a catálogo
                      break;
                    case "configure-amazon":
                      // Navegar a configuración
                      break;
                    case "check-jobs":
                      // Navegar a admin panel
                      break;
                  }
                  setAlertDialogOpen(false);
                }}
                variant="contained"
                color="primary"
              >
                Resolver
              </Button>
            )}
          </DialogActions>
        </>
      )}
    </Dialog>
  );

  const value = {
    alerts,
    systemAlerts,
    showAlert,
    showConfirmation,
    getAlertsBySeverity,
    getTotalAlerts,
    getCriticalAlerts,
    addSystemAlert,
    removeSystemAlert,
    AlertsList,
  };

  return (
    <AlertContext.Provider value={value}>
      {children}
      <AlertDialog />
    </AlertContext.Provider>
  );
};
