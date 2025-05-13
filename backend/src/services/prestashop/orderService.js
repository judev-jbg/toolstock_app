const psApiClient = require('./psApiClient');
const Order = require('../../models/orderModel');
const moment = require('moment');

/**
 * Servicio para gestionar pedidos de PrestaShop
 */
class PrestashopOrderService {
  /**
   * Obtiene pedidos de PrestaShop
   * @param {Object} options - Opciones de filtrado
   * @returns {Promise<Array>} Lista de pedidos
   */
  async getOrders(options = {}) {
    try {
      const { startDate, endDate, status, limit = 50 } = options;

      // Construir filtros
      const filters = {
        limit,
        display: 'full', // Obtener todos los campos
      };

      // Filtro por fecha
      if (startDate) {
        filters['filter[date_add]'] = `>[${startDate}]`;
      }

      if (endDate) {
        filters['filter[date_add]'] = `<[${endDate}]`;
      }

      // Filtro por estado
      if (status) {
        filters['filter[current_state]'] = `=[${status}]`;
      }

      // Obtener pedidos de PrestaShop
      const response = await psApiClient.get('orders', filters);

      if (!response || !response.orders || !response.orders.order) {
        return [];
      }

      // Normalizar respuesta (siempre devolver array)
      const orders = Array.isArray(response.orders.order)
        ? response.orders.order
        : [response.orders.order];

      // Mapear pedidos al formato de nuestro modelo
      const transformedOrders = await Promise.all(
        orders.map(async (order) => {
          // Para cada pedido, obtenemos sus detalles (productos)
          const orderDetails = await this.getOrderDetails(order.id);

          // Obtener información del cliente
          const customer = await this.getCustomer(order.id_customer);

          // Obtener direcciones
          const deliveryAddress = await this.getAddress(order.id_address_delivery);
          const invoiceAddress = await this.getAddress(order.id_address_invoice);

          return this.transformPrestashopOrder(
            order,
            orderDetails,
            customer,
            deliveryAddress,
            invoiceAddress
          );
        })
      );

      return transformedOrders;
    } catch (error) {
      console.error('Error fetching PrestaShop orders:', error);
      throw error;
    }
  }

  /**
   * Obtiene detalles (productos) de un pedido
   * @param {number} orderId - ID del pedido
   * @returns {Promise<Array>} Detalles del pedido
   */
  async getOrderDetails(orderId) {
    try {
      const response = await psApiClient.get('order_details', {
        'filter[id_order]': `=${orderId}`,
        display: 'full',
      });

      if (!response || !response.order_details || !response.order_details.order_detail) {
        return [];
      }

      // Normalizar respuesta
      return Array.isArray(response.order_details.order_detail)
        ? response.order_details.order_detail
        : [response.order_details.order_detail];
    } catch (error) {
      console.error(`Error fetching order details for order ${orderId}:`, error);
      return [];
    }
  }

  /**
   * Obtiene información del cliente
   * @param {number} customerId - ID del cliente
   * @returns {Promise<Object>} Datos del cliente
   */
  async getCustomer(customerId) {
    try {
      const response = await psApiClient.getById('customers', customerId);
      return response && response.customer ? response.customer : null;
    } catch (error) {
      console.error(`Error fetching customer ${customerId}:`, error);
      return null;
    }
  }

  /**
   * Obtiene información de una dirección
   * @param {number} addressId - ID de la dirección
   * @returns {Promise<Object>} Datos de la dirección
   */
  async getAddress(addressId) {
    try {
      const response = await psApiClient.getById('addresses', addressId);
      return response && response.address ? response.address : null;
    } catch (error) {
      console.error(`Error fetching address ${addressId}:`, error);
      return null;
    }
  }

