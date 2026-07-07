import sql from "mssql";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const requiredEnv = ["SQL_USER", "SQL_PASSWORD", "SQL_SERVER", "SQL_DATABASE"];

const validateConfig = () => {
  const missing = requiredEnv.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(
      `Faltan variables de conexion SQL en BackEnd/.env: ${missing.join(", ")}`
    );
  }
};

const config = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  options: {
    encrypt: process.env.SQL_ENCRYPT === "true",
    trustServerCertificate: process.env.SQL_TRUST_CERT === "true",
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool;

export const getPool = async () => {
  validateConfig();

  if (!pool) {
    pool = new sql.ConnectionPool(config);
    pool.on("error", (err) => {
      console.error("Error en el pool de SQL Server", err);
      pool = null;
    });
    try {
      await pool.connect();
    } catch (error) {
      pool = null;
      throw error;
    }
  } else if (!pool.connected) {
    try {
      await pool.connect();
    } catch (error) {
      pool = null;
      throw error;
    }
  }
  return pool;
};

export const runQuery = async (queryText, params = []) => {
  const poolConn = await getPool();
  const request = poolConn.request();
  params.forEach(({ name, type = sql.NVarChar, value }) => {
    request.input(name, type, value);
  });
  return request.query(queryText);
};

export { sql };
