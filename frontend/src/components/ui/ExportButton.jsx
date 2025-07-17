import React, { useState } from "react";
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  TextField,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Alert,
  CircularProgress,
} from "@mui/material";

import { FaCloudArrowDown as DownloadIcon } from "react-icons/fa6";
import { RiFileExcel2Fill as ExcelIcon } from "react-icons/ri";
import { FaFileCsv as CsvIcon, FaFilePdf as PdfIcon } from "react-icons/fa";
import { VscJson as JsonIcon } from "react-icons/vsc";

import { useNotification } from "../../contexts/NotificationContext";
import {
  exportToExcel,
  exportToCSV,
  exportToJSON,
  exportToPDF,
  formatDataForExport,
  formatUsersForExport,
} from "../../utils/exportUtils";

export const ExportButton = ({
  data = [],
  filename = "export",
  dataType = "products",
  disabled = false,
  variant = "outlined",
  size = "medium",
  ...props
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState("excel");
  const [exportOptions, setExportOptions] = useState({
    includeImages: false,
    includeMetadata: true,
    dateRange: "all",
    customFilename: "",
  });
  const [loading, setLoading] = useState(false);

  const { showSuccess, showError } = useNotification();

  const exportFormats = [
    {
      key: "excel",
      label: "Excel (.xlsx)",
      icon: <ExcelIcon />,
      description: "Archivo Excel compatible con Microsoft Office",
    },
    {
      key: "csv",
      label: "CSV (.csv)",
      icon: <CsvIcon />,
      description: "Archivo de valores separados por comas",
    },
    {
      key: "json",
      label: "JSON (.json)",
      icon: <JsonIcon />,
      description: "Formato de intercambio de datos JSON",
    },
    {
      key: "pdf",
      label: "PDF (.pdf)",
      icon: <PdfIcon />,
      description: "Documento PDF para impresión",
    },
  ];

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleQuickExport = async (format) => {
    handleMenuClose();
    await performExport(format, filename);
  };

  const handleAdvancedExport = () => {
    handleMenuClose();
    setExportDialogOpen(true);
  };

  const performExport = async (format, customFilename) => {
    if (!data || data.length === 0) {
      showError("No hay datos para exportar");
      return;
    }

    setLoading(true);

    try {
      // Formatear datos según el tipo
      let formattedData;
      switch (dataType) {
        case "users":
          formattedData = formatUsersForExport(data);
          break;
        case "products":
        default:
          formattedData = formatDataForExport(data);
          break;
      }

      // Filtrar datos si hay opciones específicas
      if (exportOptions.dateRange !== "all") {
        // Implementar filtrado por fecha si es necesario
      }

      const finalFilename =
        customFilename ||
        `${filename}_${new Date().toISOString().split("T")[0]}`;
      let success = false;

      switch (format) {
        case "excel":
          success = exportToExcel(formattedData, finalFilename, dataType);
          break;
        case "csv":
          success = exportToCSV(formattedData, finalFilename);
          break;
        case "json":
          success = exportToJSON(formattedData, finalFilename);
          break;
        case "pdf":
          success = await exportToPDF(
            formattedData,
            finalFilename,
            `Reporte de ${dataType}`
          );
          break;
        default:
          throw new Error("Formato no soportado");
      }

      if (success) {
        showSuccess(`Archivo ${format.toUpperCase()} exportado correctamente`);
      } else {
        showError(`Error al exportar archivo ${format.toUpperCase()}`);
      }
    } catch (error) {
      console.error("Export error:", error);
      showError(`Error durante la exportación: ${error.message}`);
    } finally {
      setLoading(false);
      setExportDialogOpen(false);
    }
  };

  const handleAdvancedExportSubmit = async () => {
    const customFilename = exportOptions.customFilename.trim() || filename;
    await performExport(selectedFormat, customFilename);
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        startIcon={loading ? <CircularProgress size={16} /> : <DownloadIcon />}
        onClick={handleMenuOpen}
        disabled={disabled || loading || !data || data.length === 0}
        {...props}
      >
        Exportar
      </Button>

      {/* Menú rápido */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {exportFormats.map((format) => (
          <MenuItem
            key={format.key}
            onClick={() => handleQuickExport(format.key)}
          >
            <ListItemIcon>{format.icon}</ListItemIcon>
            <ListItemText>{format.label}</ListItemText>
          </MenuItem>
        ))}
        <MenuItem onClick={handleAdvancedExport}>
          <ListItemIcon>
            <DownloadIcon />
          </ListItemIcon>
          <ListItemText>Exportación Avanzada...</ListItemText>
        </MenuItem>
      </Menu>

      {/* Dialog de exportación avanzada */}
      <Dialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Exportación Avanzada</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Formato de Exportación</InputLabel>
              <Select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                label="Formato de Exportación"
              >
                {exportFormats.map((format) => (
                  <MenuItem key={format.key} value={format.key}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {format.icon}
                      <Box>
                        <Typography variant="body2">{format.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format.description}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Nombre del archivo (opcional)"
              value={exportOptions.customFilename}
              onChange={(e) =>
                setExportOptions((prev) => ({
                  ...prev,
                  customFilename: e.target.value,
                }))
              }
              helperText="Si no se especifica, se usará un nombre automático con fecha"
              sx={{ mb: 3 }}
            />

            <Typography variant="subtitle2" gutterBottom>
              Opciones de Exportación
            </Typography>
            <FormGroup sx={{ mb: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={exportOptions.includeMetadata}
                    onChange={(e) =>
                      setExportOptions((prev) => ({
                        ...prev,
                        includeMetadata: e.target.checked,
                      }))
                    }
                  />
                }
                label="Incluir metadatos (fechas de creación, actualización)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={exportOptions.includeImages}
                    onChange={(e) =>
                      setExportOptions((prev) => ({
                        ...prev,
                        includeImages: e.target.checked,
                      }))
                    }
                  />
                }
                label="Incluir enlaces de imágenes"
                disabled={selectedFormat === "csv"}
              />
            </FormGroup>

            <Alert severity="info" sx={{ mt: 2 }}>
              Se exportarán {data.length} registros en formato{" "}
              {selectedFormat.toUpperCase()}.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExportDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleAdvancedExportSubmit}
            variant="contained"
            disabled={loading}
            startIcon={
              loading ? <CircularProgress size={16} /> : <DownloadIcon />
            }
          >
            Exportar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
