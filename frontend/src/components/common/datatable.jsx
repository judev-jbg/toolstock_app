import React, { useState, useEffect } from "react";
import "./DataTable.css";

const DataTable = ({
  // Data y configuración de columnas
  data = [],
  columns = [],

  // Opciones de configuración
  loading = false,
  emptyMessage = "No hay datos disponibles",

  // Opciones de búsqueda y filtrado
  showSearch = false,
  searchPlaceholder = "Buscar...",
  searchValue = "",
  onSearch = () => {},

  // Opciones de filtros
  showFilters = false,
  filters = [],
  activeFilter = "all",
  onFilterChange = () => {},

  // Opciones de selección
  showSelection = false,
  selectedRows = [],
  onRowSelect = () => {},

  // Opciones de paginación
  showPagination = false,
  currentPage = 1,
  totalPages = 1,
  pageSize = 10,
  totalItems = 0,
  onPageChange = () => {},

  // Opciones de personalización
  className = "",
  dense = false,
  fullWidth = true,

  // Renders personalizados
  renderToolbar = null,
  renderEmptyState = null,
  renderLoadingState = null,
  renderPagination = null,
}) => {
  // Estado para manejar selección de todas las filas
  const [selectAll, setSelectAll] = useState(false);

  // Efecto para actualizar selectAll cuando cambian las filas seleccionadas
  useEffect(() => {
    if (data.length > 0 && selectedRows.length === data.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [selectedRows, data]);

  // Manejador para seleccionar/deseleccionar todas las filas
  const handleSelectAll = () => {
    if (selectAll) {
      onRowSelect([]);
    } else {
      onRowSelect(data.map((item) => item.id || item._id));
    }
    setSelectAll(!selectAll);
  };

  // Manejador para seleccionar/deseleccionar una fila
  const handleSelectRow = (id) => {
    if (selectedRows.includes(id)) {
      onRowSelect(selectedRows.filter((rowId) => rowId !== id));
    } else {
      onRowSelect([...selectedRows, id]);
    }
  };

  // Renderizar estado de carga
  const renderLoading = () => {
    if (renderLoadingState) {
      return renderLoadingState();
    }
    return (
      <div className="md-datatable-loading">
        <div className="md-datatable-loading-spinner"></div>
        <span>Cargando...</span>
      </div>
    );
  };

  // Renderizar estado vacío
  const renderEmpty = () => {
    if (renderEmptyState) {
      return renderEmptyState();
    }
    return (
      <div className="md-datatable-empty">
        <span>{emptyMessage}</span>
      </div>
    );
  };

  // Renderizar barra de herramientas (búsqueda y filtros)
  const renderTableToolbar = () => {
    if (renderToolbar) {
      return renderToolbar();
    }

    // Si no hay búsqueda ni filtros para mostrar, no renderizamos la barra
    if (!showSearch && !showFilters) {
      return null;
    }

    return (
      <div className="md-datatable-toolbar">
        {showFilters && (
          <div className="md-datatable-filters">
            {filters.map((filter) => (
              <button
                key={filter.value}
                className={`md-datatable-filter-chip ${
                  activeFilter === filter.value ? "active" : ""
                }`}
                onClick={() => onFilterChange(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}

        {showSearch && (
          <div className="md-datatable-search">
            <div className="md-datatable-search-input">
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearch(e.target.value)}
              />
              <span className="md-datatable-search-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                >
                  <path fill="none" d="M0 0h24v24H0z" />
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                </svg>
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Renderizar paginación
  const renderTablePagination = () => {
    if (!showPagination) {
      return null;
    }

    if (renderPagination) {
      return renderPagination({ currentPage, totalPages, onPageChange });
    }

    const totalPagesArray = Array.from({ length: totalPages }, (_, i) => i + 1);

    return (
      <div className="md-datatable-pagination">
        <div className="md-datatable-pagination-info">
          {`${(currentPage - 1) * pageSize + 1}-${Math.min(
            currentPage * pageSize,
            totalItems
          )} de ${totalItems}`}
        </div>

        <div className="md-datatable-pagination-controls">
          <button
            className="md-datatable-pagination-btn"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="18"
              height="18"
            >
              <path fill="none" d="M0 0h24v24H0z" />
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </button>

          {totalPagesArray.length <= 7 ? (
            totalPagesArray.map((page) => (
              <button
                key={page}
                className={`md-datatable-pagination-btn ${
                  currentPage === page ? "active" : ""
                }`}
                onClick={() => onPageChange(page)}
              >
                {page}
              </button>
            ))
          ) : (
            <>
              {currentPage > 3 && (
                <>
                  <button
                    className="md-datatable-pagination-btn"
                    onClick={() => onPageChange(1)}
                  >
                    1
                  </button>
                  <span className="md-datatable-pagination-ellipsis">...</span>
                </>
              )}

              {Array.from({ length: 5 }, (_, i) => {
                let page;
                if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }

                if (page > 0 && page <= totalPages) {
                  return (
                    <button
                      key={page}
                      className={`md-datatable-pagination-btn ${
                        currentPage === page ? "active" : ""
                      }`}
                      onClick={() => onPageChange(page)}
                    >
                      {page}
                    </button>
                  );
                }
                return null;
              })}

              {currentPage < totalPages - 2 && (
                <>
                  <span className="md-datatable-pagination-ellipsis">...</span>
                  <button
                    className="md-datatable-pagination-btn"
                    onClick={() => onPageChange(totalPages)}
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </>
          )}

          <button
            className="md-datatable-pagination-btn"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="18"
              height="18"
            >
              <path fill="none" d="M0 0h24v24H0z" />
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  // Renderizar tabla principal
  const renderTable = () => {
    // Si está cargando, mostrar indicador de carga
    if (loading) {
      return renderLoading();
    }

    // Si no hay datos, mostrar estado vacío
    if (!data || data.length === 0) {
      return renderEmpty();
    }

    return (
      <div
        className={`md-datatable-container ${fullWidth ? "full-width" : ""}`}
      >
        <table className={`md-datatable ${dense ? "dense" : ""} ${className}`}>
          <thead>
            <tr>
              {showSelection && (
                <th className="md-datatable-checkbox-cell">
                  <div className="md-checkbox">
                    <input
                      type="checkbox"
                      id="select-all"
                      checked={selectAll}
                      onChange={handleSelectAll}
                    />
                    <label htmlFor="select-all"></label>
                  </div>
                </th>
              )}

              {columns.map((column, index) => (
                <th
                  key={index}
                  className={column.className || ""}
                  style={{ width: column.width || "auto" }}
                >
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.map((row, rowIndex) => {
              const rowId = row.id || row._id || rowIndex;
              const isSelected = selectedRows.includes(rowId);

              return (
                <tr key={rowId} className={isSelected ? "selected" : ""}>
                  {showSelection && (
                    <td className="md-datatable-checkbox-cell">
                      <div className="md-checkbox">
                        <input
                          type="checkbox"
                          id={`select-row-${rowId}`}
                          checked={isSelected}
                          onChange={() => handleSelectRow(rowId)}
                        />
                        <label htmlFor={`select-row-${rowId}`}></label>
                      </div>
                    </td>
                  )}

                  {columns.map((column, colIndex) => (
                    <td key={colIndex} className={column.cellClassName || ""}>
                      {column.render
                        ? column.render(row, rowIndex)
                        : row[column.field]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Renderizar componente completo
  return (
    <div className="md-datatable-wrapper">
      {renderTableToolbar()}
      {renderTable()}
      {renderTablePagination()}
    </div>
  );
};

export default DataTable;
