import React from "react";
import { Chip } from "@mui/material";

const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case "active":
    case "activo":
      return "success";
    case "inactive":
    case "inactivo":
      return "error";
    case "incomplete":
    case "incompleto":
      return "warning";
    case "pending":
    case "pendiente":
      return "warning";
    case "synced":
    case "sincronizado":
      return "success";
    case "error":
      return "error";
    default:
      return "default";
  }
};

const getStatusLabel = (status) => {
  switch (status?.toLowerCase()) {
    case "active":
      return "Activo";
    case "inactive":
      return "Inactivo";
    case "incomplete":
      return "Incompleto";
    case "pending":
      return "Pendiente";
    case "synced":
      return "Sincronizado";
    case "error":
      return "Error";
    default:
      return status || "Sin estado";
  }
};

export const StatusChip = ({
  status,
  variant = "filled",
  size = "small",
  ...props
}) => {
  return (
    <Chip
      label={getStatusLabel(status)}
      color={getStatusColor(status)}
      variant={variant}
      size={size}
      {...props}
    />
  );
};
