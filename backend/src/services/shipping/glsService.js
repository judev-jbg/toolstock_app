const axios = require('axios');
const FormData = require('form-data');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');

/**
 * Servicio para integración con GLS WebService
 */
class GLSService {
  constructor() {
    this.baseUrl =
      process.env.GLS_API_URL || 'https://wsrecogida.gls-spain.es/ImprimirEtiqueta.asmx';
    this.username = process.env.GLS_USERNAME;
    this.password = process.env.GLS_PASSWORD;
    this.agencyCode = process.env.GLS_AGENCY_CODE;
    this.clientCode = process.env.GLS_CLIENT_CODE;

    this.parser = new xml2js.Parser({ explicitArray: false });
    this.builder = new xml2js.Builder();
  }

  /**
   * Crea un envío en GLS
   * @param {Object} shipment - Datos del envío
   * @returns {Promise<Object>} Resultado de la creación del envío
   */
  async createShipment(shipment) {
    try {
      // Preparar datos para el servicio SOAP
      const soapEnvelope = `
        <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:imp="http://wsrecogida.gls-spain.es/">
          <soap:Header/>
          <soap:Body>
            <imp:GrabaServicios>
              <imp:usuario>${this.username}</imp:usuario>
              <imp:password>${this.password}</imp:password>
              <imp:código_agencia>${this.agencyCode}</imp:código_agencia>
              <imp:código_cliente>${this.clientCode}</imp:código_cliente>
              <imp:servicios>
                <imp:Servicio>
                  <imp:servicio>${shipment.servicio || 37}</imp:servicio>
                  <imp:horario>${shipment.horario || 3}</imp:horario>
                  <imp:destinatario>${shipment.destinatario}</imp:destinatario>
                  <imp:dirección>${shipment.direccion}</imp:dirección>
                  <imp:población>${shipment.poblacion}</imp:población>
                  <imp:código_postal>${shipment.cp}</imp:código_postal>
                  <imp:país>${shipment.pais || 'ES'}</imp:país>
                  <imp:teléfono>${shipment.telefono}</imp:teléfono>
                  <imp:email>${shipment.email || 'orders@toolstock.info'}</imp:email>
                  <imp:observaciones>${shipment.observaciones || ''}</imp:observaciones>
                  <imp:referencia_c>${shipment.refC || ''}</imp:referencia_c>
                  <imp:bultos>${shipment.bultos || 1}</imp:bultos>
                  <imp:paquetes>${shipment.bultos || 1}</imp:paquetes>
                  <imp:departamento>${shipment.departamento || ''}</imp:departamento>
                  <imp:contacto>${shipment.contacto || ''}</imp:contacto>
                  <imp:móvil>${shipment.movil || ''}</imp:móvil>
                </imp:Servicio>
              </imp:servicios>
            </imp:GrabaServicios>
          </soap:Body>
        </soap:Envelope>
      `;

      // Enviar solicitud SOAP
      const response = await axios.post(this.baseUrl, soapEnvelope, {
        headers: {
          'Content-Type': 'application/soap+xml;charset=UTF-8',
          SOAPAction: 'http://wsrecogida.gls-spain.es/GrabaServicios',
        },
      });

      // Procesar respuesta XML
      const result = await this.parseXML(response.data);

      // Extraer los datos relevantes de la respuesta
      const grabaServiciosResult =
        result['soap:Envelope']['soap:Body']['GrabaServiciosResponse']['GrabaServiciosResult'];

      if (grabaServiciosResult && grabaServiciosResult.resultado === 'OK') {
        // Extraer número de expedición
        const expeditionNumber = grabaServiciosResult.servicios.Servicio.albaran;

        return {
          success: true,
          expeditionNumber,
          message: 'Envío creado correctamente',
          rawResponse: grabaServiciosResult,
        };
      } else {
        // Error en la creación del envío
        return {
          success: false,
          message: grabaServiciosResult.mensaje || 'Error al crear el envío',
          rawResponse: grabaServiciosResult,
        };
      }
    } catch (error) {
      console.error('Error creating GLS shipment:', error);
      throw error;
    }
  }

