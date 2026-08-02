const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectionString = process.env.DATABASE_URL;

let pool;

function getPool() {
  if (pool) return pool;

  // Parse target database hostname to determine if the connection is remote
  let dbHost = process.env.DB_HOST || '127.0.0.1';
  if (connectionString) {
    try {
      const urlObj = new URL(connectionString);
      if (urlObj.hostname) {
        dbHost = urlObj.hostname;
      }
    } catch (e) {
      // Fallback
    }
  }

  // Treat local docker-compose services ('db', 'postgres') and loopbacks as local
  const localHosts = ['localhost', '127.0.0.1', 'db', 'postgres'];
  const isRemote = dbHost && !localHosts.includes(dbHost.toLowerCase());


  const poolConfig = {
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  };

  if (isRemote) {
    const ssl = {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
    };
    if (process.env.DB_SSL_CA) {
      try {
        if (fs.existsSync(process.env.DB_SSL_CA)) {
          ssl.ca = fs.readFileSync(process.env.DB_SSL_CA).toString();
        } else {
          console.warn(`[WARN] DB_SSL_CA certificate file not found at: ${process.env.DB_SSL_CA}`);
        }
      } catch (err) {
        console.error(`[ERROR] Failed to read DB_SSL_CA file:`, err);
      }
    }
    poolConfig.ssl = ssl;
  }

  if (connectionString) {
    let cleanConnectionString = connectionString;
    try {
      const urlObj = new URL(connectionString);
      if (urlObj.searchParams.has('sslmode')) {
        urlObj.searchParams.delete('sslmode');
        cleanConnectionString = urlObj.toString();
      }
    } catch (e) {
      // Fallback if not a URL
    }
    pool = new Pool({
      connectionString: cleanConnectionString,
      ...poolConfig
    });
  } else {
    pool = new Pool({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'postgres',
      ...poolConfig
    });
  }

  return pool;
}

// Helper to convert query syntax at runtime safely
function convertQuery(sql) {
  let convertedSql = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let dollarIndex = 1;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "'" && (i === 0 || sql[i - 1] !== '\\')) {
      inSingleQuote = !inSingleQuote;
      convertedSql += char;
    } else if (char === '"' && (i === 0 || sql[i - 1] !== '\\')) {
      inDoubleQuote = !inDoubleQuote;
      convertedSql += char;
    } else if (char === '?' && !inSingleQuote && !inDoubleQuote) {
      convertedSql += `$${dollarIndex++}`;
    } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
      convertedSql += '"';
    } else {
      convertedSql += char;
    }
  }
  return convertedSql;
}

module.exports = {
  getPool,
  convertQuery,
  query: async (sql, params) => {
    const activePool = getPool();
    const convertedSql = convertQuery(sql);
    const res = await activePool.query(convertedSql, params);
    return res.rows;
  },
  
  // PostgreSQL transaction wrapper
  executeTransaction: async (actions) => {
    const activePool = getPool();
    const client = await activePool.connect();
    try {
      await client.query('BEGIN');
      
      // Connection adapter to simulate MySQL transaction client
      const connAdapter = {
        query: async (sql, params) => {
          const convertedSql = convertQuery(sql);
          const res = await client.query(convertedSql, params);
          // Return [rows] to mimic MySQL's [results, fields] return structure
          return [res.rows];
        }
      };

      const result = await actions(connAdapter);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
};
