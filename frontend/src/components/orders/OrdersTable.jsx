import React, { useState, useRef, useEffect } from "react";

const OrdersTable = ({ data, onCellUpdate }) => {
  const [editCell, setEditCell] = useState({
    rowId: null,
    column: null,
    value: "",
    originalValue: "",
  });
  const [validationStatus, setValidationStatus] = useState(true);
  const [cellValidationMap, setCellValidationMap] = useState({});
  const inputRef = useRef(null);
  const tableRef = useRef(null);

  // Definición de columnas y sus propiedades
  const columns = [
    { id: "servicio", label: "Servicio", editable: false },
    { id: "horario", label: "Horario", editable: false },
    {
      id: "destinatario",
      label: "Destinatario",
      editable: true,
      maxLength: 40,
    },
    { id: "direccion", label: "Dirección", editable: true, maxLength: 80 },
    { id: "pais", label: "País", editable: false },
    { id: "cp", label: "CP", editable: true, maxLength: 10 },
    { id: "poblacion", label: "Población", editable: true, maxLength: 80 },
    { id: "telefono", label: "Teléfono", editable: true, maxLength: 15 },
    { id: "email", label: "Email", editable: true, maxLength: 255 },
    {
      id: "departamento",
      label: "Departamento",
      editable: true,
      maxLength: 40,
    },
    { id: "contacto", label: "Contacto", editable: true, maxLength: 40 },
    {
      id: "observaciones",
      label: "Observaciones",
      editable: true,
      maxLength: 98,
    },
    // { id: "bultos", label: "Bultos", editable: false },
    // { id: "peso", label: "Peso", editable: false },
    { id: "movil", label: "Móvil", editable: true, maxLength: 15 },
    { id: "refC", label: "RefC", editable: true, maxLength: 14 },
  ];

  // Validar todos los datos al cargar el componente
  useEffect(() => {
    const newValidationMap = {};

    data.forEach((row) => {
      const rowId = row.idOrder || row.id;

      columns.forEach((column) => {
        if (column.editable) {
          const cellKey = `${rowId}-${column.id}`;
          const value = row[column.id] || "";
          newValidationMap[cellKey] = validateInput(column.id, value);
        }
      });
    });

    setCellValidationMap(newValidationMap);
  }, [data]);

  // Enfocar el input cuando se activa la edición
  useEffect(() => {
    if (editCell.rowId && editCell.column && inputRef.current) {
      const content = editCell.value;
      const widthEstimated = Math.max(100, content.length * 8);
      inputRef.current.style.width = `${widthEstimated}px`;
      inputRef.current.focus();
    }
  }, [editCell]);

  // Manejar clic fuera del input para cerrar
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (inputRef.current && !inputRef.current.contains(event.target)) {
        cancelEdit();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [editCell]);

  // Manejar doble clic en una celda
  const handleCellDoubleClick = (rowId, column, value) => {
    // Solo permitir edición en columnas editables
    const columnDef = columns.find((col) => col.id === column);
    if (columnDef && columnDef.editable) {
      setEditCell({
        rowId,
        column,
        value: value || "",
        originalValue: value || "",
      });
      // Validar el valor actual
      const isValid = validateInput(column, value);
      setValidationStatus(isValid);
    }
  };

  // Validar entrada según la columna
  const validateInput = (column, value) => {
    const columnDef = columns.find((col) => col.id === column);
    if (!columnDef) return true;

    // Verificar longitud máxima
    if (columnDef.maxLength && value.length > columnDef.maxLength) {
      console.log("No cumple la logitud");
      return false;
    }

    // Aquí puedes añadir más validaciones específicas por columna si es necesario
    switch (column) {
      case "telefono":
      case "movil":
        // Solo permitir números y algunos caracteres especiales
        return /^[0-9+\-\s]*$/.test(value);
      case "cp":
        // Permitir alfanuméricos y guiones para códigos postales internacionales
        return /^[0-9a-zA-Z\-\s]*$/.test(value);
      default:
        return true;
    }
  };

  // Manejar cambios en el input
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setEditCell((prev) => ({
      ...prev,
      value: newValue,
    }));

    // Validar el nuevo valor
    const isValid = validateInput(editCell.column, newValue);
    setValidationStatus(isValid);
  };

  // Manejar teclas (Enter para guardar, Escape para cancelar)
  const handleKeyDown = async (e) => {
    if (e.key === "Escape") {
      cancelEdit();
    } else if (e.key === "Enter") {
      if (editCell.value === editCell.originalValue) {
        // Si no hay cambios, simplemente cancelar
        cancelEdit();
      } else if (validationStatus) {
        // Si hay cambios y son válidos, guardar
        await saveEdit();
      }
    }
  };

  // Cancelar la edición
  const cancelEdit = () => {
    setEditCell({ rowId: null, column: null, value: "", originalValue: "" });
    setValidationStatus(true);
  };

  // Guardar la edición
  const saveEdit = async () => {
    if (!validationStatus) return;

    const success = await onCellUpdate(
      editCell.rowId,
      columns.find((col) => col.id === editCell.column)?.id || editCell.column,
      editCell.value
    );

    if (success) {
      cancelEdit();
    }
  };

  // Renderizar una celda (normal o con input)
  const renderCell = (row, column) => {
    const rowId = row.idOrder || row.id;
    const isEditing = editCell.rowId === rowId && editCell.column === column.id;

    const value = row[column.id];
    const cellKey = `${rowId}-${column.id}`;
    const isValid = cellValidationMap[cellKey];

    if (isEditing) {
      return (
        <input
          ref={inputRef}
          type="text"
          value={editCell.value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className={validationStatus ? "valid-input" : "invalid-input"}
          onDoubleClick={(e) => {
            e.stopPropagation();
          }}
        />
      );
    }

    // Para celdas editables, añadir clase según la validación
    const cellClass = column.editable
      ? `cell-data ${column.id} ${isValid === false ? "invalid-cell" : ""}`
      : "";

    return <span className={cellClass}>{value}</span>;
  };

  return (
    <div className="table-container">
      <div className="table-wrapper" ref={tableRef}>
        <table className="orders-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.id}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.idOrder || row.id}>
                {columns.map((column) => {
                  const rowId = row.idOrder || row.id;
                  const cellKey = `${rowId}-${column.id}`;
                  const isValid = cellValidationMap[cellKey];
                  const isCurrentlyEditing =
                    editCell.rowId === rowId && editCell.column === column.id;

                  return (
                    <td
                      key={cellKey}
                      {...(!isCurrentlyEditing
                        ? {
                            onDoubleClick: () =>
                              handleCellDoubleClick(
                                rowId,
                                column.id,
                                row[column.id]
                              ),
                          }
                        : {})}
                      className={
                        column.editable
                          ? isValid === false
                            ? `editable-cell invalid-cell`
                            : `editable-cell`
                          : ``
                      }
                    >
                      {renderCell(row, column)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrdersTable;
