const sql = require('mssql');
const logger = require('../../utils/logger');

class SqlServerService {
  constructor() {
    this.config = {
      server: process.env.ERP_SQL_SERVER,
      database: process.env.ERP_SQL_DATABASE,
      user: process.env.ERP_SQL_USER,
      password: process.env.ERP_SQL_PASSWORD,
      port: parseInt(process.env.ERP_SQL_PORT) || 1433,
      options: {
        encrypt: process.env.ERP_SQL_ENCRYPT === 'true',
        trustServerCertificate: process.env.ERP_SQL_TRUST_CERT === 'true',
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };
    this.poolPromise = null;
  }

  /**
   * Inicializa y obtiene el pool de conexiones
   */
  async getPool() {
    if (!this.poolPromise) {
      this.poolPromise = new sql.ConnectionPool(this.config)
        .connect()
        .then((pool) => {
          logger.info('Connected to SQL Server ERP database');

          // Manejar errores del pool
          pool.on('error', (err) => {
            logger.error('SQL Server pool error:', err);
          });

          return pool;
        })
        .catch((err) => {
          logger.error('Failed to connect to SQL Server:', err);
          this.poolPromise = null;
          throw err;
        });
    }

    return this.poolPromise;
  }

  /**
   * Ejecuta una consulta SQL
   */
  async executeQuery(query, params = {}) {
    try {
      const pool = await this.getPool();
      const request = pool.request();

      // Agregar parámetros si los hay
      Object.keys(params).forEach((key) => {
        request.input(key, params[key]);
      });

      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      logger.error('Error executing SQL query:', error);
      throw error;
    }
  }

  /**
   * Obtiene productos ERP actualizados recientemente
   */
  async getUpdatedProducts(minutesAgo = 65) {
    const query = `
      SELECT 
          a.idArticulo AS erp_sku,
          p.erp_skuSuplier,
          Descrip AS erp_name,
          ISNULL(stock_actual,0) AS erp_stock,
          ISNULL(erp_price_web_official,ISNULL(erp_price_web_default,0)) AS erp_price_web_official,
          ISNULL(erp_price_amz_es,0) AS erp_price_amz_es,
          ISNULL(erp_price_amz_de,0) AS erp_price_amz_de,
          ISNULL(erp_price_amz_it,0) AS erp_price_amz_it,
          ISNULL(erp_price_amz_nl,0) AS erp_price_amz_nl,
          ISNULL(erp_price_amz_be,0) AS erp_price_amz_be,
          ISNULL(erp_cost,0) AS erp_cost,
          codBarras AS erp_barcode,
          Observaciones AS erp_obs,
          Exposicion AS erp_offer_web,
          estado AS erp_status,
          Peso AS erp_weight,
          Largo AS erp_length,
          Alto AS erp_height,
          Profundo AS erp_depth,
          a.FechaInsertUpdate AS erp_updated_at
      FROM [dbo].[Articulos] a WITH (NOLOCK)
      LEFT JOIN
          (
          SELECT 
              IdProveedor,
              idArticulo,
              Articulo as erp_skuSuplier,
              FechaInsertUpdate
          FROM [dbo].[Prov_Articulos] WITH (NOLOCK)
          ) p
          ON p.idArticulo = a.IdArticulo AND p.IdProveedor = a.IdProveedorPreferencial
      LEFT JOIN
          (
          SELECT
              IdArticulo,
              ISNULL(Stock,0) AS stock_actual,
              FechaInsertUpdate
          FROM [dbo].[Articulos_Stock] WITH (NOLOCK)
          WHERE IdAlmacen = 0
          ) s
          ON s.IdArticulo = a.IdArticulo
      LEFT JOIN
          (
          SELECT
              IdArticulo,
              ISNULL(Precio,0) AS erp_price_web_default,
              FechaInsertUpdate
          FROM [dbo].[Listas_Precios_Cli_Art] WITH (NOLOCK)
          WHERE IdLista = 0
          ) pwd
          ON pwd.IdArticulo = a.IdArticulo
       LEFT JOIN
          (
          SELECT
              IdArticulo,
              ISNULL(Precio,0) AS erp_price_web_official,
              FechaInsertUpdate
          FROM [dbo].[Listas_Precios_Cli_Art] WITH (NOLOCK)
          WHERE IdLista = 1
          ) pw
          ON pw.IdArticulo = a.IdArticulo
       LEFT JOIN
          (
          SELECT
              IdArticulo,
              ISNULL(Precio,0) AS erp_price_amz_es,
              FechaInsertUpdate
          FROM [dbo].[Listas_Precios_Cli_Art] WITH (NOLOCK)
          WHERE IdLista = 3
          ) pes
          ON pes.IdArticulo = a.IdArticulo
       LEFT JOIN
          (
          SELECT
              IdArticulo,
              ISNULL(Precio,0) AS erp_price_amz_de,
              FechaInsertUpdate
          FROM [dbo].[Listas_Precios_Cli_Art] WITH (NOLOCK)
          WHERE IdLista = 4
          ) pde
          ON pde.IdArticulo = a.IdArticulo
       LEFT JOIN
          (
          SELECT
              IdArticulo,
              ISNULL(Precio,0) AS erp_price_amz_it,
              FechaInsertUpdate
          FROM [dbo].[Listas_Precios_Cli_Art] WITH (NOLOCK)
          WHERE IdLista = 5
          ) pit
          ON pit.IdArticulo = a.IdArticulo
       LEFT JOIN
          (
          SELECT
              IdArticulo,
              ISNULL(Precio,0) AS erp_price_amz_nl,
              FechaInsertUpdate
          FROM [dbo].[Listas_Precios_Cli_Art] WITH (NOLOCK)
          WHERE IdLista = 7
          ) pnl
          ON pnl.IdArticulo = a.IdArticulo
       LEFT JOIN
          (
          SELECT
              IdArticulo,
              ISNULL(Precio,0) AS erp_price_amz_be,
              FechaInsertUpdate
          FROM [dbo].[Listas_Precios_Cli_Art] WITH (NOLOCK)
          WHERE IdLista = 8
          ) pbe
          ON pbe.IdArticulo = a.IdArticulo
       LEFT JOIN
          (
          SELECT
              IdArticulo,
              ISNULL(Precio,0) AS erp_cost,
              FechaInsertUpdate
          FROM [dbo].[Listas_Precios_Prov_art] WITH (NOLOCK)
          WHERE IdLista = 1
          ) c
          ON c.IdArticulo = a.IdArticulo
      WHERE 
          p.erp_skuSuplier IS NOT NULL 
          AND (
              a.FechaInsertUpdate >= DATEADD(MINUTE, -@minutesAgo, GETDATE())
              OR p.FechaInsertUpdate >= DATEADD(MINUTE, -@minutesAgo, GETDATE())
              OR s.FechaInsertUpdate >= DATEADD(MINUTE, -@minutesAgo, GETDATE())
              OR pwd.FechaInsertUpdate >= DATEADD(MINUTE, -@minutesAgo, GETDATE())
              OR pw.FechaInsertUpdate >= DATEADD(MINUTE, -@minutesAgo, GETDATE())
              OR pes.FechaInsertUpdate >= DATEADD(MINUTE, -@minutesAgo, GETDATE())
              OR pde.FechaInsertUpdate >= DATEADD(MINUTE, -@minutesAgo, GETDATE())
              OR pit.FechaInsertUpdate >= DATEADD(MINUTE, -@minutesAgo, GETDATE())
              OR pnl.FechaInsertUpdate >= DATEADD(MINUTE, -@minutesAgo, GETDATE())
              OR pbe.FechaInsertUpdate >= DATEADD(MINUTE, -@minutesAgo, GETDATE())
              OR c.FechaInsertUpdate >= DATEADD(MINUTE, -@minutesAgo, GETDATE())
          )
      ORDER BY a.FechaInsertUpdate DESC
    `;

    return this.executeQuery(query, { minutesAgo });
  }

  /**
   * Cierra todas las conexiones
   */
  async closeAll() {
    try {
      if (this.poolPromise) {
        const pool = await this.poolPromise;
        await pool.close();
        this.poolPromise = null;
        logger.info('SQL Server connection pool closed');
      }
    } catch (error) {
      logger.error('Error closing SQL Server pool:', error);
    }
  }
}

module.exports = new SqlServerService();
