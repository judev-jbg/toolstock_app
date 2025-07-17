import * as XLSX from "xlsx";

// Exportar datos a Excel
export const exportToExcel = (data, filename, sheetName = "Data") => {
  try {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Ajustar ancho de columnas
    const columnWidths = [];
    if (data.length > 0) {
      Object.keys(data[0]).forEach((key) => {
        const maxLength = Math.max(
          key.length,
          ...data.map((row) => String(row[key] || "").length)
        );
        columnWidths.push({ wch: Math.min(maxLength + 2, 50) });
      });
      worksheet["!cols"] = columnWidths;
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${filename}.xlsx`);

    return true;
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    return false;
  }
};

// Exportar datos a CSV
export const exportToCSV = (data, filename) => {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${filename}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    return true;
  } catch (error) {
    console.error("Error exporting to CSV:", error);
    return false;
  }
};

// Exportar datos a JSON
export const exportToJSON = (data, filename) => {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${filename}.json`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    return true;
  } catch (error) {
    console.error("Error exporting to JSON:", error);
    return false;
  }
};

// Generar reporte PDF (usando jsPDF)
export const exportToPDF = async (data, filename, title = "Reporte") => {
  try {
    // Esta función requeriría la librería jsPDF
    // Por ahora, exportamos como texto plano
    const content = `${title}\n\nGenerado: ${new Date().toLocaleString()}\n\n${JSON.stringify(
      data,
      null,
      2
    )}`;
    const blob = new Blob([content], { type: "text/plain" });
    const link = document.createElement("a");

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${filename}.txt`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    return true;
  } catch (error) {
    console.error("Error exporting to PDF:", error);
    return false;
  }
};

// Formatear datos para exportación
export const formatDataForExport = (products) => {
  return products.map((product) => ({
    "SKU ERP": product.erp_sku || "",
    "SKU Amazon": product.amz_sellerSku || "",
    ASIN: product.amz_asin || "",
    Título: product.amz_title || product.erp_name || "",
    Marca: product.amz_brand || product.erp_manufacturer || "",
    "Precio Amazon": product.amz_price || 0,
    "Precio ERP": product.erp_price || 0,
    "Costo ERP": product.erp_cost || 0,
    "Stock Amazon": product.amz_quantity || 0,
    "Stock ERP": product.erp_stock || 0,
    "Estado Amazon": product.amz_status || "",
    "Estado ERP": product.erp_status === 1 ? "Activo" : "Inactivo",
    "Última Sincronización": product.amz_lastSyncAt
      ? new Date(product.amz_lastSyncAt).toLocaleString()
      : "Nunca",
    "Fecha Creación": product.createdAt
      ? new Date(product.createdAt).toLocaleString()
      : "",
    "Fecha Actualización": product.updatedAt
      ? new Date(product.updatedAt).toLocaleString()
      : "",
  }));
};

// Formatear datos de usuarios para exportación
export const formatUsersForExport = (users) => {
  return users.map((user) => ({
    ID: user._id,
    Nombre: user.name,
    Email: user.email,
    Rol: user.role,
    Estado: user.active ? "Activo" : "Inactivo",
    "Fecha Creación": new Date(user.createdAt).toLocaleString(),
    "Última Actualización": new Date(user.updatedAt).toLocaleString(),
  }));
};
