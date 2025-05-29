// frontend/src/components/catalog/ImportExcelModal.jsx
import React, { useState, useRef } from "react";
import { MdUpload, MdDownload, MdWarning, MdClose } from "react-icons/md";
import Button from "../common/Button";
import "./ImportExcelModal.css";

const ImportExcelModal = ({ onClose, onImport, loading }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Manejar selección de archivo
  const handleFileSelect = (file) => {
    if (
      file &&
      (file.type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === "application/vnd.ms-excel" ||
        file.name.endsWith(".xlsx") ||
        file.name.endsWith(".xls"))
    ) {
      setSelectedFile(file);
    } else {
      alert("Por favor selecciona un archivo Excel válido (.xlsx o .xls)");
    }
  };

  // Manejar drag & drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Manejar click en input
  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  // Manejar importación
  const handleImport = () => {
    if (selectedFile) {
      onImport(selectedFile);
    }
  };

  // Descargar plantilla
  const handleDownloadTemplate = () => {
    // Esta función se implementará en el servicio API
    window.open("/api/products/import/template", "_blank");
  };

  return (
    <div className="modal-overlay">
      <div className="import-excel-modal">
        <div className="modal-header">
          <h2>
            <MdUpload />
            Importar Productos desde Excel
          </h2>
          <button className="modal-close" onClick={onClose}>
            <MdClose />
          </button>
        </div>

        <div className="modal-content">
          {/* Información importante */}
          <div className="import-info">
            <div className="info-section">
              <h3>Instrucciones de importación:</h3>
              <ul>
                <li>El archivo debe ser un Excel (.xlsx o .xls)</li>
                <li>
                  La primera fila debe contener los nombres de las columnas
                </li>
                <li>
                  La columna <strong>idTool</strong> es obligatoria y servirá
                  como identificador único
                </li>
                <li>
                  Los productos existentes se actualizarán, los nuevos se
                  crearán
                </li>
                <li>
                  Después de la importación se sincronizarán automáticamente con
                  Amazon
                </li>
              </ul>
            </div>

            <div className="columns-info">
              <h4>Columnas esperadas:</h4>
              <div className="columns-grid">
                <div className="column-item">
                  <strong>idTool</strong> - Código único del producto
                </div>
                <div className="column-item">
                  <strong>Descripcion</strong> - Nombre del producto
                </div>
                <div className="column-item">
                  <strong>IdArticuloProv</strong> - SKU del proveedor
                </div>
                <div className="column-item">
                  <strong>MarcaDescrip</strong> - Marca/Fabricante
                </div>
                <div className="column-item">
                  <strong>PrecioCompra</strong> - Precio de compra
                </div>
                <div className="column-item">
                  <strong>PVP</strong> - Precio de venta
                </div>
                <div className="column-item">
                  <strong>CodBarras</strong> - Código de barras
                </div>
                <div className="column-item">
                  <strong>Observaciones</strong> - Notas adicionales
                </div>
                <div className="column-item">
                  <strong>Estado</strong> - Estado del producto (1=activo,
                  0=inactivo)
                </div>
                <div className="column-item">
                  <strong>Peso</strong> - Peso en kg
                </div>
                <div className="column-item">
                  <strong>Stock</strong> - Cantidad en stock
                </div>
              </div>
            </div>
          </div>

          {/* Descargar plantilla */}
          <div className="template-section">
            <Button
              variant="outlined"
              icon={<MdDownload />}
              onClick={handleDownloadTemplate}
            >
              Descargar Plantilla de Ejemplo
            </Button>
          </div>

          {/* Área de subida de archivo */}
          <div
            className={`file-upload-area ${dragActive ? "drag-active" : ""} ${
              selectedFile ? "file-selected" : ""
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileInputChange}
              style={{ display: "none" }}
            />

            {selectedFile ? (
              <div className="selected-file">
                <MdUpload className="file-icon" />
                <div className="file-info">
                  <div className="file-name">{selectedFile.name}</div>
                  <div className="file-size">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
                <button
                  className="remove-file"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="upload-placeholder">
                <MdUpload className="upload-icon" />
                <p>
                  <strong>Arrastra tu archivo Excel aquí</strong>
                </p>
                <p>o haz clic para seleccionar</p>
                <small>Formatos soportados: .xlsx, .xls (máx. 10MB)</small>
              </div>
            )}
          </div>

          {/* Advertencia */}
          <div className="warning-message">
            <MdWarning />
            <span>
              Esta acción puede crear o modificar múltiples productos. Asegúrate
              de que los datos sean correctos antes de proceder. El proceso
              incluye sincronización automática con Amazon.
            </span>
          </div>
        </div>

        {/* Acciones del modal */}
        <div className="modal-actions">
          <Button variant="outlined" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="filled"
            onClick={handleImport}
            disabled={!selectedFile || loading}
          >
            {loading ? "Importando..." : "Importar Productos"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImportExcelModal;