  /**
   * Obtiene la etiqueta de un envío
   * @param {string} expeditionNumber - Número de expedición
   * @returns {Promise<Object>} Resultado con la URL de la etiqueta
   */
  async getShipmentLabel(expeditionNumber) {
    try {
      // Preparar datos para el servicio SOAP
      const soapEnvelope = `
        <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:imp="http://wsrecogida.gls-spain.es/">
          <soap:Header/>
          <soap:Body>
            <imp:ObtenerEtiqueta>
              <imp:usuario>${this.username}</imp:usuario>
              <imp:password>${this.password}</imp:password>
              <imp:código_agencia>${this.agencyCode}</imp:código_agencia>
              <imp:código_cliente>${this.clientCode}</imp:código_cliente>
              <imp:albaran>${expeditionNumber}</imp:albaran>
              <imp:tipo_etiqueta>PDF</imp:tipo_etiqueta>
            </imp:ObtenerEtiqueta>
          </soap:Body>
        </soap:Envelope>
      `;

      // Enviar solicitud SOAP
      const response = await axios.post(this.baseUrl, soapEnvelope, {
        headers: {
          'Content-Type': 'application/soap+xml;charset=UTF-8',
          SOAPAction: 'http://wsrecogida.gls-spain.es/ObtenerEtiqueta',
        },
      });

      // Procesar respuesta XML
      const result = await this.parseXML(response.data);

      // Extraer los datos relevantes de la respuesta
      const obtenerEtiquetaResult =
        result['soap:Envelope']['soap:Body']['ObtenerEtiquetaResponse']['ObtenerEtiquetaResult'];

      if (obtenerEtiquetaResult && obtenerEtiquetaResult.resultado === 'OK') {
        // Si la respuesta contiene la etiqueta en base64
        if (obtenerEtiquetaResult.pdf) {
          // Guardar la etiqueta en un archivo
          const etiquetasDir = path.join(__dirname, '../../../exports/etiquetas');

          // Crear directorio si no existe
          if (!fs.existsSync(etiquetasDir)) {
            fs.mkdirSync(etiquetasDir, { recursive: true });
          }

          const filePath = path.join(etiquetasDir, `etiqueta_${expeditionNumber}.pdf`);

          // Guardar el PDF
          fs.writeFileSync(filePath, obtenerEtiquetaResult.pdf, { encoding: 'base64' });

          return {
            success: true,
            filePath,
            fileName: `etiqueta_${expeditionNumber}.pdf`,
            message: 'Etiqueta obtenida correctamente',
          };
        } else {
          return {
            success: false,
            message: 'No se encontró la etiqueta en la respuesta',
          };
        }
      } else {
        // Error al obtener la etiqueta
        return {
          success: false,
          message: obtenerEtiquetaResult.mensaje || 'Error al obtener la etiqueta',
          rawResponse: obtenerEtiquetaResult,
        };
      }
    } catch (error) {
      console.error('Error getting GLS shipment label:', error);
      throw error;
    }
  }

  /**
   * Obtiene el estado de un envío
   * @param {string} expeditionNumber - Número de expedición
   * @param {string} postalCode - Código postal del destino
   * @returns {Promise<Object>} Estado del envío
   */
  async getShipmentStatus(expeditionNumber, postalCode) {
    try {
      // Preparar datos para el servicio SOAP
      const soapEnvelope = `
        <soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:imp="http://wsrecogida.gls-spain.es/">
          <soap:Header/>
          <soap:Body>
            <imp:ObtenerEstado>
              <imp:usuario>${this.username}</imp:usuario>
              <imp:password>${this.password}</imp:password>
              <imp:albaran>${expeditionNumber}</imp:albaran>
              <imp:codigo_postal>${postalCode}</imp:codigo_postal>
            </imp:ObtenerEstado>
          </soap:Body>
        </soap:Envelope>
      `;

      // Enviar solicitud SOAP
      const response = await axios.post(this.baseUrl, soapEnvelope, {
        headers: {
          'Content-Type': 'application/soap+xml;charset=UTF-8',
          SOAPAction: 'http://wsrecogida.gls-spain.es/ObtenerEstado',
        },
      });

      // Procesar respuesta XML
      const result = await this.parseXML(response.data);

      // Extraer los datos relevantes de la respuesta
      const obtenerEstadoResult =
        result['soap:Envelope']['soap:Body']['ObtenerEstadoResponse']['ObtenerEstadoResult'];

      if (obtenerEstadoResult && obtenerEstadoResult.resultado === 'OK') {
        return {
          success: true,
          status: obtenerEstadoResult.estados.Estado,
          message: 'Estado obtenido correctamente',
          rawResponse: obtenerEstadoResult,
        };
      } else {
        // Error al obtener el estado
        return {
          success: false,
          message: obtenerEstadoResult.mensaje || 'Error al obtener el estado del envío',
          rawResponse: obtenerEstadoResult,
        };
      }
    } catch (error) {
      console.error('Error getting GLS shipment status:', error);
      throw error;
    }
  }

