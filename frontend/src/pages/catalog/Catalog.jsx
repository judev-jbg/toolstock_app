import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Fab,
  Backdrop,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  MdAdd as AddIcon,
  MdOutlineSyncAlt as SyncIcon,
  MdMoreVert as MoreVertIcon,
  MdOutlineRefresh as RefreshIcon,
  MdOutlineEdit as EditIcon,
  MdOutlineAssessment as AssessmentIcon,
} from "react-icons/md";
import { FaCloudArrowUp as FileUploadIcon } from "react-icons/fa6";
import { IoMdCloudDownload as GetAppIcon } from "react-icons/io";

import { DataTable } from "../../components/ui/DataTable";
import { SearchFilters } from "../../components/ui/SearchFilters";

import { ExportButton } from "../../components/ui/ExportButton";
import { productService } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { useDebounce } from "../../hooks/useDebounce";
import { useNotification } from "../../contexts/NotificationContext";
import {
  formatCurrency,
  formatNumber,
  formatDate,
  truncateText,
} from "../../utils/formatters";

export const Catalog = () => {
  const [searchValue, setSearchValue] = useState("");
  const [filters, setFilters] = useState({
    brand: "",
    status: "active",
    sortBy: "updatedAt",
    sortOrder: "desc",
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);

  // Modales
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [bulkStockDialogOpen, setBulkStockDialogOpen] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);

  // Estados para operaciones
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [stockValue, setStockValue] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const { showSuccess, showError, showInfo } = useNotification();
  const debouncedSearch = useDebounce(searchValue, 300);

  // API calls
  const {
    data: productsData,
    loading: productsLoading,
    refetch: refetchProducts,
  } = useApi(
    () =>
      productService.getProducts({
        page: page + 1,
        limit: rowsPerPage,
        search: debouncedSearch,
        ...filters,
      }),
    [page, rowsPerPage, debouncedSearch, filters]
  );

  const { data: brands } = useApi(() => productService.getBrands(), []);
  const { data: stats } = useApi(() => productService.getStats(), []);

  // Configuración de columnas para la tabla
  const columns = [
    {
      id: "erp_sku",
      label: "Referencia",

      sortable: true,
      render: (value, row) => (
        <Box textAlign="left">
          <Typography variant="body2" fontWeight="medium">
            {value}
          </Typography>
          {row.amz_asin && (
            <Typography variant="caption" color="text.secondary">
              ASIN: {row.amz_asin}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      id: "erp_name",
      label: "Producto",
      sortable: true,
      render: (value, row) => (
        <Box>
          <Typography variant="body2" fontWeight="medium">
            {truncateText(value || row.erp_name, 40)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.erp_manufacturer || "-"}
          </Typography>
        </Box>
      ),
    },

    {
      id: "erp_price",
      label: "Precio ERP",
      align: "right",
      sortable: true,
      render: (value, row) => (
        <Box textAlign="right">
          <Typography
            variant="body2"
            fontWeight="medium"
            color={
              row.amz_price > row.erp_price_web_official * 1.21
                ? "text.primary"
                : "error.main"
            }
          >
            {formatCurrency(value * 1.21 || row.erp_price_web_official * 1.21)}
          </Typography>
          {row.erp_cost && (
            <Typography variant="caption" color="text.secondary">
              Coste: {formatCurrency(row.erp_cost)}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      id: "amz_price",
      label: "Precio AMZ",
      align: "right",
      sortable: true,
      render: (value, row) => (
        <Typography
          variant="body2"
          fontWeight="medium"
          color={
            row.amz_price > row.erp_price_web_official * 1.21
              ? "text.primary"
              : "error.main"
          }
        >
          {formatCurrency(value || row.amz_price)}
        </Typography>
      ),
    },
    {
      id: "amz_quantity",
      label: "Stock",
      align: "center",
      sortable: true,
      render: (value, row) => (
        <Box
          textAlign="center"
          display={"flex"}
          alignItems="center"
          justifyContent={"center"}
        >
          <Typography
            variant="body2"
            fontWeight="medium"
            color={value > 0 ? "success.main" : "error.main"}
          >
            {formatNumber(value || row.erp_stock)}
          </Typography>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleEditStock(row);
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },

    {
      id: "amz_lastSyncAt",
      label: "Última Sync",
      sortable: true,
      render: (value) => (
        <Typography variant="caption" color="text.secondary">
          {value ? formatDate(value) : "Sin sincronizar"}
        </Typography>
      ),
    },
  ];

  // Configuración de filtros
  const filterConfig = [
    {
      key: "brand",
      label: "Marca",
      options: (brands || []).map((brand) => ({
        value: brand,
        label: brand,
      })),
    },
    {
      key: "status",
      label: "Estado",
      options: [
        { value: "active", label: "Activo" },
        { value: "inactive", label: "Anulado" },
      ],
    },
    {
      key: "sortBy",
      label: "Ordenar por",
      options: [
        { value: "updatedAt", label: "Última actualización" },
        { value: "amz_title", label: "Nombre" },
        { value: "amz_price", label: "Precio" },
        { value: "amz_quantity", label: "Stock" },
      ],
    },
    {
      key: "sortOrder",
      label: "Orden",
      options: [
        { value: "desc", label: "Descendente" },
        { value: "asc", label: "Ascendente" },
      ],
    },
  ];

  // Handlers
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
    setPage(0);
  };

  const handleClearFilters = () => {
    setFilters({
      brand: "",
      status: "active",
      sortBy: "updatedAt",
      sortOrder: "desc",
    });
    setSearchValue("");
    setPage(0);
  };

  const handleEditStock = (product) => {
    setSelectedProduct(product);
    setStockValue(product.amz_quantity || product.erp_stock || 0);
    setStockDialogOpen(true);
  };

  const handleUpdateStock = async () => {
    if (!selectedProduct || stockValue === "") return;

    setLoading(true);
    try {
      await productService.updateProductStock(
        selectedProduct._id,
        parseInt(stockValue)
      );
      showSuccess("Stock actualizado correctamente");
      setStockDialogOpen(false);
      refetchProducts();
    } catch (error) {
      showError(error.response?.data?.message || "Error al actualizar stock");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpdateStock = async () => {
    if (selectedProducts.length === 0) return;

    setLoading(true);
    try {
      const updates = selectedProducts.map((productId) => ({
        id: productId,
        quantity: 0, // O el valor que quieras establecer
      }));

      await productService.bulkUpdateStock(updates);
      showSuccess(`Stock actualizado para ${updates.length} productos`);
      setBulkStockDialogOpen(false);
      setSelectedProducts([]);
      refetchProducts();
    } catch (error) {
      showError(
        error.response?.data?.message || "Error en actualización masiva"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImportProducts = async () => {
    if (!importFile) return;

    setLoading(true);
    try {
      const result = await productService.importProducts(importFile);
      showSuccess(
        `Importación completada: ${result.results.created} creados, ${result.results.updated} actualizados`
      );
      setImportDialogOpen(false);
      setImportFile(null);
      refetchProducts();
    } catch (error) {
      showError(error.response?.data?.message || "Error en la importación");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncProducts = async () => {
    setLoading(true);
    try {
      const result = await productService.syncProducts();
      showSuccess(
        `Sincronización completada: ${result.results.updated} productos sincronizados`
      );
      setSyncDialogOpen(false);
      refetchProducts();
    } catch (error) {
      showError(error.response?.data?.message || "Error en la sincronización");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    productService.downloadImportTemplate();
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
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
            Catálogo de Productos
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Gestiona tu inventario de productos y sincronización con Amazon
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 2 }}>
          {/* <Button
            variant="outlined"
            startIcon={<GetAppIcon />}
            onClick={handleDownloadTemplate}
          >
            Plantilla
          </Button> */}
          {/* <Button
            variant="outlined"
            startIcon={<FileUploadIcon />}
            onClick={() => setImportDialogOpen(true)}
          >
            Importar
          </Button> */}
          <ExportButton
            data={productsData?.products || []}
            filename="catalogo-productos"
            dataType="products"
          />
          {/* <Button
            variant="outlined"
            startIcon={<SyncIcon />}
            onClick={() => setSyncDialogOpen(true)}
          >
            Sincronizar
          </Button> */}
          <IconButton onClick={handleMenuOpen}>
            <MoreVertIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Estadísticas */}
      {/* {stats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="primary">
                  {formatNumber(stats.total)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Productos
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="success.main">
                  {formatNumber(stats.byStatus?.Active || 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Activos
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="error.main">
                  {formatNumber(stats.byStatus?.Inactive || 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Inactivos
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6" color="warning.main">
                  {formatNumber(stats.byStatus?.Incomplete || 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Incompletos
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )} */}

      {/* Filtros */}
      <SearchFilters
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filters={filterConfig}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        activeFilters={filters}
        showAdvancedFilters={true}
        onToggleAdvancedFilters={setShowAdvancedFilters}
      />

      {/* Tabla de productos */}
      <DataTable
        columns={columns}
        data={productsData?.products || []}
        loading={productsLoading}
        selectable={true}
        onEdit={handleEditStock}
        emptyMessage="No se encontraron productos"
        pagination={false} // Manejamos paginación manualmente
      />

      {/* Paginación manual */}
      {productsData?.pagination && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Button
            disabled={!productsData.pagination.hasPrevPage}
            onClick={() => setPage(page - 1)}
            sx={{ mr: 1 }}
          >
            Anterior
          </Button>
          <Typography sx={{ mx: 2, alignSelf: "center" }}>
            Página {productsData.pagination.currentPage} de{" "}
            {productsData.pagination.totalPages}
          </Typography>
          <Button
            disabled={!productsData.pagination.hasNextPage}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </Box>
      )}

      {/* FAB para acciones rápidas */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: "fixed", bottom: 16, right: 16 }}
        onClick={() => setImportDialogOpen(true)}
      >
        <AddIcon />
      </Fab>

      {/* Menú contextual */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            handleMenuClose();
            refetchProducts();
          }}
        >
          <ListItemIcon>
            <RefreshIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Actualizar</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            setStatsDialogOpen(true);
          }}
        >
          <ListItemIcon>
            <AssessmentIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Estadísticas</ListItemText>
        </MenuItem>
      </Menu>

      {/* Modales */}

      {/* Modal de importación */}
      <Dialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Importar Productos desde Excel</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Selecciona un archivo Excel (.xlsx) con la estructura de la
            plantilla descargada.
          </Alert>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setImportFile(e.target.files[0])}
            style={{ marginBottom: 16 }}
          />
          {importFile && (
            <Typography variant="body2" color="text.secondary">
              Archivo seleccionado: {importFile.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleDownloadTemplate} variant="outlined">
            Descargar Plantilla
          </Button>
          <Button
            onClick={handleImportProducts}
            variant="contained"
            disabled={!importFile || loading}
          >
            {loading ? <CircularProgress size={20} /> : "Importar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de edición de stock */}
      <Dialog
        open={stockDialogOpen}
        onClose={() => setStockDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Actualizar Stock</DialogTitle>
        <DialogContent>
          {selectedProduct && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1">
                {selectedProduct.amz_title || selectedProduct.erp_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                SKU: {selectedProduct.erp_sku}
              </Typography>
            </Box>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Cantidad"
            type="number"
            fullWidth
            variant="outlined"
            value={stockValue}
            onChange={(e) => setStockValue(e.target.value)}
            inputProps={{ min: 0 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStockDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleUpdateStock}
            variant="contained"
            disabled={loading || stockValue === ""}
          >
            {loading ? <CircularProgress size={20} /> : "Actualizar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de sincronización */}
      <Dialog
        open={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Sincronizar con Amazon</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Esta operación sincronizará todos los productos con Amazon SP-API.
            Puede tardar varios minutos.
          </Alert>
          <Typography variant="body2">
            Se actualizarán precios, stock y estados de los productos desde
            Amazon.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleSyncProducts}
            variant="contained"
            disabled={loading}
            color="warning"
          >
            {loading ? <CircularProgress size={20} /> : "Sincronizar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Backdrop de loading */}
      <Backdrop
        sx={{ color: "#fff", zIndex: (theme) => theme.zIndex.drawer + 1 }}
        open={loading}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
    </Box>
  );
};
