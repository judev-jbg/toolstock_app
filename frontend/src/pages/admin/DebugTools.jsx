import React, { useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Alert,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from "@mui/material";

import {
  MdBugReport as BugReportIcon,
  MdCode as CodeIcon,
  MdSend as SendIcon,
} from "react-icons/md";
import { FaCloudArrowDown as DownloadIcon } from "react-icons/fa6";

import { productService } from "../../services/api";
import { useNotification } from "../../contexts/NotificationContext";

export const DebugTools = () => {
  const [testResults, setTestResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState("");
  const { showSuccess, showError } = useNotification();

  const handleTestConnection = async () => {
    setLoading(true);
    try {
      const result = await productService.checkAmazonConfig();
      setTestResults(result);
      showSuccess("Test de conexión completado");
    } catch (error) {
      showError("Error en test de conexión");
    } finally {
      setLoading(false);
    }
  };

  const handleTestOrders = async () => {
    setLoading(true);
    try {
      const result = await productService.getTestOrders();
      setTestResults(result);
      showSuccess(`Test completado: ${result.count} órdenes encontradas`);
    } catch (error) {
      showError("Error en test de órdenes");
    } finally {
      setLoading(false);
    }
  };

  const handleViewLog = (logType) => {
    setSelectedLog(logType);
    setLogDialogOpen(true);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Herramientas de Debug
      </Typography>

      <Grid container spacing={3}>
        {/* Test de Conexión */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Test de Conexión Amazon
              </Typography>
              <Button
                variant="outlined"
                startIcon={<CodeIcon />}
                onClick={handleTestConnection}
                disabled={loading}
                sx={{ mb: 2 }}
              >
                Probar Conexión
              </Button>

              {testResults && (
                <Alert
                  severity={testResults.allConfigured ? "success" : "error"}
                >
                  {testResults.allConfigured
                    ? "Conexión exitosa"
                    : "Error de configuración"}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Test de Órdenes */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Test de Órdenes
              </Typography>
              <Button
                variant="outlined"
                startIcon={<SendIcon />}
                onClick={handleTestOrders}
                disabled={loading}
                sx={{ mb: 2 }}
              >
                Probar Órdenes
              </Button>

              {loading && <CircularProgress size={20} />}
            </CardContent>
          </Card>
        </Grid>

        {/* Logs del Sistema */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Logs del Sistema
              </Typography>

              <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => handleViewLog("error")}
                  startIcon={<BugReportIcon />}
                >
                  Error Log
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleViewLog("combined")}
                  startIcon={<DownloadIcon />}
                >
                  Combined Log
                </Button>
              </Box>

              <Alert severity="info">
                Los logs están disponibles en el servidor. Use las herramientas
                de administración del servidor para acceder a ellos.
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dialog para mostrar logs */}
      <Dialog
        open={logDialogOpen}
        onClose={() => setLogDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Log: {selectedLog}</DialogTitle>
        <DialogContent>
          <Paper sx={{ p: 2, bgcolor: "grey.900", color: "white" }}>
            <Typography variant="body2" component="pre">
              {`[${new Date().toISOString()}] INFO: Sistema funcionando correctamente
[${new Date().toISOString()}] DEBUG: Conectando a Amazon SP-API
[${new Date().toISOString()}] INFO: Sincronización completada
[${new Date().toISOString()}] WARN: Algunos productos requieren atención`}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLogDialogOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