  /**
   * Transforma un pedido de PrestaShop al formato de nuestro modelo
   * @param {Object} order - Pedido de PrestaShop
   * @param {Array} orderDetails - Detalles/productos del pedido
   * @param {Object} customer - Datos del cliente
   * @param {Object} deliveryAddress - Dirección de entrega
   * @param {Object} invoiceAddress - Dirección de facturación
   * @returns {Object} Pedido transformado
   */
  transformPrestashopOrder(order, orderDetails, customer, deliveryAddress, invoiceAddress) {
    // Mapear estados de PrestaShop a nuestros estados
    const statusMapping = {
      1: 'Pendiente de envío',
      2: 'Enviado',
      3: 'Entregado',
      4: 'Enviado',
      5: 'Cancelado',
      6: 'Cancelado',
      7: 'Pendiente de envío',
      8: 'Pendiente disponibilidad',
    };

    // Transformar productos
    const items = orderDetails.map((detail) => ({
      orderItemId: detail.id,
      sku: detail.product_reference,
      productName: detail.product_name,
      quantityPurchased: parseInt(detail.product_quantity, 10),
      itemPrice: parseFloat(detail.unit_price_tax_incl) * parseInt(detail.product_quantity, 10),
      itemTax: parseFloat(detail.unit_price_tax_incl) - parseFloat(detail.unit_price_tax_excl),
      vatExclusiveItemPrice:
        parseFloat(detail.unit_price_tax_excl) * parseInt(detail.product_quantity, 10),
      asin: '', // PrestaShop no tiene ASIN
      referenciaProv: detail.product_reference,
    }));

    // Construcción del objeto transformado
    const transformedOrder = {
      prestashopOrderId: order.id,
      source: 'prestashop',
      orderStatus: statusMapping[order.current_state] || 'Pendiente de envío',
      buyerEmail: customer ? customer.email : '',
      purchaseDate: order.date_add,
      buyerName: customer ? `${customer.firstname} ${customer.lastname}` : '',
      buyerPhoneNumber: deliveryAddress ? deliveryAddress.phone : '',

      // Datos de envío
      recipientName: deliveryAddress
        ? `${deliveryAddress.firstname} ${deliveryAddress.lastname}`
        : '',
      shipAddress1: deliveryAddress ? deliveryAddress.address1 : '',
      shipAddress2: deliveryAddress ? deliveryAddress.address2 : '',
      shipCity: deliveryAddress ? deliveryAddress.city : '',
      shipState: deliveryAddress ? deliveryAddress.state : '',
      shipPostalCode: deliveryAddress ? deliveryAddress.postcode : '',
      shipCountry: deliveryAddress ? deliveryAddress.country : '',
      shipPhoneNumber: deliveryAddress ? deliveryAddress.phone_mobile || deliveryAddress.phone : '',

      // Datos de facturación
      billName: invoiceAddress ? `${invoiceAddress.firstname} ${invoiceAddress.lastname}` : '',
      billAddress1: invoiceAddress ? invoiceAddress.address1 : '',
      billAddress2: invoiceAddress ? invoiceAddress.address2 : '',
      billCity: invoiceAddress ? invoiceAddress.city : '',
      billState: invoiceAddress ? invoiceAddress.state : '',
      billPostalCode: invoiceAddress ? invoiceAddress.postcode : '',
      billCountry: invoiceAddress ? invoiceAddress.country : '',

      // Datos adicionales
      salesChannel: 'PrestaShop',
      isBusinessOrder: customer ? customer.company !== '' : false,
      buyerCompanyName: customer ? customer.company : '',

      // Items del pedido
      items,
    };

    return transformedOrder;
  }

  /**
   * Sincroniza pedidos recientes de PrestaShop a nuestra base de datos
   * @param {number} days - Número de días hacia atrás para sincronizar
   * @returns {Promise<Object>} Resultado de la sincronización
   */
  async syncRecentOrders(days = 7) {
    try {
      const startDate = moment().subtract(days, 'days').format('YYYY-MM-DD HH:mm:ss');

      // Obtener pedidos recientes
      const orders = await this.getOrders({
        startDate,
        limit: 100,
      });

      // Contador para estadísticas
      const stats = {
        total: orders.length,
        created: 0,
        updated: 0,
        errors: 0,
      };

      // Procesar cada pedido
      for (const orderData of orders) {
        try {
          // Verificar si el pedido ya existe
          let existingOrder = await Order.findOne({
            prestashopOrderId: orderData.prestashopOrderId,
          });

          if (existingOrder) {
            // Actualizar pedido existente
            Object.assign(existingOrder, orderData);
            await existingOrder.save();
            stats.updated++;
          } else {
            // Crear nuevo pedido
            await Order.create(orderData);
            stats.created++;
          }
        } catch (error) {
          console.error(`Error processing PrestaShop order ${orderData.prestashopOrderId}:`, error);
          stats.errors++;
        }
      }

      return {
        message: 'PrestaShop order synchronization completed',
        stats,
      };
    } catch (error) {
      console.error('Error syncing PrestaShop orders:', error);
      throw error;
    }
  }

