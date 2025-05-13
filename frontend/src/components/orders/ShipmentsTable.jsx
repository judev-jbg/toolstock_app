import React, { useState } from "react";

const ShipmentsTable = ({ data, onExportClick }) => {
  // Definición de columnas y sus propiedades
  const columns = [
    { id: "shippingMethod", label: "Método de envío" },
    { id: "fileGenerateName", label: "Nombre" },
    {
      id: "updateDateTime",
      label: "Fecha de creación",
    },
    { id: "accion", label: "Acción" },
  ];

  const formatterRender = (columnId, value) => {
    let response = "";
    switch (columnId) {
      case "shippingMethod":
        if (value === "isFile") {
          response = "Fichero Excel";
        }
        if (value === "isWS") {
          response = "Webservice";
        }

        break;
      case "updateDateTime":
        response = formatDateTime(value);
        break;

      default:
        response = value;
        break;
    }
    return response;
  };

  const formatDateTime = (date) => {
    const fecha = new Date(date);

    // Formatear la fecha en español con el formato deseado
    const opciones = {
      weekday: "long", // día de la semana completo
      day: "numeric", // día del mes en números
      month: "short", // mes abreviado
      year: "numeric", // año completo
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    };

    // Crear un formateador con las opciones y el idioma español
    const formateador = new Intl.DateTimeFormat("es-ES", opciones);

    // Formatear la fecha
    let fechaFormateada = formateador.format(fecha);

    return fechaFormateada.replace(/de (\w+) de/, "de $1.");
  };

  const handleExportClick = (e) => {
    onExportClick(e.target.id);
  };

  // Renderizar una celda
  const renderCell = (row, column) => {
    const value = row[column.id];
    return column.id === "accion" ? (
      <span>
        {row.shippingMethod === "isWS" ? (
          <button className="button button-export button-disabled">
            Exportar ↓
          </button>
        ) : (
          <button
            id={row.fileGenerateName}
            className="button button-export "
            onClick={handleExportClick}
          >
            Exportar ↓
          </button>
        )}
      </span>
    ) : (
      <span>{formatterRender(column.id, value)}</span>
    );
  };

  return (
    <div className="table-container" style={{ marginBottom: 0 }}>
      <div
        className="table-wrapper"
        style={{ maxHeight: `calc(100vh - 200px)` }}
      >
        <table className="orders-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.id}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, indexRow) => (
              <tr key={indexRow}>
                {columns.map((column) => {
                  const rowId = `${indexRow}-${column.id}`;
                  return <td key={rowId}>{renderCell(row, column)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ShipmentsTable;
