import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  LinearProgress,
  Grid,
  Chip,
} from "@mui/material";

import {
  MdMemory as MemoryIcon,
  MdStorage as StorageIcon,
  MdSpeed as SpeedIcon,
  MdNetworkCheck as NetworkIcon,
} from "react-icons/md";

export const SystemMetrics = ({ metrics }) => {
  const MetricCard = ({
    title,
    value,
    unit,
    color = "primary",
    icon,
    progress,
  }) => (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          {icon}
          <Typography variant="h6" sx={{ ml: 1 }}>
            {value}
            {unit && (
              <Typography component="span" variant="body2">
                {" "}
                {unit}
              </Typography>
            )}
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        {progress !== undefined && (
          <LinearProgress
            variant="determinate"
            value={progress}
            color={color}
            sx={{ mt: 1 }}
          />
        )}
      </CardContent>
    </Card>
  );

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Uso de CPU"
          value="45"
          unit="%"
          color="primary"
          icon={<SpeedIcon color="primary" />}
          progress={45}
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Uso de Memoria"
          value="2.1"
          unit="GB"
          color="warning"
          icon={<MemoryIcon color="warning" />}
          progress={65}
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Almacenamiento"
          value="15.2"
          unit="GB"
          color="success"
          icon={<StorageIcon color="success" />}
          progress={30}
        />
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <MetricCard
          title="Conectividad"
          value="100"
          unit="%"
          color="success"
          icon={<NetworkIcon color="success" />}
          progress={100}
        />
      </Grid>
    </Grid>
  );
};
