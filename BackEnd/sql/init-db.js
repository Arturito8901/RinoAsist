import sql from "mssql";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const config = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  options: {
    encrypt: process.env.SQL_ENCRYPT === "true",
    trustServerCertificate: process.env.SQL_TRUST_CERT === "true",
  },
};

const executeSqlFile = async (pool, filePath) => {
  console.log("Leyendo archivo:", filePath);
  const sqlText = fs.readFileSync(filePath, "utf8");

  // Dividir por lotes separados por la palabra 'GO' sola en una línea (mayúsculas o minúsculas)
  const batches = sqlText
    .split(/^\s*GO\s*$/im)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  console.log(`Encontrados ${batches.length} lotes para ejecutar.`);
  for (let i = 0; i < batches.length; i++) {
    try {
      await pool.request().query(batches[i]);
    } catch (err) {
      console.error(`Error en lote ${i + 1}:`, err.message);
      throw err;
    }
  }
};

const run = async () => {
  console.log("Conectando a la base de datos:", config.server);
  try {
    const pool = await sql.connect(config);
    console.log("¡Conexión establecida con éxito!");

    const schemaPath = path.resolve(__dirname, "schema.sql");
    console.log("Ejecutando esquema...");
    await executeSqlFile(pool, schemaPath);
    console.log("¡Esquema de base de datos creado con éxito!");

    const seedPath = path.resolve(__dirname, "seed_demo_dashboard_data.sql");
    if (fs.existsSync(seedPath)) {
      console.log("Ejecutando datos de prueba...");
      await executeSqlFile(pool, seedPath);
      console.log("¡Datos de prueba insertados con éxito!");
    }

    await sql.close();
    console.log("Proceso terminado correctamente.");
  } catch (error) {
    console.error("Error al inicializar la base de datos:", error.message);
    await sql.close();
    process.exit(1);
  }
};

run();
