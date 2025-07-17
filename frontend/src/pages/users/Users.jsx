import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Chip,
  Avatar,
  IconButton,
  Menu,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import {
  MdAdd as AddIcon,
  MdOutlineEdit as EditIcon,
  MdDelete as DeleteIcon,
  MdMoreVert as MoreVertIcon,
  MdManageAccounts as PersonAddIcon,
  MdVpnKey as VpnKeyIcon,
  MdOutlineRefresh as RefreshIcon,
} from "react-icons/md";
import {
  IoMdLock as LockIcon,
  IoMdUnlock as LockOpenIcon,
} from "react-icons/io";
import { DataTable } from "../../components/ui/DataTable";
import { SearchFilters } from "../../components/ui/SearchFilters";
import { StatusChip } from "../../components/ui/StatusChip";
import { authService } from "../../services/api";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../contexts/AuthContext";
import { useNotification } from "../../contexts/NotificationContext";
import { formatDate } from "../../utils/formatters";

export const Users = () => {
  const { user: currentUser, isRoot } = useAuth();
  const { showSuccess, showError, showWarning } = useNotification();

  const [searchValue, setSearchValue] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    role: "",
  });

  // Estados para modales
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);

  // Estados para operaciones
  const [selectedUser, setSelectedUser] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuUser, setMenuUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // Formulario para crear/editar usuario
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "guest",
  });
  const [formErrors, setFormErrors] = useState({});

  // Verificar permisos
  if (!isRoot()) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Typography variant="h5" color="error">
          Acceso Denegado
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Solo los usuarios ROOT pueden acceder a la gestión de usuarios.
        </Typography>
      </Box>
    );
  }

  // API calls
  const {
    data: usersData,
    loading: usersLoading,
    refetch: refetchUsers,
  } = useApi(
    () =>
      authService.getUsers({
        search: searchValue,
        ...filters,
      }),
    [searchValue, filters]
  );

  // Configuración de columnas
  const columns = [
    {
      id: "avatar",
      label: "",
      sortable: false,
      render: (value, row) => (
        <Avatar
          sx={{ width: 40, height: 40, bgcolor: "primary.main" }}
          src={row.avatar ? `/uploads/avatars/${row.avatar}` : undefined}
        >
          {row.name?.charAt(0).toUpperCase()}
        </Avatar>
      ),
    },
    {
      id: "name",
      label: "Nombre",
      sortable: true,
      render: (value, row) => (
        <Box>
          <Typography variant="body2" fontWeight="medium">
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.email}
          </Typography>
        </Box>
      ),
    },
    {
      id: "role",
      label: "Rol",
      sortable: true,
      render: (value) => (
        <Chip
          label={value.toUpperCase()}
          size="small"
          color={
            value === "root"
              ? "error"
              : value === "admin"
              ? "primary"
              : "default"
          }
          variant="outlined"
        />
      ),
    },
    {
      id: "active",
      label: "Estado",
      sortable: true,
      render: (value) => <StatusChip status={value ? "active" : "inactive"} />,
    },
    {
      id: "createdAt",
      label: "Creado",
      sortable: true,
      render: (value) => (
        <Typography variant="caption" color="text.secondary">
          {formatDate(value)}
        </Typography>
      ),
    },
    {
      id: "actions",
      label: "Acciones",
      sortable: false,
      render: (value, row) => (
        <IconButton
          size="small"
          onClick={(e) => handleMenuOpen(e, row)}
          disabled={row._id === currentUser._id} // No permitir acciones sobre uno mismo
        >
          <MoreVertIcon />
        </IconButton>
      ),
    },
  ];

  // Configuración de filtros
  const filterConfig = [
    {
      key: "status",
      label: "Estado",
      options: [
        { value: "active", label: "Activos" },
        { value: "inactive", label: "Inactivos" },
      ],
    },
    {
      key: "role",
      label: "Rol",
      options: [
        { value: "guest", label: "Invitado" },
        { value: "admin", label: "Administrador" },
        { value: "root", label: "Super Admin" },
      ],
    },
  ];

  // Handlers
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      status: "",
      role: "",
    });
    setSearchValue("");
  };

  const handleMenuOpen = (event, user) => {
    setAnchorEl(event.currentTarget);
    setMenuUser(user);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuUser(null);
  };

  const handleCreateUser = () => {
    setFormData({
      name: "",
      email: "",
      role: "guest",
    });
    setFormErrors({});
    setCreateDialogOpen(true);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
    });
    setFormErrors({});
    setEditDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteUser = (user) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleResetPassword = (user) => {
    setSelectedUser(user);
    setResetPasswordDialogOpen(true);
    handleMenuClose();
  };

  const handleToggleStatus = async (user) => {
    setLoading(true);
    try {
      await authService.toggleUserStatus(user._id);
      showSuccess(
        `Usuario ${user.active ? "desactivado" : "activado"} correctamente`
      );
      refetchUsers();
    } catch (error) {
      showError(
        error.response?.data?.message || "Error al cambiar estado del usuario"
      );
    } finally {
      setLoading(false);
    }
    handleMenuClose();
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = "El nombre es obligatorio";
    }

    if (!formData.email.trim()) {
      errors.email = "El email es obligatorio";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = "El email no es válido";
    }

    if (!formData.role) {
      errors.role = "El rol es obligatorio";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitCreate = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      await authService.createUser(formData);
      showSuccess("Usuario creado correctamente");
      setCreateDialogOpen(false);
      refetchUsers();
    } catch (error) {
      showError(error.response?.data?.message || "Error al crear usuario");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitEdit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      await authService.updateUser(selectedUser._id, formData);
      showSuccess("Usuario actualizado correctamente");
      setEditDialogOpen(false);
      refetchUsers();
    } catch (error) {
      showError(error.response?.data?.message || "Error al actualizar usuario");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDelete = async () => {
    setLoading(true);
    try {
      await authService.deleteUser(selectedUser._id);
      showSuccess("Usuario eliminado correctamente");
      setDeleteDialogOpen(false);
      refetchUsers();
    } catch (error) {
      showError(error.response?.data?.message || "Error al eliminar usuario");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitResetPassword = async () => {
    setLoading(true);
    try {
      await authService.resetUserPassword(selectedUser._id);
      showSuccess("Correo de reseteo enviado correctamente");
      setResetPasswordDialogOpen(false);
    } catch (error) {
      showError(
        error.response?.data?.message || "Error al enviar correo de reseteo"
      );
    } finally {
      setLoading(false);
    }
  };

  const getUserStats = () => {
    const users = usersData?.users || [];
    return {
      total: users.length,
      active: users.filter((u) => u.active).length,
      inactive: users.filter((u) => !u.active).length,
      admins: users.filter((u) => u.role === "admin").length,
      guests: users.filter((u) => u.role === "guest").length,
      roots: users.filter((u) => u.role === "root").length,
    };
  };

  const stats = getUserStats();

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
            Gestión de Usuarios
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Administra usuarios del sistema y sus permisos
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={refetchUsers}
          >
            Actualizar
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={handleCreateUser}
          >
            Nuevo Usuario
          </Button>
        </Box>
      </Box>

      {/* Estadísticas */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="primary">
                {stats.total}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Usuarios
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="success.main">
                {stats.active}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Activos
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="error.main">
                {stats.inactive}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Inactivos
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="error.main">
                {stats.roots}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Super Admins
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="primary.main">
                {stats.admins}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Admins
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary">
                {stats.guests}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Invitados
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filtros */}
      <SearchFilters
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filters={filterConfig}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        activeFilters={filters}
      />

      {/* Tabla de usuarios */}
      <DataTable
        columns={columns}
        data={usersData?.users || []}
        loading={usersLoading}
        emptyMessage="No se encontraron usuarios"
        actions={false} // Deshabilitamos las acciones por defecto
      />

      {/* Menú contextual */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleEditUser(menuUser)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Editar</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => handleToggleStatus(menuUser)}>
          <ListItemIcon>
            {menuUser?.active ? (
              <LockIcon fontSize="small" />
            ) : (
              <LockOpenIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>
            {menuUser?.active ? "Desactivar" : "Activar"}
          </ListItemText>
        </MenuItem>

        <MenuItem onClick={() => handleResetPassword(menuUser)}>
          <ListItemIcon>
            <VpnKeyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Resetear Contraseña</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => handleDeleteUser(menuUser)}
          sx={{ color: "error.main" }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Eliminar</ListItemText>
        </MenuItem>
      </Menu>

      {/* Modal para crear usuario */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Crear Nuevo Usuario</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Se enviará un correo de activación al usuario con instrucciones para
            establecer su contraseña.
          </Alert>

          <TextField
            autoFocus
            margin="dense"
            label="Nombre completo"
            fullWidth
            variant="outlined"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            error={!!formErrors.name}
            helperText={formErrors.name}
            sx={{ mb: 2 }}
          />

          <TextField
            margin="dense"
            label="Correo electrónico"
            type="email"
            fullWidth
            variant="outlined"
            value={formData.email}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, email: e.target.value }))
            }
            error={!!formErrors.email}
            helperText={formErrors.email}
            sx={{ mb: 2 }}
          />

          <FormControl fullWidth variant="outlined" error={!!formErrors.role}>
            <InputLabel>Rol</InputLabel>
            <Select
              value={formData.role}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, role: e.target.value }))
              }
              label="Rol"
            >
              <MenuItem value="guest">Invitado</MenuItem>
              <MenuItem value="admin">Administrador</MenuItem>
              <MenuItem value="root">Super Administrador</MenuItem>
            </Select>
            {formErrors.role && (
              <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                {formErrors.role}
              </Typography>
            )}
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmitCreate}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : "Crear Usuario"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal para editar usuario */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Editar Usuario</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nombre completo"
            fullWidth
            variant="outlined"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
            error={!!formErrors.name}
            helperText={formErrors.name}
            sx={{ mb: 2 }}
          />

          <TextField
            margin="dense"
            label="Correo electrónico"
            type="email"
            fullWidth
            variant="outlined"
            value={formData.email}
            disabled
            helperText="El correo electrónico no se puede modificar"
            sx={{ mb: 2 }}
          />

          <FormControl fullWidth variant="outlined" error={!!formErrors.role}>
            <InputLabel>Rol</InputLabel>
            <Select
              value={formData.role}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, role: e.target.value }))
              }
              label="Rol"
            >
              <MenuItem value="guest">Invitado</MenuItem>
              <MenuItem value="admin">Administrador</MenuItem>
              <MenuItem value="root">Super Administrador</MenuItem>
            </Select>
            {formErrors.role && (
              <Typography variant="caption" color="error" sx={{ mt: 1 }}>
                {formErrors.role}
              </Typography>
            )}
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmitEdit}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : "Actualizar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal para eliminar usuario */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Eliminar Usuario</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            Esta acción no se puede deshacer. El usuario será eliminado
            permanentemente del sistema.
          </Alert>

          {selectedUser && (
            <Typography variant="body1">
              ¿Estás seguro de que quieres eliminar al usuario{" "}
              <strong>{selectedUser.name}</strong>?
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmitDelete}
            variant="contained"
            color="error"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : "Eliminar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal para resetear contraseña */}
      <Dialog
        open={resetPasswordDialogOpen}
        onClose={() => setResetPasswordDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Resetear Contraseña</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Se enviará un correo electrónico al usuario con instrucciones para
            resetear su contraseña.
          </Alert>

          {selectedUser && (
            <Typography variant="body1">
              ¿Enviar correo de reseteo de contraseña a{" "}
              <strong>{selectedUser.name}</strong>?
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetPasswordDialogOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmitResetPassword}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : "Enviar Correo"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
