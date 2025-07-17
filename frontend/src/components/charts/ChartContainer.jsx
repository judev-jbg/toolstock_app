import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Typography,
  useTheme,
} from "@mui/material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";

export const ChartContainer = ({
  title,
  children,
  height = 300,
  loading = false,
  error = null,
  ...props
}) => {
  const theme = useTheme();

  if (loading) {
    return (
      <Card {...props}>
        <CardHeader title={title} />
        <CardContent>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height,
            }}
          >
            <Typography color="text.secondary">Cargando datos...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card {...props}>
        <CardHeader title={title} />
        <CardContent>
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height,
            }}
          >
            <Typography color="error">Error al cargar datos</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card {...props}>
      <CardHeader title={title} />
      <CardContent>
        <Box sx={{ width: "100%", height }}>{children}</Box>
      </CardContent>
    </Card>
  );
};

// Gráfico de Barras
export const BarChartComponent = ({
  data,
  xKey,
  yKey,
  title,
  color,
  ...props
}) => {
  const theme = useTheme();

  return (
    <ChartContainer title={title} {...props}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Bar dataKey={yKey} fill={color || theme.palette.primary.main} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

// Gráfico de Líneas
export const LineChartComponent = ({
  data,
  xKey,
  yKey,
  title,
  color,
  ...props
}) => {
  const theme = useTheme();

  return (
    <ChartContainer title={title} {...props}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={color || theme.palette.primary.main}
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

// Gráfico de Pastel
export const PieChartComponent = ({
  data,
  nameKey,
  valueKey,
  title,
  colors,
  ...props
}) => {
  const theme = useTheme();

  const defaultColors = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.success.main,
    theme.palette.warning.main,
    theme.palette.error.main,
    theme.palette.info.main,
  ];

  const renderLabel = (entry) => {
    return `${entry[nameKey]}: ${entry[valueKey]}`;
  };

  return (
    <ChartContainer title={title} {...props}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderLabel}
            outerRadius={80}
            fill="#8884d8"
            dataKey={valueKey}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  (colors || defaultColors)[
                    index % (colors || defaultColors).length
                  ]
                }
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

// Gráfico de Área
export const AreaChartComponent = ({
  data,
  xKey,
  yKey,
  title,
  color,
  ...props
}) => {
  const theme = useTheme();

  return (
    <ChartContainer title={title} {...props}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Area
            type="monotone"
            dataKey={yKey}
            stroke={color || theme.palette.primary.main}
            fill={color || theme.palette.primary.main}
            fillOpacity={0.3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
};
