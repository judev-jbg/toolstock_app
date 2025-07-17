import React from "react";
import {
  Breadcrumbs as MuiBreadcrumbs,
  Link,
  Typography,
  Box,
} from "@mui/material";
import { MdNavigateNext as NavigateNextIcon } from "react-icons/md";
import { useLocation, Link as RouterLink } from "react-router-dom";

const routeLabels = {
  "/dashboard": "Dashboard",
  "/catalog": "Catálogo",
  "/users": "Usuarios",
  "/admin": "Administración",
  "/profile": "Perfil",
  "/settings": "Configuración",
};

export const Breadcrumbs = () => {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  if (pathnames.length === 0) {
    return (
      <Box>
        <Typography variant="h6" color="text.primary">
          Dashboard
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <MuiBreadcrumbs
        separator={<NavigateNextIcon fontSize="small" />}
        aria-label="breadcrumb"
        sx={{
          "& .MuiBreadcrumbs-separator": {
            color: "text.secondary",
          },
        }}
      >
        <Link
          component={RouterLink}
          to="/dashboard"
          color="text.secondary"
          underline="hover"
          sx={{
            display: "flex",
            alignItems: "center",
            "&:hover": {
              color: "primary.main",
            },
          }}
        >
          Inicio
        </Link>

        {pathnames.map((value, index) => {
          const to = `/${pathnames.slice(0, index + 1).join("/")}`;
          const isLast = index === pathnames.length - 1;
          const label =
            routeLabels[to] || value.charAt(0).toUpperCase() + value.slice(1);

          return isLast ? (
            <Typography key={to} color="text.primary" variant="subtitle2">
              {label}
            </Typography>
          ) : (
            <Link
              key={to}
              component={RouterLink}
              to={to}
              color="text.secondary"
              underline="hover"
              sx={{
                "&:hover": {
                  color: "primary.main",
                },
              }}
            >
              {label}
            </Link>
          );
        })}
      </MuiBreadcrumbs>
    </Box>
  );
};
