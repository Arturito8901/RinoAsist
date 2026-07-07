import { runQuery } from "./src/config/db.js";

async function run() {
  try {
    const res = await runQuery(`
      SELECT grupo_id, clave, semestre, turno
      FROM dbo.Grupos
      ORDER BY semestre, clave
    `);
    console.log("All groups:");
    console.log(JSON.stringify(res.recordset, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
