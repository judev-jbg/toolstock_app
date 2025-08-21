import React from "react";
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  IconButton,
  Typography,
  Avatar,
  Divider,
  Tooltip,
  useTheme,
} from "@mui/material";
import {
  MdDashboard as DashboardIcon,
  MdInventory as CatalogIcon,
  MdManageAccounts as ProfileIcon,
  MdExitToApp as LogoutIcon,
  MdMenuOpen as MenuOpenIcon,
  MdAssessment as AnalyticsIcon,
} from "react-icons/md";
import { IoMdMenu as MenuIcon } from "react-icons/io";
import { FaCrown as AdminIcon } from "react-icons/fa";
import Logo from "../common/Logo";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
const baseURL = "http://localhost:4000/uploads/avatars";

const DRAWER_WIDTH = 280;
const DRAWER_WIDTH_COLLAPSED = 64;

const menuItems = [
  {
    title: "Dashboard",
    icon: <DashboardIcon />,
    path: "/dashboard",
    roles: ["admin", "root"],
  },
  {
    title: "Catálogo",
    icon: <CatalogIcon />,
    path: "/catalog",
    roles: ["admin", "root"],
  },
  {
    title: "Estadísticas",
    icon: <AnalyticsIcon />,
    path: "/analytics",
    roles: ["admin", "root"],
  },
  {
    title: "Usuarios",
    icon: <ProfileIcon />,
    path: "/users",
    roles: ["root"],
  },
  {
    title: "Administración",
    icon: <AdminIcon />,
    path: "/admin",
    roles: ["root"],
  },
];

export const Sidebar = ({ collapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const { user, logout, hasRole } = useAuth();

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const drawerWidth = collapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

  // Filtrar items de menú según rol del usuario
  const visibleMenuItems = menuItems.filter((item) => hasRole(item.roles));

  const DrawerContent = () => (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        borderRight: 1,
        borderColor: "divider",
      }}
    >
      {/* Header con logo */}
      <Box
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          minHeight: 64,
        }}
      >
        {!collapsed && (
          <>
            <Logo />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                background:
                  "linear-gradient(45deg,rgb(143, 163, 252),rgb(110, 137, 255))",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Toolstock Admin
            </Typography>
          </>
        )}
        <IconButton
          onClick={onToggleCollapse}
          size="small"
          sx={{
            bgcolor: "action.hover",
            "&:hover": {
              bgcolor: "action.selected",
            },
          }}
        >
          {collapsed ? <MenuIcon /> : <MenuOpenIcon />}
        </IconButton>
      </Box>

      <Divider />

      {/* Navigation Menu */}
      <List sx={{ flexGrow: 1, px: 1, py: 2 }}>
        {visibleMenuItems.map((item) => {
          const isActive = location.pathname === item.path;

          const listItem = (
            <ListItem key={item.title} disablePadding>
              <ListItemButton
                onClick={() => handleNavigation(item.path)}
                selected={isActive}
                sx={{
                  borderRadius: 1,

                  mb: 0.5,
                  minHeight: 48,
                  justifyContent: collapsed ? "center" : "flex-start",
                  px: 2.5,
                  "&.Mui-selected": {
                    bgcolor: "primary.main",
                    color: "#f5f5f5",
                    "&:hover": {
                      bgcolor: "primary.dark",
                    },
                    "& .MuiListItemIcon-root": {
                      color: "primary.contrastText",
                    },
                  },
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: collapsed ? 0 : 3,
                    justifyContent: "center",
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {!collapsed && <ListItemText primary={item.title} />}
              </ListItemButton>
            </ListItem>
          );

          return collapsed ? (
            <Tooltip key={item.title} title={item.title} placement="right">
              {listItem}
            </Tooltip>
          ) : (
            listItem
          );
        })}
      </List>

      <Divider />

      {/* User section */}
      <Box sx={{ p: 2 }}>
        {!collapsed && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              mb: 2,
              p: 1,
              borderRadius: 2,
              bgcolor: "action.hover",
            }}
          >
            <Avatar
              sx={{
                width: 40,
                height: 40,
                mr: 2,
                bgcolor: "primary.main",
              }}
              src={user?.avatar ? `${baseURL}/${user.avatar}` : undefined}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" noWrap>
                {user?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {user?.role}
              </Typography>
            </Box>
          </Box>
        )}

        <Tooltip title={collapsed ? "Cerrar sesión" : ""} placement="right">
          <ListItemButton
            onClick={handleLogout}
            sx={{
              borderRadius: 2,
              justifyContent: collapsed ? "center" : "flex-start",
              px: 2.5,
              "&:hover": {
                bgcolor: "error.main",
                color: "error.contrastText",
                "& .MuiListItemIcon-root": {
                  color: "error.contrastText",
                },
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: collapsed ? 0 : 3,
                justifyContent: "center",
              }}
            >
              <LogoutIcon />
            </ListItemIcon>
            {!collapsed && <ListItemText primary="Cerrar sesión" />}
          </ListItemButton>
        </Tooltip>
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          transition: theme.transitions.create("width", {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        },
      }}
    >
      <DrawerContent />
    </Drawer>
  );
};