  /**
   * Crea un nuevo pedido en PrestaShop
   * @param {Object} orderData - Datos del pedido
   * @returns {Promise<Object>} Pedido creado
   */
  async createOrder(orderData) {
    try {
      // Primero, asegurarnos de que el cliente existe
      let customerId = await this.ensureCustomerExists({
        email: orderData.buyerEmail,
        firstname: orderData.buyerName.split(' ')[0] || '',
        lastname: orderData.buyerName.split(' ').slice(1).join(' ') || '',
        company: orderData.buyerCompanyName,
      });

      // Crear/verificar dirección de envío
      const deliveryAddressId = await this.ensureAddressExists({
        id_customer: customerId,
        firstname: orderData.recipientName.split(' ')[0] || '',
        lastname: orderData.recipientName.split(' ').slice(1).join(' ') || '',
        address1: orderData.shipAddress1,
        address2: orderData.shipAddress2,
        postcode: orderData.shipPostalCode,
        city: orderData.shipCity,
        id_country: await this.getCountryId(orderData.shipCountry),
        phone: orderData.shipPhoneNumber,
      });

      // Crear/verificar dirección de facturación
      const invoiceAddressId = await this.ensureAddressExists({
        id_customer: customerId,
        firstname: orderData.billName.split(' ')[0] || '',
        lastname: orderData.billName.split(' ').slice(1).join(' ') || '',
        address1: orderData.billAddress1,
        address2: orderData.billAddress2,
        postcode: orderData.billPostalCode,
        city: orderData.billCity,
        id_country: await this.getCountryId(orderData.billCountry),
        phone: orderData.buyerPhoneNumber,
      });

      // Mapear nuestros estados a estados de PrestaShop
      const stateMapping = {
        'Pendiente de envío': 1,
        Enviado: 4,
        Entregado: 5,
        Cancelado: 6,
        'Pendiente disponibilidad': 3,
      };

      // Crear el pedido en PrestaShop
      const orderPayload = {
        order: {
          id_customer: customerId,
          id_address_delivery: deliveryAddressId,
          id_address_invoice: invoiceAddressId,
          current_state: stateMapping[orderData.orderStatus] || 1,
          module: 'amazon',
          payment: orderData.amazonOrderId ? `Amazon Order: ${orderData.amazonOrderId}` : 'Amazon',
          total_paid: orderData.items.reduce(
            (sum, item) => sum + parseFloat(item.itemPrice || 0),
            0
          ),
          total_paid_tax_excl: orderData.items.reduce(
            (sum, item) => sum + parseFloat(item.vatExclusiveItemPrice || 0),
            0
          ),
          total_paid_tax_incl: orderData.items.reduce(
            (sum, item) => sum + parseFloat(item.itemPrice || 0),
            0
          ),
          reference: orderData.amazonOrderId || '',
        },
      };

      const createdOrder = await psApiClient.create('orders', orderPayload);

      // Ahora añadir los productos al pedido
      if (createdOrder && createdOrder.order && createdOrder.order.id) {
        const orderId = createdOrder.order.id;

        for (const item of orderData.items) {
          // Buscar el producto en PrestaShop por SKU
          const productId = await this.getProductIdBySku(item.sku);

          if (productId) {
            // Añadir el producto al pedido
            await this.addProductToOrder(orderId, productId, item);
          } else {
            console.warn(`Product with SKU ${item.sku} not found in PrestaShop`);
          }
        }
      }

      return createdOrder;
    } catch (error) {
      console.error('Error creating order in PrestaShop:', error);
      throw error;
    }
  }