  /**
   * Genera un fichero CSV para importación masiva de envíos
   * @param {Array} shipments - Lista de envíos
   * @returns {Promise<string>} Ruta al archivo generado
   */
  async generateShipmentsCsv(shipments) {
    try {
      // Crear directorio si no existe
      const exportsDir = path.join(__dirname, '../../../exports');
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      // Nombre del archivo
      const filename = `envios_gls_${new Date().toISOString().replace(/:/g, '-')}.csv`;
      const filePath = path.join(exportsDir, filename);

      // Cabecera del CSV (según formato GLS)
      const csvHeader =
        'servicio;horario;destinatario;direccion;pais;cp;poblacion;telefono;email;departamento;contacto;observaciones;bultos;movil;refC\n';

      // Generar filas
      const csvRows = shipments
        .map((shipment) => {
          return [
            shipment.servicio || 37,
            shipment.horario || 3,
            shipment.destinatario,
            shipment.direccion,
            shipment.pais || 'ES',
            shipment.cp,
            shipment.poblacion,
            shipment.telefono,
            shipment.email || 'orders@toolstock.info',
            shipment.departamento || '',
            shipment.contacto || '',
            shipment.observaciones || '',
            shipment.bultos || 1,
            shipment.movil || '',
            shipment.refC || '',
          ].join(';');
        })
        .join('\n');

      // Escribir el archivo
      fs.writeFileSync(filePath, csvHeader + csvRows);

      return filePath;
    } catch (error) {
      console.error('Error generating GLS shipments CSV:', error);
      throw error;
    }
  }

  /**
   * Analiza una respuesta XML a objeto JavaScript
   * @param {string} xml - Contenido XML
   * @returns {Promise<Object>} Objeto JavaScript
   */
  async parseXML(xml) {
    return new Promise((resolve, reject) => {
      this.parser.parseString(xml, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  async generateShipmentsExcel(shipments) {
    try {
      const XLSX = require('xlsx');

      // Preparar datos para el Excel
      const data = shipments.map((shipment) => ({
        servicio: shipment.servicio || 37,
        horario: shipment.horario || 3,
        destinatario: shipment.destinatario,
        direccion: shipment.direccion,
        pais: shipment.pais,
        cp: shipment.cp,
        poblacion: shipment.poblacion,
        telefono: shipment.telefono || '',
        email: shipment.email || 'orders@toolstock.info',
        departamento: shipment.departamento || '',
        contacto: shipment.contacto || '',
        observaciones: shipment.observaciones || '',
        bultos: shipment.bultos || 1,
        movil: shipment.movil || '',
        refC: shipment.refC || '',
      }));

      // Crear libro Excel
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(data);

      // Añadir hoja al libro
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Envios');

      // Crear buffer para devolver
      const excelBuffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      });

      return {
        buffer: excelBuffer,
        fileName: `GLS_Shipments_${new Date().toISOString().replace(/:/g, '-')}.xlsx`,
      };
    } catch (error) {
      console.error('Error generating Excel:', error);
      throw error;
    }
  }
}

module.exports = new GLSService();
