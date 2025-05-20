import React, { useState, useRef } from "react";
import { MdPhotoCamera, MdAccountCircle } from "react-icons/md";
import Button from "../common/Button";

const AvatarUpload = ({
  currentAvatar,
  onAvatarChange,
  loading,
  updateAvatar,
}) => {
  const [preview, setPreview] = useState(null);
  // const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  // Manejar cambio de archivo
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
    if (!validTypes.includes(file.type)) {
      alert("Por favor selecciona una imagen válida (jpeg, jpg, png, gif)");
      return;
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("La imagen no debe superar los 5MB");
      return;
    }

    // Crear preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Enviar archivo al padre
    onAvatarChange(file);
  };

  // Trigger click en input file
  const handleButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleConfirm = () => {
    updateAvatar();
  };

  const handleCancel = () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Generar URL de avatar actual
  const avatarUrl = currentAvatar
    ? `http://localhost:4000/uploads/avatars/${currentAvatar}`
    : null;

  return (
    <div className="avatar-upload">
      <div className="avatar-container">
        {preview || avatarUrl ? (
          <img
            src={preview || avatarUrl}
            alt="Avatar"
            className="avatar-preview"
          />
        ) : (
          <div className="avatar-placeholder">
            <MdAccountCircle size={150} />
          </div>
        )}

        <button
          type="button"
          className="avatar-edit-button"
          onClick={handleButtonClick}
          disabled={loading}
        >
          <MdPhotoCamera />
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/jpg,image/png,image/gif"
        style={{ display: "none" }}
      />

      {preview && (
        <div className="avatar-actions">
          <Button
            variant="outlined"
            onClick={handleCancel}
            disabled={loading}
            size="small"
          >
            Cancelar
          </Button>
          <Button
            variant="filled"
            onClick={handleConfirm}
            disabled={loading}
            size="small"
          >
            Confirmar
          </Button>
        </div>
      )}
    </div>
  );
};

export default AvatarUpload;
