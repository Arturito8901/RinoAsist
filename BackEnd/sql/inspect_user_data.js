import { getPool } from "../src/config/db.js";

async function main() {
  try {
    const pool = await getPool();

    // Check if any student user has assignments in AsignacionesDocentes
    const studentAssigns = await pool.request().query(`
      SELECT ad.asignacion_id, u.correo, u.nombre_completo, m.nombre as materia, g.clave as grupo
      FROM dbo.AsignacionesDocentes ad
      JOIN dbo.Usuarios u ON ad.docente_id = u.usuario_id
      JOIN dbo.Materias m ON ad.materia_id = m.materia_id
      JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
      WHERE u.rol_id = 3
    `);
    console.log("Assignments for student users:", studentAssigns.recordset.length);
    console.table(studentAssigns.recordset);

    process.exit(0);
  } catch (err) {
    console.error("Error inspecting database:", err);
    process.exit(1);
  }
}

main();
