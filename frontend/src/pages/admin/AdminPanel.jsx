import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  Alert,
  LinearProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Tooltip,
  Badge,
} from "@mui/material";

import {
  MdPlayArrow as PlayIcon,
  MdStop as StopIcon,
  MdRefresh as RefreshIcon,
  MdSettingsSuggest as SettingsIcon,
  MdTimeline as TimelineIcon,
  MdBugReport as BugReportIcon,
  MdStorage as StorageIcon,
  MdCloudDone as CloudIcon,
  MdSchedule as ScheduleIcon,
  MdWarning as WarningIcon,
  MdCheckCircle as CheckCircleIcon,
  MdError as ErrorIcon,
  MdInfo as InfoIcon,
  MdExpandMore as ExpandMoreIcon,
  MdCode as CodeIcon,
  MdAssessment as AssessmentIcon,
} from "react-icons/md";

import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { productService } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { formatDate } from "../../utils/formatters";

const TabPanel = ({ children, value, index, ...other }) => (
  <div role="tabpanel" hidden={value !== index} {...other}>
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

export const AdminPanel = () => {
  const { isRoot } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();

  const [tabValue, setTabValue] = useState(0);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Verificar permisos
  if (!isRoot()) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Typography variant="h5" color="error">
          Acceso Denegado
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Solo los usuarios ROOT pueden acceder al panel de administración.
        </Typography>
      </Box>
    );
  }

  // API calls
  const {
    data: jobsStatus,
    loading: jobsLoading,
    refetch: refetchJobs,
  } = useApi(() => productService.getJobsStatus(), []);

  const { data: jobsInfo, refetch: refetchJobsInfo } = useApi(
    () => productService.getJobsInfo(),
    []
  );

  const { data: amazonConfig, refetch: refetchAmazonConfig } = useApi(
    () => productService.checkAmazonConfig(),
    []
  );

  const { data: availableEndpoints, refetch: refetchEndpoints } = useApi(
    () => productService.getAvailableEndpoints(),
    []
  );

  const { data: syncStatus, refetch: refetchSyncStatus } = useApi(
    () => productService.checkSyncNeeded(),
    []
  );

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refetchJobs();
      refetchJobsInfo();
      refetchSyncStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, refetchJobs, refetchJobsInfo, refetchSyncStatus]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleExecuteJob = async (jobName) => {
    setLoading(true);
    try {
      const result = await productService.executeJob(jobName);
      showSuccess(`Job ${jobName} ejecutado correctamente`);
      refetchJobs();
      refetchJobsInfo();
    } catch (error) {
      showError(
        error.response?.data?.message || `Error ejecutando job ${jobName}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTestOrders = async () => {
    setLoading(true);
    try {
      const result = await productService.getTestOrders();
      showInfo(`Se encontraron ${result.count} órdenes de prueba`);
    } catch (error) {
      showError(
        error.response?.data?.message || "Error obteniendo órdenes de prueba"
      );
    } finally {
      setLoading(false);
    }
  };

  const getJobStatusColor = (status) => {
    if (status.isActive) return "success";
    if (status.hasError) return "error";
    return "default";
  };

  const getJobStatusIcon = (status) => {
    if (status.isActive) return <CheckCircleIcon />;
    if (status.hasError) return <ErrorIcon />;
    return <InfoIcon />;
  };

  const getConfigStatusColor = (value) => {
    return value === "SET" ? "success" : "error";
  };

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Panel de Administración
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitoreo y administración avanzada del sistema
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
            }
            label="Auto-refresh"
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              refetchJobs();
              refetchJobsInfo();
              refetchAmazonConfig();
              refetchEndpoints();
              refetchSyncStatus();
            }}
          >
            Actualizar Todo
          </Button>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Jobs Programados" icon={<ScheduleIcon />} />
          <Tab label="Configuración Amazon" icon={<CloudIcon />} />
          <Tab label="Debug & Testing" icon={<BugReportIcon />} />
          <Tab label="Sistema" icon={<StorageIcon />} />
        </Tabs>
      </Box>

      {/* Tab 1: Jobs Programados */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          {/* Resumen de Jobs */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardHeader
                title="Estado General"
                action={
                  <IconButton onClick={refetchJobs} disabled={jobsLoading}>
                    <RefreshIcon />
                  </IconButton>
                }
              />
              <CardContent>
                {jobsInfo && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Tiempo del servidor: {jobsInfo.serverTimeLocal}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Zona horaria: {jobsInfo.timezone}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Entorno: {jobsInfo.environment}
                    </Typography>
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="h6" color="primary">
                        {jobsInfo.activeJobs} / {jobsInfo.totalJobs}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Jobs activos
                      </Typography>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Lista de Jobs */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardHeader title="Jobs Programados" />
              <CardContent>
                {jobsLoading ? (
                  <Box sx={{ textAlign: "center", py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <List>
                    {jobsStatus?.jobs &&
                      Object.entries(jobsStatus.jobs).map(
                        ([jobName, status]) => (
                          <ListItem
                            key={jobName}
                            divider
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-start",
                            }}
                          >
                            <ListItemText
                              primary={
                                <Box
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1,
                                  }}
                                >
                                  {getJobStatusIcon(status)}
                                  <Typography variant="subtitle1">
                                    {jobName}
                                  </Typography>
                                  <Chip
                                    label={
                                      status.isActive ? "Activo" : "Inactivo"
                                    }
                                    color={getJobStatusColor(status)}
                                    size="small"
                                  />
                                </Box>
                              }
                            />
                            <ListItemText
                              primary={
                                <Box>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {status.description}
                                  </Typography>
                                  {status.nextRunLocal && (
                                    <Typography
                                      variant="caption"
                                      display="block"
                                      color="text.secondary"
                                    >
                                      Próxima ejecución: {status.nextRunLocal}
                                    </Typography>
                                  )}
                                  {status.errorMessage && (
                                    <Typography
                                      variant="caption"
                                      display="block"
                                      color="error"
                                    >
                                      Error: {status.errorMessage}
                                    </Typography>
                                  )}
                                </Box>
                              }
                            />
                            <ListItemSecondaryAction>
                              <Button
                                size="small"
                                startIcon={<PlayIcon />}
                                onClick={() => handleExecuteJob(jobName)}
                                disabled={loading}
                              >
                                Ejecutar
                              </Button>
                            </ListItemSecondaryAction>
                          </ListItem>
                        )
                      )}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Tab 2: Configuración Amazon */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          {/* Estado de Configuración */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Configuración Amazon SP-API" />
              <CardContent>
                {amazonConfig && (
                  <Box>
                    <Alert
                      severity={
                        amazonConfig.allConfigured ? "success" : "error"
                      }
                      sx={{ mb: 2 }}
                    >
                      {amazonConfig.allConfigured
                        ? "Configuración completa y lista para usar"
                        : "Configuración incompleta - Revisar variables de entorno"}
                    </Alert>

                    <List>
                      {Object.entries(amazonConfig.config).map(
                        ([key, value]) => (
                          <ListItem key={key}>
                            <ListItemText
                              primary={key}
                              secondary={
                                key === "marketplaceId" ||
                                key === "sellerId" ||
                                key === "region"
                                  ? value
                                  : undefined
                              }
                            />
                            <ListItemSecondaryAction>
                              <Chip
                                label={value}
                                color={getConfigStatusColor(value)}
                                size="small"
                              />
                            </ListItemSecondaryAction>
                          </ListItem>
                        )
                      )}
                    </List>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Endpoints Disponibles */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader
                title="Endpoints Disponibles"
                action={
                  <IconButton onClick={refetchEndpoints}>
                    <RefreshIcon />
                  </IconButton>
                }
              />
              <CardContent>
                {availableEndpoints && (
                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      Total endpoints:{" "}
                      {Object.keys(availableEndpoints.endpoints).length}
                    </Typography>

                    <Box sx={{ maxHeight: 400, overflowY: "auto" }}>
                      {Object.entries(availableEndpoints.endpoints).map(
                        ([endpoint, config]) => (
                          <Accordion key={endpoint} size="small">
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                              <Typography component={"div"} variant="subtitle2">
                                {endpoint}
                              </Typography>
                              <Chip
                                label={config.version}
                                size="small"
                                sx={{ ml: 1 }}
                              />
                            </AccordionSummary>
                            <AccordionDetails>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                Operaciones disponibles:
                              </Typography>
                              <Box sx={{ mt: 1 }}>
                                {config.operations.map((op, index) => (
                                  <Chip
                                    key={index}
                                    label={op}
                                    size="small"
                                    variant="outlined"
                                    sx={{ mr: 1, mb: 1 }}
                                  />
                                ))}
                              </Box>
                            </AccordionDetails>
                          </Accordion>
                        )
                      )}
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Estado de Sincronización */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Estado de Sincronización" />
              <CardContent>
                {syncStatus && (
                  <Box>
                    <Alert
                      severity={
                        syncStatus.needsSync > 0 ? "warning" : "success"
                      }
                      sx={{ mb: 2 }}
                    >
                      {syncStatus.needsSync > 0
                        ? `${syncStatus.needsSync} productos necesitan sincronización`
                        : "Todos los productos están sincronizados"}
                    </Alert>

                    <Button
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      onClick={() => productService.syncProducts()}
                      disabled={loading}
                    >
                      Sincronizar Ahora
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Tab 3: Debug & Testing */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          {/* Herramientas de Testing */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Herramientas de Testing" />
              <CardContent>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<AssessmentIcon />}
                    onClick={handleTestOrders}
                    disabled={loading}
                  >
                    Probar Órdenes de Amazon
                  </Button>

                  <Button
                    variant="outlined"
                    startIcon={<CloudIcon />}
                    onClick={() => productService.syncProducts()}
                    disabled={loading}
                  >
                    Test Sincronización
                  </Button>

                  <Button
                    variant="outlined"
                    startIcon={<CodeIcon />}
                    onClick={refetchEndpoints}
                    disabled={loading}
                  >
                    Verificar Endpoints
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Logs del Sistema */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Logs del Sistema" />
              <CardContent>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Los logs están disponibles en el servidor en la carpeta /logs/
                </Alert>

                <List>
                  <ListItem>
                    <ListItemText
                      primary="Error Log"
                      secondary="Errores del sistema y aplicación"
                    />
                    <ListItemSecondaryAction>
                      <Chip label="error.log" size="small" />
                    </ListItemSecondaryAction>
                  </ListItem>

                  <ListItem>
                    <ListItemText
                      primary="Combined Log"
                      secondary="Todos los logs del sistema"
                    />
                    <ListItemSecondaryAction>
                      <Chip label="combined.log" size="small" />
                    </ListItemSecondaryAction>
                  </ListItem>

                  <ListItem>
                    <ListItemText
                      primary="Amazon Service Log"
                      secondary="Logs específicos de Amazon SP-API"
                    />
                    <ListItemSecondaryAction>
                      <Chip label="amazonService.log" size="small" />
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Herramientas de Debug */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="Información de Debug" />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Entorno
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {process.env.NODE_ENV || "development"}
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Tiempo de Actividad
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatDate(new Date())}
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Versión
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        v1.0.0
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Tab 4: Sistema */}
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={3}>
          {/* Información del Sistema */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Información del Sistema" />
              <CardContent>
                <List>
                  <ListItem>
                    <ListItemText
                      primary="Base de Datos"
                      secondary="MongoDB - Conectada"
                    />
                    <ListItemSecondaryAction>
                      <Chip label="Conectada" color="success" size="small" />
                    </ListItemSecondaryAction>
                  </ListItem>

                  <ListItem>
                    <ListItemText
                      primary="API Amazon"
                      secondary="SP-API - Estado según configuración"
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        label={
                          amazonConfig?.allConfigured
                            ? "Configurada"
                            : "Pendiente"
                        }
                        color={
                          amazonConfig?.allConfigured ? "success" : "warning"
                        }
                        size="small"
                      />
                    </ListItemSecondaryAction>
                  </ListItem>

                  <ListItem>
                    <ListItemText
                      primary="Scheduler"
                      secondary="Jobs programados - Activo"
                    />
                    <ListItemSecondaryAction>
                      <Chip label="Activo" color="success" size="small" />
                    </ListItemSecondaryAction>
                  </ListItem>

                  <ListItem>
                    <ListItemText
                      primary="Email Service"
                      secondary="Nodemailer - Configurado"
                    />
                    <ListItemSecondaryAction>
                      <Chip label="Configurado" color="success" size="small" />
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Monitoreo */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardHeader title="Monitoreo" />
              <CardContent>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Jobs Activos
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={
                      jobsInfo
                        ? (jobsInfo.activeJobs / jobsInfo.totalJobs) * 100
                        : 0
                    }
                    color="success"
                  />
                  <Typography variant="caption" color="text.secondary">
                    {jobsInfo?.activeJobs || 0} de {jobsInfo?.totalJobs || 0}{" "}
                    jobs activos
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Productos Sincronizados
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={
                      syncStatus ? (syncStatus.needsSync > 0 ? 70 : 100) : 0
                    }
                    color={syncStatus?.needsSync > 0 ? "warning" : "success"}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {syncStatus?.needsSync > 0
                      ? `${syncStatus.needsSync} pendientes`
                      : "Todos sincronizados"}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};
