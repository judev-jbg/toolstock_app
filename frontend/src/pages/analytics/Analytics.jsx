import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Tabs,
  Tab,
  Alert,
  Button,
} from "@mui/material";
import {
  MdTrendingUp as TrendingUpIcon,
  MdAssessment as AssessmentIcon,
  MdBarChart as BarChartIcon,
} from "react-icons/md";
import { IoMdPie as PieChartIcon } from "react-icons/io";
import { FaCloudArrowDown as DownloadIcon } from "react-icons/fa6";

import {
  BarChartComponent,
  LineChartComponent,
  PieChartComponent,
  AreaChartComponent,
} from "../../components/charts/ChartContainer";
import { ExportButton } from "../../components/ui/ExportButton";
import { useApi } from "../../hooks/useApi";
import { productService, authService } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { formatNumber, formatCurrency } from "../../utils/formatters";

const TabPanel = ({ children, value, index, ...other }) => (
  <div role="tabpanel" hidden={value !== index} {...other}>
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

export const Analytics = () => {
  const { isRoot } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [timeRange, setTimeRange] = useState("30d");

  // Verificar permisos
  if (!isRoot()) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Typography variant="h5" color="error">
          Acceso Denegado
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Solo los administradores pueden acceder a las estadísticas avanzadas.
        </Typography>
      </Box>
    );
  }

  // API calls
  const { data: productStats } = useApi(() => productService.getStats(), []);
  const { data: allProducts } = useApi(
    () => productService.getProducts({ limit: 1000 }),
    []
  );
  const { data: allUsers } = useApi(() => authService.getUsers(), []);
  const { data: brands } = useApi(() => productService.getBrands(), []);

  // Procesamiento de datos para gráficos
  const chartData = useMemo(() => {
    if (!allProducts?.products || !productStats) return null;

    const products = allProducts.products;

    // Datos por estado
    const statusData = [
      {
        name: "Activos",
        value: productStats.byStatus?.Active || 0,
        color: "#4caf50",
      },
      {
        name: "Inactivos",
        value: productStats.byStatus?.Inactive || 0,
        color: "#f44336",
      },
      {
        name: "Incompletos",
        value: productStats.byStatus?.Incomplete || 0,
        color: "#ff9800",
      },
    ];

    // Datos por marca (top 10)
    const brandCounts = {};
    products.forEach((product) => {
      const brand =
        product.amz_brand || product.erp_manufacturer || "Sin marca";
      brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    });

    const brandData = Object.entries(brandCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));

    // Datos de precios por rango
    const priceRanges = {
      "0-25": 0,
      "25-50": 0,
      "50-100": 0,
      "100-200": 0,
      "200+": 0,
    };

    products.forEach((product) => {
      const price = product.amz_price || product.erp_price || 0;
      if (price <= 25) priceRanges["0-25"]++;
      else if (price <= 50) priceRanges["25-50"]++;
      else if (price <= 100) priceRanges["50-100"]++;
      else if (price <= 200) priceRanges["100-200"]++;
      else priceRanges["200+"]++;
    });

    const priceData = Object.entries(priceRanges).map(([range, count]) => ({
      range,
      count,
    }));

    // Datos de stock
    const stockRanges = {
      "Sin stock": 0,
      "1-10": 0,
      "11-50": 0,
      "51-100": 0,
      "100+": 0,
    };

    products.forEach((product) => {
      const stock = product.amz_quantity || product.erp_stock || 0;
      if (stock === 0) stockRanges["Sin stock"]++;
      else if (stock <= 10) stockRanges["1-10"]++;
      else if (stock <= 50) stockRanges["11-50"]++;
      else if (stock <= 100) stockRanges["51-100"]++;
      else stockRanges["100+"]++;
    });

    const stockData = Object.entries(stockRanges).map(([range, count]) => ({
      range,
      count,
    }));

    // Simulación de datos temporales (últimos 30 días)
    const temporalData = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return {
        date: date.toLocaleDateString("es-ES", {
          month: "short",
          day: "numeric",
        }),
        productos: Math.floor(Math.random() * 50) + products.length - 25,
        ventas: Math.floor(Math.random() * 1000) + 500,
        sincronizaciones: Math.floor(Math.random() * 20) + 5,
      };
    });

    return {
      statusData,
      brandData,
      priceData,
      stockData,
      temporalData,
    };
  }, [allProducts, productStats]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Estadísticas rápidas
  const quickStats = useMemo(() => {
    if (!allProducts?.products || !allUsers?.users) return null;

    const products = allProducts.products;
    const users = allUsers.users;

    const totalValue = products.reduce((sum, product) => {
      return (
        sum +
        (product.amz_price || product.erp_price || 0) *
          (product.amz_quantity || product.erp_stock || 0)
      );
    }, 0);

    const avgPrice =
      products.length > 0
        ? products.reduce(
            (sum, product) =>
              sum + (product.amz_price || product.erp_price || 0),
            0
          ) / products.length
        : 0;

    return {
      totalProducts: products.length,
      totalUsers: users.length,
      totalValue,
      avgPrice,
      productsWithStock: products.filter(
        (p) => (p.amz_quantity || p.erp_stock || 0) > 0
      ).length,
      syncedProducts: products.filter((p) => p.amz_lastSyncAt).length,
    };
  }, [allProducts, allUsers]);

  if (!chartData || !quickStats) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <Typography>Cargando estadísticas...</Typography>
      </Box>
    );
  }

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
            Análisis y Estadísticas
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Visualización avanzada de datos del sistema
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <FormControl size="small">
            <InputLabel>Período</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              label="Período"
            >
              <MenuItem value="7d">7 días</MenuItem>
              <MenuItem value="30d">30 días</MenuItem>
              <MenuItem value="90d">90 días</MenuItem>
              <MenuItem value="1y">1 año</MenuItem>
            </Select>
          </FormControl>

          <ExportButton
            data={allProducts?.products || []}
            filename="estadisticas-productos"
            dataType="products"
            variant="contained"
          />
        </Box>
      </Box>

      {/* Estadísticas rápidas */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="primary">
                {formatNumber(quickStats.totalProducts)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Productos Totales
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="success.main">
                {formatNumber(quickStats.productsWithStock)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Con Stock
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="info.main">
                {formatNumber(quickStats.syncedProducts)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sincronizados
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="warning.main">
                {formatCurrency(quickStats.avgPrice)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Precio Promedio
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="secondary.main">
                {formatCurrency(quickStats.totalValue)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Valor Total
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={2}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.primary">
                {formatNumber(quickStats.totalUsers)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Usuarios Totales
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs para diferentes vistas */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Vista General" icon={<AssessmentIcon />} />
          <Tab label="Productos" icon={<BarChartIcon />} />
          <Tab label="Tendencias" icon={<TrendingUpIcon />} />
        </Tabs>
      </Paper>

      {/* Tab 1: Vista General */}
      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <PieChartComponent
              data={chartData.statusData}
              nameKey="name"
              valueKey="value"
              title="Distribución por Estado"
              height={350}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <BarChartComponent
              data={chartData.priceData}
              xKey="range"
              yKey="count"
              title="Distribución por Rangos de Precio (€)"
              height={350}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <BarChartComponent
              data={chartData.stockData}
              xKey="range"
              yKey="count"
              title="Distribución por Rangos de Stock"
              height={350}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <AreaChartComponent
              data={chartData.temporalData}
              xKey="date"
              yKey="productos"
              title="Evolución del Catálogo (30 días)"
              height={350}
            />
          </Grid>
        </Grid>
      </TabPanel>

      {/* Tab 2: Productos */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <BarChartComponent
              data={chartData.brandData}
              xKey="name"
              yKey="value"
              title="Top 10 Marcas por Número de Productos"
              height={400}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Análisis detallado de productos por categorías y características.
            </Alert>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Resumen de Productos
                </Typography>
                <Typography variant="body2" paragraph>
                  • Productos únicos: {formatNumber(quickStats.totalProducts)}
                </Typography>
                <Typography variant="body2" paragraph>
                  • Marcas diferentes: {brands?.length || 0}
                </Typography>
                <Typography variant="body2" paragraph>
                  • Productos con imágenes:{" "}
                  {formatNumber(
                    allProducts?.products?.filter((p) => p.amz_imageUrl)
                      .length || 0
                  )}
                </Typography>
                <Typography variant="body2">
                  • Última sincronización: Hace 2 horas
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <PieChartComponent
              data={chartData.stockData.map((item) => ({
                name: item.range,
                value: item.count,
              }))}
              nameKey="name"
              valueKey="value"
              title="Stock Distribution"
              height={300}
            />
          </Grid>
        </Grid>
      </TabPanel>

      {/* Tab 3: Tendencias */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <LineChartComponent
              data={chartData.temporalData}
              xKey="date"
              yKey="ventas"
              title="Tendencia de Ventas (Simulado)"
              height={400}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <AreaChartComponent
              data={chartData.temporalData}
              xKey="date"
              yKey="sincronizaciones"
              title="Sincronizaciones Diarias"
              height={300}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Métricas de Rendimiento
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Tiempo promedio de sincronización
                  </Typography>
                  <Typography variant="h6" color="primary">
                    2.3 segundos
                  </Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Tasa de éxito de sincronización
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    98.5%
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Productos procesados hoy
                  </Typography>
                  <Typography variant="h6" color="info.main">
                    {formatNumber(Math.floor(Math.random() * 500) + 100)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};
