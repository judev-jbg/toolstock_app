// frontend/src/components/catalog/ImportProductsModal.jsx
import React, { useState } from "react";
import { FaFileExcel, FaUpload, FaSync } from "react-icons/fa";
import Button from "../common/Button";
import "./ImportProductsModal.css";

const ImportProductsModal = ({ onClose, onImport, loading }) => {
  const [file, setFile] = useState(null);
  const [updateAll, setUpdateAll] = useState(false);
  const [error, setError] = useState("");
  const [fileDropActive, setFileDropActive] = useState(false);

  // Manejar selección de archivo
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    validateFile(selectedFile);
  };

  // Validar archivo seleccionado
  const validateFile = (selectedFile) => {
    if (!selectedFile) {
      setFile(null);
      return;
    }

    // Verificar tipo de archivo (Excel)
    const validTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.oasis.opendocument.spreadsheet",
    ];

    if (!validTypes.includes(selectedFile.type)) {
      setError("Por favor selecciona un archivo Excel válido (.xls o .xlsx)");
      setFile(null);
      return;
    }

    // Verificar tamaño (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("El archivo es demasiado grande (máximo 10MB)");
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setError("");
  };

  // Manejar drag & drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setFileDropActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setFileDropActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setFileDropActive(false);
    const droppedFile = e.dataTransfer.files[0];
    validateFile(droppedFile);
  };

  // Manejar envío del formulario
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!file) {
      setError("Por favor selecciona un archivo");
      return;
    }

    onImport(file, updateAll);
  };

  return (
    <div className="modal-overlay">
      <div className="import-modal">
        <div className="modal-header">
          <h2>
            <FaFileExcel /> Importar Productos desde ERP
          </h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="import-form" onSubmit={handleSubmit}>
          {error && <div className="import-error">{error}</div>}

          <div
            className={`file-drop-area ${fileDropActive ? "active" : ""} ${
              file ? "has-file" : ""
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="file-message">
              {file ? (
                <>
                  <FaFileExcel className="file-icon" />
                  <div className="file-name">{file.name}</div>
                  <div className="file-size">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </>
              ) : (
                <>
                  <FaUpload className="upload-icon" />
                  <p>Arrastra un archivo Excel o haz clic para seleccionarlo</p>
                  <p className="file-help">
                    Exporta la base de productos desde el ERP como Excel
                  </p>
                </>
              )}
            </div>

            <input
              type="file"
              accept=".xls,.xlsx,.ods"
              onChange={handleFileChange}
              className="file-input"
            />
          </div>

          <div className="import-options">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={updateAll}
                onChange={(e) => setUpdateAll(e.target.checked)}
              />
              <span className="checkbox-label">
                Actualizar todos los productos existentes
              </span>
            </label>
            <p className="option-description">
              Si esta opción está desactivada, solo se importarán productos
              nuevos sin modificar los existentes
            </p>
          </div>

          <div className="modal-actions">
            <Button
              type="button"
              variant="outlined"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!file || loading}
              icon={loading ? <FaSync className="fa-spin" /> : <FaUpload />}
            >
              {loading ? "Importando..." : "Importar Productos"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ImportProductsModal;
