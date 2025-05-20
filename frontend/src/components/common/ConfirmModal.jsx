import React from "react";
import Button from "./Button";
import "./ConfirmModal.css";

const ConfirmModal = ({ message, onConfirm, onCancel }) => {
  return (
    <div className="modal-overlay">
      <div className="confirm-modal">
        <h3>Confirmar Acción</h3>
        <p>{message}</p>
        <div className="confirm-actions">
          <Button variant="outlined" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="filled" onClick={onConfirm}>
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
