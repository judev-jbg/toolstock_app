// backend/src/middleware/excelMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configurar directorio de uploads para Excel
const uploadDir = path.join(__dirname, '../../uploads/excel');

// Crear directorio si no existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configurar almacenamiento
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'products-import-' + uniqueSuffix + ext);
  },
});

// Filtro para tipos de archivo Excel
const fileFilter = (req, file, cb) => {
  // Mimetypes válidos para archivos Excel
  const validMimetypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
  ];

  // Extensiones válidas
  const validExtensions = ['.xlsx', '.xls'];
  const fileExtension = path.extname(file.originalname).toLowerCase();

  // Verificar mimetype O extensión (algunos navegadores pueden no enviar el mimetype correcto)
  const validMimetype = validMimetypes.includes(file.mimetype);
  const validExtension = validExtensions.includes(fileExtension);

  if (validMimetype || validExtension) {
    return cb(null, true);
  }

  cb(
    new Error(
      `Solo se permiten archivos Excel (.xlsx, .xls). Recibido: ${file.mimetype} con extensión ${fileExtension}`
    )
  );
};

// Middleware de multer para Excel
const uploadExcel = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 10 }, // 10MB max
  fileFilter: fileFilter,
});

module.exports = { uploadExcel };
