import sql from "mssql";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar las variables de entorno para obtener las credenciales de Azure (que ahora están en el .env)
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Credenciales locales (origen)
const localConfig = {
  user: "Arturo",
  password: "12",
  server: "localhost",
  database: "RinoAsistDB",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

// Credenciales de Azure (destino)
const azureConfig = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
};

const tablesToMigrate = [
  { name: "Roles", hasIdentity: false },
  { name: "Usuarios", hasIdentity: true },
  { name: "PerfilesDocentes", hasIdentity: false },
  { name: "Carreras", hasIdentity: true },
  { name: "PerfilesAlumnos", hasIdentity: false },
  { name: "PeriodosEscolares", hasIdentity: true },
  { name: "Materias", hasIdentity: true },
  { name: "Grupos", hasIdentity: true },
  { name: "AsignacionesDocentes", hasIdentity: true },
  { name: "Inscripciones", hasIdentity: true },
  { name: "SesionesAsistencia", hasIdentity: true },
  { name: "RegistrosAsistencia", hasIdentity: true },
  { name: "TokensAsistencia", hasIdentity: false },
  { name: "ActivityLog", hasIdentity: true },
];

const runMigration = async () => {
  console.log("Iniciando migración de datos...");
  let localPool, azurePool;

  try {
    console.log("Conectando a base de datos local (Origen)...");
    localPool = await sql.connect(localConfig);
    console.log("Conectando a base de datos Azure (Destino)...");
    azurePool = await new sql.ConnectionPool(azureConfig).connect();

    console.log("¡Ambas conexiones establecidas con éxito!");

    // 1. Limpiar base de datos destino en orden inverso para evitar conflictos de llaves foráneas
    console.log("Limpiando tablas de destino en Azure...");
    const deleteOrder = [...tablesToMigrate].reverse();
    for (const table of deleteOrder) {
      console.log(`Borrando datos de la tabla dbo.[${table.name}] en Azure...`);
      await azurePool.request().query(`DELETE FROM dbo.[${table.name}]`);
    }
    console.log("Tablas de Azure limpias.");

    // 2. Copiar datos en orden directo
    for (const table of tablesToMigrate) {
      console.log(`Migrando tabla dbo.[${table.name}]...`);

      // Obtener columnas válidas de la tabla destino en Azure
      const colsResult = await azurePool.request().query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table.name}'`
      );
      const validAzureCols = colsResult.recordset.map((r) => r.COLUMN_NAME);

      if (validAzureCols.length === 0) {
        console.warn(`No se encontraron columnas para dbo.[${table.name}] en Azure. Saltando.`);
        continue;
      }

      // Obtener datos locales
      const localResult = await localPool.request().query(`SELECT * FROM dbo.[${table.name}]`);
      const rows = localResult.recordset;

      if (rows.length === 0) {
        console.log(`La tabla dbo.[${table.name}] está vacía. Saltando.`);
        continue;
      }

      console.log(`Encontradas ${rows.length} filas en la base de datos local para dbo.[${table.name}]. Copiando...`);

      // Filtrar columnas para usar solo las que existen en Azure
      const cols = Object.keys(rows[0]).filter((c) => validAzureCols.includes(c));
      const colList = cols.map((c) => `[${c}]`).join(", ");
      const valList = cols.map((c) => `@${c}`).join(", ");
      const insertQuery = `INSERT INTO dbo.[${table.name}] (${colList}) VALUES (${valList})`;

      if (table.hasIdentity) {
        // Ejecutar todo en un solo lote y una sola Request para asegurar el mismo estado de sesión
        const transaction = new sql.Transaction(azurePool);
        await transaction.begin();
        try {
          const req = new sql.Request(transaction);
          let batchQuery = `SET IDENTITY_INSERT dbo.[${table.name}] ON;\n`;

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const valPlaceholders = cols.map((c) => `@${c}_${i}`).join(", ");
            cols.forEach((col) => {
              req.input(`${col}_${i}`, row[col]);
            });
            batchQuery += `INSERT INTO dbo.[${table.name}] (${colList}) VALUES (${valPlaceholders});\n`;
          }

          batchQuery += `SET IDENTITY_INSERT dbo.[${table.name}] OFF;`;

          await req.query(batchQuery);
          await transaction.commit();
        } catch (err) {
          await transaction.rollback();
          console.error(`Error al insertar lote con identidad para ${table.name}:`, err.message);
          throw err;
        }
      } else {
        // Inserción normal por lotes para evitar múltiples requests
        const transaction = new sql.Transaction(azurePool);
        await transaction.begin();
        try {
          const req = new sql.Request(transaction);
          let batchQuery = "";

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const valPlaceholders = cols.map((c) => `@${c}_${i}`).join(", ");
            cols.forEach((col) => {
              req.input(`${col}_${i}`, row[col]);
            });
            batchQuery += `INSERT INTO dbo.[${table.name}] (${colList}) VALUES (${valPlaceholders});\n`;
          }

          await req.query(batchQuery);
          await transaction.commit();
        } catch (err) {
          await transaction.rollback();
          console.error(`Error al insertar lote para ${table.name}:`, err.message);
          throw err;
        }
      }

      console.log(`Tabla dbo.[${table.name}] migrada correctamente.`);
    }

    console.log("¡MIGRACIÓN COMPLETADA CON ÉXITO!");
  } catch (error) {
    console.error("Error durante la migración de datos:", error.message);
  } finally {
    if (localPool) await localPool.close();
    if (azurePool) await azurePool.close();
  }
};

runMigration();
