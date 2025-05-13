// backend/src/services/shipping/glsService.js (actualización)

const axios = require('axios');
const FormData = require('form-data');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const Order = require('../../models/orderModel');
const Shipment = require('../../models/shipmentModel');
const { createLogger } = require('../../utils/logger');

const logger = createLogger('glsService');

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

    // Verificar que tenemos las credenciales configuradas
    if (!this.username || !this.password || !this.agencyCode || !this.clientCode) {
      logger.warn('Credenciales de GLS no configuradas correctamente.');
    }
  }

  /**
   * Crea un envío en GLS
   * @param {Object} shipment - Datos del envío
   * @returns {Promise<Object>} Resultado de la creación del envío
   */
  async createShipment(shipment) {
    try {
      logger.info(`Creando envío GLS para: ${shipment.destinatario}`);

      // Validar datos mínimos requeridos
      this._validateShipmentData(shipment);

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
                  <imp:teléfono>${shipment.telefono || ''}</imp:teléfono>
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
        logger.info(`Envío creado correctamente. Expedición: ${expeditionNumber}`);

        // Si este envío está relacionado con un pedido, actualizar el pedido
        if (shipment.idOrder) {
          await this._updateOrder(shipment.idOrder, expeditionNumber);
        }

        // Registrar el envío en nuestra base de datos
        await this._createShipmentRecord(shipment, expeditionNumber);

        return {
          success: true,
          expeditionNumber,
          message: 'Envío creado correctamente',
          rawResponse: grabaServiciosResult,
        };
      } else {
        // Error en la creación del envío
        const errorMsg = grabaServiciosResult?.mensaje || 'Error al crear el envío';
        logger.error(`Error en GLS: ${errorMsg}`);
        return {
          success: false,
          message: errorMsg,
          rawResponse: grabaServiciosResult,
        };
      }
    } catch (error) {
      logger.error(`Error creando envío GLS: ${error.message}`);
      throw new Error(`Error creando envío GLS: ${error.message}`);
    }
  }

  /**
   * Valida los datos del envío
   * @param {Object} shipment - Datos del envío
   * @throws {Error} Si faltan datos requeridos
   */
  _validateShipmentData(shipment) {
    const requiredFields = ['destinatario', 'direccion', 'cp', 'poblacion'];
    const missingFields = requiredFields.filter((field) => !shipment[field]);

    if (missingFields.length > 0) {
      const errorMsg = `Faltan datos requeridos para el envío: ${missingFields.join(', ')}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * Actualiza el pedido con los datos del envío
   * @param {string} orderId - ID del pedido
   * @param {string} expeditionNumber - Número de expedición
   * @returns {Promise<void>}
   */
  async _updateOrder(orderId, expeditionNumber) {
    try {
      logger.info(`Actualizando pedido ${orderId} con expedición ${expeditionNumber}`);

      const order = await Order.findOne({
        $or: [{ amazonOrderId: orderId }, { prestashopOrderId: orderId }, { _id: orderId }],
      });

      if (!order) {
        logger.warn(`No se encontró el pedido ${orderId} para actualizar`);
        return;
      }

      // Actualizar el pedido
      order.expeditionTraking = expeditionNumber;
      order.orderStatus = 'Enviado';
      order.markForShipment = false;
      order.dateShip = new Date();

      await order.save();
      logger.info(`Pedido ${orderId} actualizado correctamente`);
    } catch (error) {
      logger.error(`Error actualizando pedido ${orderId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Crea un registro de envío en la base de datos
   * @param {Object} shipment - Datos del envío
   * @param {string} expeditionNumber - Número de expedición
   * @returns {Promise<void>}
   */
  async _createShipmentRecord(shipment, expeditionNumber) {
    try {
      // Crear o actualizar registro de envío
      const shipmentRecord = await Shipment.findOne({
        idOrder: shipment.idOrder,
      });

      if (shipmentRecord) {
        // Actualizar registro existente
        shipmentRecord.expeditionNumber = expeditionNumber;
        shipmentRecord.exported = true;
        shipmentRecord.updateDateTime = new Date();
        await shipmentRecord.save();
      } else {
        // Crear nuevo registro
        await Shipment.create({
          idOrder: shipment.idOrder,
          servicio: shipment.servicio || 37,
          horario: shipment.horario || 3,
          destinatario: shipment.destinatario,
          direccion: shipment.direccion,
          pais: shipment.pais || 'ES',
          cp: shipment.cp,
          poblacion: shipment.poblacion,
          telefono: shipment.telefono,
          email: shipment.email || 'orders@toolstock.info',
          departamento: shipment.departamento,
          contacto: shipment.contacto,
          observaciones: shipment.observaciones,
          bultos: shipment.bultos || 1,
          peso: shipment.peso || 1,
          movil: shipment.movil,
          refC: shipment.refC,
          process: 'isWS', // Procesado via Web Service
          exported: true,
          engraved: true,
          updateDateTime: new Date(),
          expeditionNumber: expeditionNumber,
        });
      }
    } catch (error) {
      logger.error(`Error creando registro de envío: ${error.message}`);
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
      logger.info(`Obteniendo etiqueta para expedición ${expeditionNumber}`);

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

          logger.info(`Etiqueta guardada: ${filePath}`);

          return {
            success: true,
            filePath,
            fileName: `etiqueta_${expeditionNumber}.pdf`,
            message: 'Etiqueta obtenida correctamente',
          };
        } else {
          const errorMsg = 'No se encontró la etiqueta en la respuesta';
          logger.error(errorMsg);
          return {
            success: false,
            message: errorMsg,
          };
        }
      } else {
        // Error al obtener la etiqueta
        const errorMsg = obtenerEtiquetaResult?.mensaje || 'Error al obtener la etiqueta';
        logger.error(`Error obteniendo etiqueta: ${errorMsg}`);
        return {
          success: false,
          message: errorMsg,
          rawResponse: obtenerEtiquetaResult,
        };
      }
    } catch (error) {
      logger.error(`Error obteniendo etiqueta GLS: ${error.message}`);
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
      logger.info(`Consultando estado de expedición ${expeditionNumber}`);

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
        logger.info(`Estado obtenido correctamente para expedición ${expeditionNumber}`);

        // Actualizar el estado en nuestra base de datos si corresponde
        await this._updateShipmentStatus(expeditionNumber, obtenerEstadoResult.estados);

        return {
          success: true,
          status: obtenerEstadoResult.estados.Estado,
          message: 'Estado obtenido correctamente',
          rawResponse: obtenerEstadoResult,
        };
      } else {
        // Error al obtener el estado
        const errorMsg = obtenerEstadoResult?.mensaje || 'Error al obtener el estado del envío';
        logger.error(`Error obteniendo estado: ${errorMsg}`);
        return {
          success: false,
          message: errorMsg,
          rawResponse: obtenerEstadoResult,
        };
      }
    } catch (error) {
      logger.error(`Error obteniendo estado GLS: ${error.message}`);
      throw error;
    }
  }

  /**
   * Actualiza el estado del envío en nuestra base de datos
   * @param {string} expeditionNumber - Número de expedición
   * @param {Object} statusData - Datos del estado
   * @returns {Promise<void>}
   */
  async _updateShipmentStatus(expeditionNumber, statusData) {
    try {
      // Buscar pedidos con este número de expedición
      const orders = await Order.find({ expeditionTraking: expeditionNumber });

      if (orders.length === 0) {
        logger.warn(`No se encontraron pedidos con expedición ${expeditionNumber}`);
        return;
      }

      // Mapear los estados de GLS a nuestros estados
      const statusMapping = {
        ENTREGADO: 'Entregado',
        'EN REPARTO': 'En tránsito',
        'EN TRANSITO': 'En tránsito',
        RECOGIDO: 'Enviado',
        INCIDENCIA: 'Pendiente disponibilidad',
      };

      // Obtener el estado más reciente
      let lastStatus = null;
      let lastDate = null;

      if (Array.isArray(statusData.Estado)) {
        // Múltiples estados, obtener el más reciente
        for (const estado of statusData.Estado) {
          const fecha = new Date(estado.fecha);
          if (!lastDate || fecha > lastDate) {
            lastDate = fecha;
            lastStatus = estado.estado;
          }
        }
      } else {
        // Un solo estado
        lastStatus = statusData.Estado.estado;
      }

      if (lastStatus && statusMapping[lastStatus]) {
        // Actualizar todos los pedidos con este número de expedición
        for (const order of orders) {
          order.orderStatus = statusMapping[lastStatus];
          await order.save();
          logger.info(`Actualizado estado de pedido ${order._id} a ${statusMapping[lastStatus]}`);
        }
      }
    } catch (error) {
      logger.error(`Error actualizando estado de envío: ${error.message}`);
    }
  }

  /**
   * Genera un fichero CSV para importación masiva de envíos
   * @param {Array} shipments - Lista de envíos
   * @returns {Promise<string>} Ruta al archivo generado
   */
  async generateShipmentsCsv(shipments) {
    try {
      logger.info(`Generando CSV para ${shipments.length} envíos`);

      // Crear directorio si no existe
      const exportsDir = path.join(__dirname, '../../../exports');
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      // Nombre del archivo
      const filename = `envios_gls_${moment().format('YYYYMMDD_HHmmss')}.csv`;
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
            shipment.telefono || '',
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
      logger.info(`Archivo CSV generado: ${filePath}`);

      return filePath;
    } catch (error) {
      logger.error(`Error generando CSV GLS: ${error.message}`);
      throw error;
    }
  }

  /**
   * Crea envíos masivos para pedidos pendientes
   * @param {Array} orderIds - Lista de IDs de pedidos (opcional)
   * @returns {Promise<Object>} Resultado de la operación
   */
  async bulkCreateShipments(orderIds = []) {
    try {
      logger.info('Iniciando creación masiva de envíos');

      // Obtener pedidos para procesar
      let filter = {
        orderStatus: 'Pendiente de envío',
        expeditionTraking: { $exists: false },
        markForShipment: true,
      };

      // Si se proporcionaron IDs específicos, filtrar por ellos
      if (orderIds && orderIds.length > 0) {
        filter.$or = [
          { amazonOrderId: { $in: orderIds } },
          { prestashopOrderId: { $in: orderIds } },
          { _id: { $in: orderIds } },
        ];
      }

      const orders = await Order.find(filter);

      if (orders.length === 0) {
        logger.info('No hay pedidos listos para enviar');
        return {
          success: true,
          message: 'No hay pedidos listos para enviar',
          processed: 0,
          successes: 0,
          errors: 0,
        };
      }

      logger.info(`Se procesarán ${orders.length} pedidos para envío`);

      // Estadísticas
      const stats = {
        processed: orders.length,
        successes: 0,
        errors: 0,
        details: [],
      };

      // Procesar cada pedido
      for (const order of orders) {
        try {
          // Preparar datos del envío
          const shipmentData = {
            servicio: 37, // Servicio estándar
            horario: 3, // Horario estándar
            destinatario: order.recipientName,
            direccion: [order.shipAddress1, order.shipAddress2, order.shipAddress3]
              .filter(Boolean)
              .join(', '),
            pais: order.shipCountry || 'ES',
            cp: order.shipPostalCode,
            poblacion: order.shipCity,
            telefono: order.shipPhoneNumber || order.buyerPhoneNumber || '',
            email: order.buyerEmail || 'orders@toolstock.info',
            departamento: order.amazonOrderId || order.prestashopOrderId || '',
            contacto: order.recipientName || '',
            observaciones: order.deliveryInstructions || '',
            bultos: 1,
            movil: order.shipPhoneNumber || order.buyerPhoneNumber || '',
            refC: order.purchaseOrderNumber || '',
            idOrder: order.amazonOrderId || order.prestashopOrderId || order._id,
          };

          // Crear el envío
          const result = await this.createShipment(shipmentData);

          if (result.success) {
            stats.successes++;
            stats.details.push({
              orderId: order._id,
              amazonOrderId: order.amazonOrderId,
              prestashopOrderId: order.prestashopOrderId,
              status: 'success',
              expeditionNumber: result.expeditionNumber,
            });
          } else {
            stats.errors++;
            stats.details.push({
              orderId: order._id,
              amazonOrderId: order.amazonOrderId,
              prestashopOrderId: order.prestashopOrderId,
              status: 'error',
              message: result.message,
            });
          }
        } catch (error) {
          stats.errors++;
          stats.details.push({
            orderId: order._id,
            amazonOrderId: order.amazonOrderId,
            prestashopOrderId: order.prestashopOrderId,
            status: 'error',
            message: error.message,
          });
          logger.error(`Error procesando pedido ${order._id}: ${error.message}`);
        }
      }

      logger.info(
        `Procesamiento masivo completado. Éxitos: ${stats.successes}, Errores: ${stats.errors}`
      );

      return {
        success: true,
        message: 'Procesamiento masivo completado',
        ...stats,
      };
    } catch (error) {
      logger.error(`Error en procesamiento masivo: ${error.message}`);
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
  /**
   * Genera un archivo de envío masivo para GLS
   * @param {Array} shipments - Lista de envíos a incluir
   * @returns {Promise<Object>} - Información del archivo generado
   */
  async generateBulkShipmentFile(shipments) {
    try {
      // Crear directorio si no existe
      const exportsDir = path.join(__dirname, '../../../exports');
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      // Generar nombre de archivo único
      const fileName = `GLS_Envios_${new Date().toISOString().replace(/:/g, '-').replace(/\./g, '')}.xlsx`;
      const filePath = path.join(exportsDir, fileName);

      // Filtrar campos relevantes para GLS
      const shipmentData = shipments.map((shipment) => ({
        servicio: shipment.servicio || 37,
        horario: shipment.horario || 3,
        destinatario: shipment.destinatario,
        direccion: shipment.direccion,
        pais: shipment.pais || 'ES',
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
      const workbook = xlsx.utils.book_new();
      const worksheet = xlsx.utils.json_to_sheet(shipmentData);
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Envios');
      xlsx.writeFile(workbook, filePath);

      // Actualizar registros en la base de datos
      for (const shipment of shipments) {
        await Shipment.findOneAndUpdate(
          { idOrder: shipment.idOrder },
          {
            fileGenerateName: fileName,
            exported: true,
            updateDateTime: new Date(),
          },
          { new: true }
        );

        // Actualizar estado del pedido
        await Order.findOneAndUpdate(
          {
            $or: [{ amazonOrderId: shipment.idOrder }, { prestashopOrderId: shipment.idOrder }],
          },
          { markForShipment: false }
        );
      }

      return {
        success: true,
        fileName,
        filePath,
        shipmentCount: shipments.length,
      };
    } catch (error) {
      console.error('Error generando archivo de envíos GLS:', error);
      throw error;
    }
  }

  /**
   * Obtiene los envíos seleccionados para archivo
   * @returns {Promise<Array>} - Lista de envíos listos para procesar
   */
  async getShipmentsForFile() {
    try {
      // Buscar envíos marcados para archivo que no tengan fileGenerateName
      const shipments = await Shipment.find({
        process: 'isFile',
        fileGenerateName: null,
      });

      return shipments;
    } catch (error) {
      console.error('Error obteniendo envíos para archivo:', error);
      throw error;
    }
  }
}

module.exports = new GLSService();
