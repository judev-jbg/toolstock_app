import React from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Paper,
  Avatar,
  Button,
} from "@mui/material";

import {
  MdInventory as InventoryIcon,
  MdOutlineSyncAlt as SyncIcon,
  MdPeople as PeopleIcon,
  MdOutlineTrendingUp as TrendingUpIcon,
  MdOutlineWarning as WarningIcon,
} from "react-icons/md";

import { useAuth } from "../../contexts/AuthContext";
import { useApi } from "../../hooks/useApi";
import { productService } from "../../services/api";
import { formatNumber } from "../../utils/formatters";
import { useNavigate } from "react-router-dom";
import { useAlert } from "../../contexts/AlertContext";
const baseURL = "http://localhost:4000/uploads/avatars";

export const Dashboard = () => {
  const { user, isRoot } = useAuth();
  const navigate = useNavigate();
  const { AlertsList, getTotalAlerts, getCriticalAlerts } = useAlert();
  const { data: productStats } = useApi(() => productService.getStats(), []);

  const stats = [
    {
      title: "Productos Totales",
      value: formatNumber(productStats?.total || 0),
      change: "+0%",
      icon: <InventoryIcon />,
      color: "primary",
    },
    {
      title: "Productos Activos",
      value: formatNumber(productStats?.byStatus?.[0]),
      change: "+0%",
      icon: <TrendingUpIcon />,
      color: "success",
    },
    {
      title: "Productos Inactivos",
      value: formatNumber(productStats?.byStatus?.[1]),
      change: "+0%",
      icon: <WarningIcon />,
      color: "error",
    },
  ];

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Bienvenido de vuelta, {user?.name}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Estadísticas */}
        {stats.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                  <Avatar
                    sx={{
                      bgcolor: `${stat.color}.main`,
                      mr: 2,
                    }}
                  >
                    {stat.icon}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" component="div">
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {stat.title}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {/* Alertas y notificaciones */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <AlertsList />
          </Paper>
        </Grid>

        {/* Información del usuario */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Tu Información
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
              <Avatar
                sx={{
                  width: 64,
                  height: 64,
                  bgcolor: "primary.main",
                  mr: 2,
                }}
                src={user?.avatar ? `${baseURL}/${user.avatar}` : undefined}
              >
                {user?.name?.charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="h6">{user?.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {user?.email}
                </Typography>
                <Box
                  sx={{
                    display: "inline-block",
                    px: 1,
                    py: 0.5,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    borderRadius: 1,
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    mt: 1,
                  }}
                >
                  {user?.role}
                </Box>
              </Box>
            </Box>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => navigate("/profile")}
            >
              Editar Perfil
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};
