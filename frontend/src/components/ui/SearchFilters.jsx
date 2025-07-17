import React, { useState } from "react";
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Chip,
  Paper,
  Grid,
  InputAdornment,
  IconButton,
  Collapse,
} from "@mui/material";
import {
  MdManageSearch as SearchIcon,
  MdClear as ClearIcon,
  MdFilterList as FilterListIcon,
  MdOutlineExpandMore as ExpandMoreIcon,
  MdOutlineExpandLess as ExpandLessIcon,
} from "react-icons/md";

import { useDebounce } from "../../hooks/useDebounce";

export const SearchFilters = ({
  searchValue,
  onSearchChange,
  filters = [],
  onFilterChange,
  onClearFilters,
  showAdvancedFilters = false,
  onToggleAdvancedFilters,
  activeFilters = {},
}) => {
  const [expanded, setExpanded] = useState(false);
  const debouncedSearch = useDebounce(searchValue, 300);

  React.useEffect(() => {
    if (onSearchChange) {
      onSearchChange(debouncedSearch);
    }
  }, [debouncedSearch, onSearchChange]);

  const handleFilterChange = (filterKey, value) => {
    if (onFilterChange) {
      onFilterChange(filterKey, value);
    }
  };

  const handleClearSearch = () => {
    if (onSearchChange) {
      onSearchChange("");
    }
  };

  const handleToggleExpanded = () => {
    setExpanded(!expanded);
    if (onToggleAdvancedFilters) {
      onToggleAdvancedFilters(!expanded);
    }
  };

  const getActiveFiltersCount = () => {
    return Object.values(activeFilters).filter(
      (value) =>
        value !== "" && value !== "all" && value !== null && value !== undefined
    ).length;
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Grid container spacing={2} alignItems="center">
        {/* Búsqueda principal */}
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            size="small"
            placeholder="Buscar productos..."
            value={searchValue}
            onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: searchValue && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleClearSearch}>
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Grid>

        {/* Filtros básicos */}
        <Grid item xs={12} md={4}>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {filters.slice(0, 2).map((filter) => (
              <FormControl key={filter.key} size="small" sx={{ minWidth: 120 }}>
                <InputLabel>{filter.label}</InputLabel>
                <Select
                  value={activeFilters[filter.key] || ""}
                  onChange={(e) =>
                    handleFilterChange(filter.key, e.target.value)
                  }
                  label={filter.label}
                >
                  <MenuItem value="">
                    <em>Todos</em>
                  </MenuItem>
                  {filter.options.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ))}
          </Box>
        </Grid>

        {/* Controles */}
        <Grid item xs={12} md={2}>
          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
            {showAdvancedFilters && (
              <Button
                variant="outlined"
                size="small"
                onClick={handleToggleExpanded}
                startIcon={<FilterListIcon />}
                endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              >
                Filtros{" "}
                {getActiveFiltersCount() > 0 && `(${getActiveFiltersCount()})`}
              </Button>
            )}

            {getActiveFiltersCount() > 0 && (
              <Button
                variant="text"
                size="small"
                onClick={onClearFilters}
                color="error"
              >
                Limpiar
              </Button>
            )}
          </Box>
        </Grid>
      </Grid>

      {/* Filtros avanzados */}
      {showAdvancedFilters && (
        <Collapse in={expanded}>
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}>
            <Grid container spacing={2}>
              {filters.slice(2).map((filter) => (
                <Grid item xs={12} sm={6} md={3} key={filter.key}>
                  <FormControl fullWidth size="small">
                    <InputLabel>{filter.label}</InputLabel>
                    <Select
                      value={activeFilters[filter.key] || ""}
                      onChange={(e) =>
                        handleFilterChange(filter.key, e.target.value)
                      }
                      label={filter.label}
                    >
                      <MenuItem value="">
                        <em>Todos</em>
                      </MenuItem>
                      {filter.options.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Collapse>
      )}

      {/* Chips de filtros activos */}
      {getActiveFiltersCount() > 0 && (
        <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
          {Object.entries(activeFilters).map(([key, value]) => {
            if (!value || value === "all" || value === "") return null;

            const filter = filters.find((f) => f.key === key);
            const option = filter?.options.find((o) => o.value === value);

            return (
              <Chip
                key={key}
                label={`${filter?.label}: ${option?.label || value}`}
                size="small"
                onDelete={() => handleFilterChange(key, "")}
                color="primary"
                variant="outlined"
              />
            );
          })}
        </Box>
      )}
    </Paper>
  );
};
