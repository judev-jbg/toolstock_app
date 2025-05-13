const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * Generates an Excel file with the given data
 * @param {Array} data - Array of objects to export
 * @param {string} fileName - Name of the file to generate
 * @param {string} sheetName - Name of the sheet
 * @returns {string} - Path to the generated file
 */
const generateExcel = (data, fileName, sheetName = 'Sheet1') => {
  // Create directory if it doesn't exist
  const exportsDir = path.join(__dirname, '../../exports');
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true });
  }

  const filePath = path.join(exportsDir, fileName);

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Write to file
  XLSX.writeFile(workbook, filePath);

  return filePath;
};

module.exports = { generateExcel };