  /**
   * Asegura que un cliente existe (lo crea si no existe)
   * @param {Object} customer - Datos del cliente
   * @returns {Promise<number>} ID del cliente
   */
  async ensureCustomerExists(customer) {
    try {
      // Buscar si el cliente ya existe
      const response = await psApiClient.get('customers', {
        'filter[email]': `=${customer.email}`,
      });

      if (response && response.customers && response.customers.customer) {
        const existingCustomer = Array.isArray(response.customers.customer)
          ? response.customers.customer[0]
          : response.customers.customer;

        return existingCustomer.id;
      }

      // Si no existe, crearlo
      const newCustomer = await psApiClient.create('customers', {
        customer: {
          ...customer,
          passwd: Math.random().toString(36).substring(2, 15), // Contraseña aleatoria
          active: 1,
        },
      });

      return newCustomer.customer.id;
    } catch (error) {
      console.error('Error ensuring customer exists:', error);
      throw error;
    }
  }

  /**
   * Asegura que una dirección existe (la crea si no existe)
   * @param {Object} address - Datos de la dirección
   * @returns {Promise<number>} ID de la dirección
   */
  async ensureAddressExists(address) {
    try {
      // Buscar si la dirección ya existe
      const response = await psApiClient.get('addresses', {
        'filter[id_customer]': `=${address.id_customer}`,
        'filter[address1]': `=${address.address1}`,
        'filter[postcode]': `=${address.postcode}`,
      });

      if (response && response.addresses && response.addresses.address) {
        const existingAddress = Array.isArray(response.addresses.address)
          ? response.addresses.address[0]
          : response.addresses.address;

        return existingAddress.id;
      }

      // Si no existe, crearla
      const newAddress = await psApiClient.create('addresses', {
        address: {
          ...address,
          alias: 'My Address',
        },
      });

      return newAddress.address.id;
    } catch (error) {
      console.error('Error ensuring address exists:', error);
      throw error;
    }
  }

  /**
   * Obtiene el ID de un país por su código ISO
   * @param {string} countryCode - Código ISO del país (ES, FR, etc.)
   * @returns {Promise<number>} ID del país en PrestaShop
   */
  async getCountryId(countryCode) {
    try {
      const response = await psApiClient.get('countries', {
        'filter[iso_code]': `=${countryCode}`,
      });

      if (response && response.countries && response.countries.country) {
        const country = Array.isArray(response.countries.country)
          ? response.countries.country[0]
          : response.countries.country;

        return country.id;
      }

      // Si no se encuentra, devolver país por defecto (España)
      return 6; // ID de España en PrestaShop por defecto
    } catch (error) {
      console.error(`Error getting country ID for ${countryCode}:`, error);
      return 6; // ID por defecto
    }
  }

  /**
   * Obtiene el ID de un producto por su SKU
   * @param {string} sku - SKU del producto
   * @returns {Promise<number|null>} ID del producto o null si no existe
   */
  async getProductIdBySku(sku) {
    try {
      const response = await psApiClient.get('products', {
        'filter[reference]': `=${sku}`,
      });

      if (response && response.products && response.products.product) {
        const product = Array.isArray(response.products.product)
          ? response.products.product[0]
          : response.products.product;

        return product.id;
      }

      return null;
    } catch (error) {
      console.error(`Error getting product ID for SKU ${sku}:`, error);
      return null;
    }
  }

  /**
   * Añade un producto a un pedido
   * @param {number} orderId - ID del pedido
   * @param {number} productId - ID del producto
   * @param {Object} item - Datos del item/producto
   * @returns {Promise<Object>} Resultado
   */
  async addProductToOrder(orderId, productId, item) {
    try {
      // En PrestaShop esto normalmente se hace a través de una API personalizada
      // o directamente manipulando la base de datos

      // Simulación - en producción deberías implementar la lógica real
      console.log(
        `Adding product ${productId} to order ${orderId}: ${item.productName} (${item.quantityPurchased} units)`
      );

      return { success: true };
    } catch (error) {
      console.error(`Error adding product ${productId} to order ${orderId}:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new PrestashopOrderService();
