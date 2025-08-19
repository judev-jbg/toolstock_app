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
  Popover,
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
  const [anchorEl, setAnchorEl] = useState(null);
  const debouncedSearch = useDebounce(searchValue, 300);
  const open = Boolean(anchorEl);

  React.useEffect(() => {
    if (onSearchChange) {
      onSearchChange(debouncedSearch);
    }
  }, [debouncedSearch, onSearchChange]);

  const handleFilterChange = (filterKey, value) => {
    if (onFilterChange) {
      console.log(filterKey, value);
      onFilterChange(filterKey, value);
    }
  };

  const handleClearSearch = () => {
    if (onSearchChange) {
      onSearchChange("");
    }
  };

  const handleOpenPopover = (event) => {
    setAnchorEl(event.currentTarget);
    if (onToggleAdvancedFilters) {
      onToggleAdvancedFilters(true);
    }
  };

  const handleClosePopover = () => {
    setAnchorEl(null);
    if (onToggleAdvancedFilters) {
      onToggleAdvancedFilters(false);
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
                onClick={handleOpenPopover}
                startIcon={<FilterListIcon />}
                endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
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
        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={handleClosePopover}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "right",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "right",
          }}
        >
          <Paper sx={{ p: 2, minWidth: 400, maxWidth: 600 }}>
            <Grid container spacing={2}>
              {filters.slice(2).map((filter) => (
                <Grid item xs={12} sm={6} key={filter.key}>
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
          </Paper>
        </Popover>
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
