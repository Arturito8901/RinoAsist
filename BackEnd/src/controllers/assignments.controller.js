import { runQuery, sql, getPool } from "../config/db.js";
import exceljs from "exceljs";
import bcrypt from "bcryptjs";
import { syncStudentEnrollmentsForActivePeriod } from "./alumnos.controller.js";

const DOCENTES_QUERY = `
SELECT u.usuario_id AS id, u.nombre_completo AS nombre, pd.turno
FROM dbo.Usuarios u
JOIN dbo.PerfilesDocentes pd ON pd.usuario_id = u.usuario_id
WHERE u.rol_id = 2 AND u.activo = 1 AND u.is_debug = 0
ORDER BY u.nombre_completo;
`;

const MATERIAS_QUERY = `
SELECT materia_id AS id, nombre, clave
FROM dbo.Materias
WHERE activo = 1
ORDER BY nombre;
`;

const GRUPOS_QUERY = `
SELECT grupo_id AS id, clave, turno, semestre
FROM dbo.Grupos
ORDER BY clave;
`;

const ASIGNACIONES_QUERY = `
SELECT 
  ad.asignacion_id AS id,
  ad.docente_id,
  u.nombre_completo AS docente_nombre,
  ad.materia_id,
  m.nombre AS materia_nombre,
  m.clave AS materia_clave,
  ad.grupo_id,
  g.clave AS grupo_clave,
  g.semestre,
  g.turno,
  ad.horario
FROM dbo.AsignacionesDocentes ad
JOIN dbo.Usuarios u ON ad.docente_id = u.usuario_id
JOIN dbo.Materias m ON ad.materia_id = m.materia_id
JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
WHERE u.activo = 1
ORDER BY g.semestre, g.clave, m.nombre;
`;

const CHECK_ASSIGNMENT = `
DECLARE @activePeriodId INT;
SELECT TOP 1 @activePeriodId = periodo_id FROM dbo.PeriodosEscolares WHERE activo = 1 ORDER BY creado_en DESC;

SELECT 1
FROM dbo.AsignacionesDocentes
WHERE docente_id = @docenteId 
  AND materia_id = @materiaId 
  AND grupo_id = @grupoId
  AND (periodo_id = @activePeriodId OR (@activePeriodId IS NULL AND periodo_id IS NULL));
`;

const INSERT_ASSIGNMENT = `
DECLARE @activePeriodId INT;
SELECT TOP 1 @activePeriodId = periodo_id FROM dbo.PeriodosEscolares WHERE activo = 1 ORDER BY creado_en DESC;

INSERT INTO dbo.AsignacionesDocentes (docente_id, materia_id, grupo_id, horario, periodo_id)
OUTPUT INSERTED.asignacion_id
VALUES (@docenteId, @materiaId, @grupoId, @horario, @activePeriodId);
`;

/**
 * Returns true if the active school period is past / closed (read-only)
 */
async function isPeriodClosed(targetPeriodId = null) {
  try {
    let pRes;
    if (targetPeriodId) {
      pRes = await runQuery("SELECT periodo_id, fecha_fin, activo FROM dbo.PeriodosEscolares WHERE periodo_id = @id", [
        { name: "id", type: sql.Int, value: targetPeriodId }
      ]);
    } else {
      pRes = await runQuery("SELECT TOP 1 periodo_id, fecha_fin, activo FROM dbo.PeriodosEscolares WHERE activo = 1 ORDER BY creado_en DESC");
    }
    if (!pRes.recordset || pRes.recordset.length === 0) return false;
    const period = pRes.recordset[0];
    if (period.activo === false || period.activo === 0) return true;
    if (period.fecha_fin && new Date(period.fecha_fin) < new Date()) {
      return true;
    }
    return false;
  } catch (err) {
    console.error("Error checking isPeriodClosed:", err);
    return false;
  }
}

export const getAssignmentOptions = async (req, res) => {
  const { ciclo = null } = req.query;
  try {
    // Ensure Intersemestral subject exists
    const mCheck = await runQuery("SELECT materia_id FROM dbo.Materias WHERE nombre = 'Intersemestral'");
    if (mCheck.recordset.length === 0) {
      await runQuery("INSERT INTO dbo.Materias (nombre, clave, creditos) VALUES ('Intersemestral', 'INTER', 5)");
    }

    // Ensure Intersemestral group exists
    const gCheck = await runQuery("SELECT grupo_id FROM dbo.Grupos WHERE clave = 'Intersemestral'");
    if (gCheck.recordset.length === 0) {
      await runQuery("INSERT INTO dbo.Grupos (clave, turno, semestre, cupo) VALUES ('Intersemestral', 'Matutino', 1, 30)");
    }

    // Resolve target period
    let targetPeriod = null;
    if (ciclo) {
      const pRes = await runQuery(
        "SELECT TOP 1 periodo_id, clave, nombre FROM dbo.PeriodosEscolares WHERE clave = @ciclo",
        [{ name: "ciclo", type: sql.VarChar, value: ciclo }]
      );
      if (pRes.recordset.length > 0) targetPeriod = pRes.recordset[0];
    }
    if (!targetPeriod) {
      const pRes = await runQuery(
        "SELECT TOP 1 periodo_id, clave, nombre FROM dbo.PeriodosEscolares WHERE activo = 1 ORDER BY creado_en DESC"
      );
      targetPeriod = pRes.recordset[0];
    }
    const activePeriodId = targetPeriod?.periodo_id || null;
    const isInter = targetPeriod?.nombre?.toLowerCase().includes("intersemestral") || targetPeriod?.clave?.toLowerCase().includes("inter");

    let dynamicGruposQuery;
    let queryParams = [];

    if (isInter && activePeriodId) {
      dynamicGruposQuery = `
        SELECT grupo_id AS id, clave, turno, semestre, cupo
        FROM dbo.Grupos
        WHERE (periodo_id = @activePeriodId OR clave = 'Intersemestral')
          AND clave != '*'
        ORDER BY semestre, clave;
      `;
      queryParams.push({ name: "activePeriodId", type: sql.Int, value: activePeriodId });
    } else {
      dynamicGruposQuery = `
        SELECT grupo_id AS id, clave, turno, semestre, cupo
        FROM dbo.Grupos
        WHERE (periodo_id IS NULL OR periodo_id = @activePeriodId)
          AND clave != '*'
          AND clave != 'Intersemestral'
        ORDER BY semestre, clave;
      `;
      if (activePeriodId) {
        queryParams.push({ name: "activePeriodId", type: sql.Int, value: activePeriodId });
      }
    }

    // Dynamic Asignaciones Query: filtered by target period
    let dynamicAsignacionesQuery = `
      SELECT 
        ad.asignacion_id AS id,
        ad.docente_id,
        u.nombre_completo AS docente_nombre,
        ad.materia_id,
        m.nombre AS materia_nombre,
        m.clave AS materia_clave,
        ad.grupo_id,
        g.clave AS grupo_clave,
        g.semestre,
        g.turno,
        ad.horario
      FROM dbo.AsignacionesDocentes ad
      JOIN dbo.Usuarios u ON ad.docente_id = u.usuario_id
      JOIN dbo.Materias m ON ad.materia_id = m.materia_id
      JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
      WHERE u.activo = 1
    `;
    let asignacionesParams = [];

    if (activePeriodId) {
      dynamicAsignacionesQuery += ` AND (ad.periodo_id = @activePeriodId OR (@activePeriodId IS NULL AND ad.periodo_id IS NULL))`;
      asignacionesParams.push({ name: "activePeriodId", type: sql.Int, value: activePeriodId });
    }
    dynamicAsignacionesQuery += ` ORDER BY g.semestre, g.clave, m.nombre;`;

    const [docentesResult, materiasResult, gruposResult, asignacionesResult] = await Promise.all([
      runQuery(DOCENTES_QUERY),
      runQuery(MATERIAS_QUERY),
      runQuery(dynamicGruposQuery, queryParams),
      runQuery(dynamicAsignacionesQuery, asignacionesParams),
    ]);

    return res.json({
      docentes: docentesResult.recordset,
      materias: materiasResult.recordset,
      grupos: gruposResult.recordset,
      asignaciones: asignacionesResult.recordset,
    });
  } catch (error) {
    console.error("Error loading assignment options:", error);
    return res
      .status(500)
      .json({ message: "No se pudieron cargar las opciones de asignación" });
  }
};

export const createAssignment = async (req, res) => {
  const body = req.body || {};
  const docenteId = body.docenteId || body.docente_id;
  const materiaId = body.materiaId || body.materia_id;
  const grupoId = body.grupoId || body.grupo_id;
  const horario = body.horario || null;

  if (!docenteId || !materiaId || !grupoId) {
    return res.status(400).json({
      message: "docenteId, materiaId y grupoId son obligatorios",
    });
  }

  try {
    if (await isPeriodClosed()) {
      return res.status(403).json({
        message: "El ciclo escolar activo ha concluido o está en modo solo lectura. No se permiten nuevas asignaciones."
      });
    }

    const existing = await runQuery(CHECK_ASSIGNMENT, [
      { name: "docenteId", type: sql.Int, value: docenteId },
      { name: "materiaId", type: sql.Int, value: materiaId },
      { name: "grupoId", type: sql.Int, value: grupoId },
    ]);

    if (existing.recordset.length) {
      return res
        .status(409)
        .json({ message: "Esa combinación ya está asignada" });
    }

    const inserted = await runQuery(INSERT_ASSIGNMENT, [
      { name: "docenteId", type: sql.Int, value: docenteId },
      { name: "materiaId", type: sql.Int, value: materiaId },
      { name: "grupoId", type: sql.Int, value: grupoId },
      { name: "horario", type: sql.NVarChar, value: horario },
    ]);

    const newAssignmentId = inserted.recordset[0].asignacion_id;

    // Auto-enroll all students who accepted invitations for this group
    await runQuery(`
      INSERT INTO dbo.Inscripciones (alumno_id, asignacion_id, estatus)
      SELECT DISTINCT u.usuario_id, @asignacionId, 'activo'
      FROM dbo.Usuarios u
      JOIN dbo.InvitacionesAlumnos ia ON ia.correo = u.correo
      WHERE ia.grupo_id = @grupoId 
        AND ia.estatus = 'aceptada'
        AND NOT EXISTS (
          SELECT 1 FROM dbo.Inscripciones i2
          WHERE i2.alumno_id = u.usuario_id AND i2.asignacion_id = @asignacionId
        )
    `, [
      { name: "asignacionId", type: sql.Int, value: newAssignmentId },
      { name: "grupoId", type: sql.Int, value: parseInt(grupoId) }
    ]);

    return res.status(201).json({
      asignacion_id: newAssignmentId,
      docenteId,
      materiaId,
      grupoId,
      horario,
    });
  } catch (error) {
    console.error("Error creating assignment:", error);
    return res
      .status(500)
      .json({ message: "No se pudo registrar la asignación" });
  }
};

export const deleteAssignment = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "ID de asignación obligatorio" });
  }

  try {
    const asignacionId = parseInt(id);

    // Verify assignment period is not closed
    const asgCheck = await runQuery("SELECT periodo_id FROM dbo.AsignacionesDocentes WHERE asignacion_id = @id", [
      { name: "id", type: sql.Int, value: asignacionId }
    ]);
    if (asgCheck.recordset.length > 0) {
      const pId = asgCheck.recordset[0].periodo_id;
      if (await isPeriodClosed(pId)) {
        return res.status(403).json({
          message: "No se puede eliminar la asignación de un ciclo escolar concluido (modo solo lectura)."
        });
      }
    }

    // 1. Delete RegistrosAsistencia for the sessions of this assignment
    await runQuery(`
      DELETE ra
      FROM dbo.RegistrosAsistencia ra
      JOIN dbo.SesionesAsistencia sa ON ra.sesion_id = sa.sesion_id
      WHERE sa.asignacion_id = @asignacionId
    `, [{ name: "asignacionId", type: sql.Int, value: asignacionId }]);

    // 2. Delete TokensAsistencia
    await runQuery(`
      DELETE FROM dbo.TokensAsistencia
      WHERE asignacion_id = @asignacionId
    `, [{ name: "asignacionId", type: sql.Int, value: asignacionId }]);

    // 3. Delete SesionesAsistencia
    await runQuery(`
      DELETE FROM dbo.SesionesAsistencia
      WHERE asignacion_id = @asignacionId
    `, [{ name: "asignacionId", type: sql.Int, value: asignacionId }]);

    // 4. Delete Inscripciones
    await runQuery(`
      DELETE FROM dbo.Inscripciones
      WHERE asignacion_id = @asignacionId
    `, [{ name: "asignacionId", type: sql.Int, value: asignacionId }]);

    // 5. Delete AsignacionesDocentes
    await runQuery(`
      DELETE FROM dbo.AsignacionesDocentes
      WHERE asignacion_id = @asignacionId
    `, [{ name: "asignacionId", type: sql.Int, value: asignacionId }]);

    return res.json({ success: true, message: "Asignación desvinculada con éxito" });
  } catch (error) {
    console.error("Error deleting assignment:", error);
    return res.status(500).json({ message: "No se pudo eliminar la asignación" });
  }
};

export const deleteMyAssignment = async (req, res) => {
  const docenteId = req.user?.id;
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "ID de asignación obligatorio" });
  }

  try {
    const asignacionId = parseInt(id);

    // Verify this assignment is taught by this teacher
    const checkDocente = await runQuery(`
      SELECT docente_id FROM dbo.AsignacionesDocentes
      WHERE asignacion_id = @asignacionId
    `, [{ name: "asignacionId", type: sql.Int, value: asignacionId }]);

    if (checkDocente.recordset.length === 0) {
      return res.status(404).json({ message: "Asignación no encontrada" });
    }

    if (checkDocente.recordset[0].docente_id !== docenteId) {
      return res.status(403).json({ message: "No tienes permiso para desvincular esta asignatura" });
    }

    // Proceed with cascade delete:
    // 1. Delete RegistrosAsistencia for the sessions of this assignment
    await runQuery(`
      DELETE ra
      FROM dbo.RegistrosAsistencia ra
      JOIN dbo.SesionesAsistencia sa ON ra.sesion_id = sa.sesion_id
      WHERE sa.asignacion_id = @asignacionId
    `, [{ name: "asignacionId", type: sql.Int, value: asignacionId }]);

    // 2. Delete TokensAsistencia
    await runQuery(`
      DELETE FROM dbo.TokensAsistencia
      WHERE asignacion_id = @asignacionId
    `, [{ name: "asignacionId", type: sql.Int, value: asignacionId }]);

    // 3. Delete SesionesAsistencia
    await runQuery(`
      DELETE FROM dbo.SesionesAsistencia
      WHERE asignacion_id = @asignacionId
    `, [{ name: "asignacionId", type: sql.Int, value: asignacionId }]);

    // 4. Delete Inscripciones
    await runQuery(`
      DELETE FROM dbo.Inscripciones
      WHERE asignacion_id = @asignacionId
    `, [{ name: "asignacionId", type: sql.Int, value: asignacionId }]);

    // 5. Delete AsignacionesDocentes
    await runQuery(`
      DELETE FROM dbo.AsignacionesDocentes
      WHERE asignacion_id = @asignacionId
    `, [{ name: "asignacionId", type: sql.Int, value: asignacionId }]);

    return res.json({ success: true, message: "Te has desvinculado de la materia con éxito" });
  } catch (error) {
    console.error("Error releasing teacher assignment:", error);
    return res.status(500).json({ message: "No se pudo desvincular de la materia" });
  }
};

export const updateAssignment = async (req, res) => {
  const { id } = req.params;
  const { horario, docente_id } = req.body || {};

  if (!id) {
    return res.status(400).json({ message: "ID de asignación obligatorio" });
  }

  try {
    const asignacionId = parseInt(id);

    const existing = await runQuery(`
      SELECT asignacion_id, docente_id, materia_id, grupo_id, horario, periodo_id
      FROM dbo.AsignacionesDocentes
      WHERE asignacion_id = @asignacionId
    `, [{ name: "asignacionId", type: sql.Int, value: asignacionId }]);

    if (!existing.recordset || existing.recordset.length === 0) {
      return res.status(404).json({ message: "Asignación no encontrada" });
    }

    const current = existing.recordset[0];
    const newDocenteId = docente_id !== undefined && docente_id !== '' ? parseInt(docente_id) : current.docente_id;
    const newHorario = horario !== undefined ? String(horario).trim() : current.horario;

    await runQuery(`
      UPDATE dbo.AsignacionesDocentes
      SET horario = @horario,
          docente_id = @docenteId
      WHERE asignacion_id = @asignacionId
    `, [
      { name: "asignacionId", type: sql.Int, value: asignacionId },
      { name: "horario", type: sql.NVarChar, value: newHorario },
      { name: "docenteId", type: sql.Int, value: newDocenteId }
    ]);

    return res.json({ 
      success: true, 
      message: "Asignación actualizada con éxito",
      asignacion_id: asignacionId,
      docente_id: newDocenteId,
      horario: newHorario
    });
  } catch (error) {
    console.error("Error updating assignment:", error);
    return res.status(500).json({ message: "No se pudo actualizar la asignación" });
  }
};

// --- Helper functions for Excel parsing (based on import_docentes.js) ---

function generateEmail(nombreCompleto, existingEmails) {
  const normalized = nombreCompleto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z\s]/g, "") // keep only letters and spaces
    .trim();

  const parts = normalized.split(/\s+/).filter((p) => p.length > 0);
  
  let firstName = "docente";
  let lastName = "tesci";

  if (parts.length >= 3) {
    firstName = parts[2];
    lastName = parts[0];
  } else if (parts.length === 2) {
    firstName = parts[1];
    lastName = parts[0];
  } else if (parts.length === 1) {
    firstName = parts[0];
  }

  let baseEmail = `${firstName}.${lastName}@tesci.edu.mx`;
  let finalEmail = baseEmail;
  let counter = 1;

  while (existingEmails.has(finalEmail)) {
    finalEmail = `${firstName}.${lastName}${counter}@tesci.edu.mx`;
    counter++;
  }

  existingEmails.add(finalEmail);
  return finalEmail;
}

function parseSemesterFromGroup(grupoStr, excelSemester) {
  if (!grupoStr || grupoStr.trim() === "*") return 0;
  
  const digits = grupoStr.replace(/[^0-9]/g, "");
  
  if (digits.length === 3) {
    const sem = parseInt(digits[1]);
    if (sem >= 1 && sem <= 9) return sem;
  } else if (digits.length === 4) {
    const sem = parseInt(digits[2]);
    if (sem >= 1 && sem <= 9) return sem;
  }

  if (excelSemester && !isNaN(excelSemester)) {
    const sem = parseInt(excelSemester);
    if (sem >= 1 && sem <= 12) return sem;
  }

  return 1;
}

function parseTurnFromGroup(grupoStr) {
  if (!grupoStr || grupoStr.trim() === "*") return "Mixto";
  const upper = grupoStr.toUpperCase();
  
  if (upper.includes("V")) return "Vespertino";
  if (upper.includes("MTI") || upper.includes("TICS") || upper.includes("L")) return "Mixto";
  if (upper.includes("M")) return "Matutino";
  
  return "Matutino";
}

function getCareerClave(grupoStr) {
  if (!grupoStr || grupoStr.trim() === "*") return "OTR";
  const upper = grupoStr.toUpperCase();

  if (upper.startsWith("3")) return "ISC";
  if (upper.startsWith("1") && !upper.startsWith("10") && !upper.startsWith("11") && !upper.startsWith("12") && !upper.startsWith("13") && !upper.startsWith("14") && !upper.startsWith("15") && !upper.startsWith("16") && !upper.startsWith("17") && !upper.startsWith("18") && !upper.startsWith("19")) {
    return "IAD";
  }
  if (upper.endsWith("L") && (upper.startsWith("1") || upper.startsWith("6"))) {
    if (upper.startsWith("1")) return "IAD";
    if (upper.startsWith("6")) return "IIN";
  }
  if (upper.startsWith("6")) return "IIN";
  if (upper.includes("TICS")) return "ITIC";
  if (upper.includes("MTI")) return "MTI";
  if (upper.startsWith("10")) return "IMEC";

  return "OTR";
}

function generateSubjectCode(subjectName) {
  if (!subjectName) return "GEN-MAT-000";
  const normalized = subjectName
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z]/g, "")
    .slice(0, 8);
  
  return `ADM-${normalized}`;
}

export const importAssignments = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No se proporcionó ningún archivo" });
  }

  const { periodoId } = req.body || {};
  if (!periodoId) {
    return res.status(400).json({ message: "El ID de periodo escolar es obligatorio" });
  }

  try {
    if (await isPeriodClosed(parseInt(periodoId))) {
      return res.status(403).json({
        message: "No se puede importar horarios en un ciclo escolar concluido (modo solo lectura)."
      });
    }

    const pool = await getPool();

    // Check if period is intersemestral
    const periodCheck = await pool.request()
      .input("periodoId", sql.Int, parseInt(periodId))
      .query("SELECT nombre FROM dbo.PeriodosEscolares WHERE periodo_id = @periodoId");
    const pRec = periodCheck.recordset[0];
    const isInterPeriod = pRec?.nombre?.toLowerCase().includes("intersemestral");

    // 1. Fetch existing users (teachers)
    const teachersResult = await pool.request().query(`
      SELECT u.usuario_id, u.nombre_completo, pd.clave_docente, u.correo
      FROM dbo.Usuarios u
      LEFT JOIN dbo.PerfilesDocentes pd ON pd.usuario_id = u.usuario_id
      WHERE u.rol_id = 2
    `);
    const teacherByClave = new Map();
    const teacherByName = new Map();
    const existingEmails = new Set();
    
    teachersResult.recordset.forEach(r => {
      if (r.correo) existingEmails.add(r.correo.toLowerCase());
      if (r.clave_docente) {
        teacherByClave.set(r.clave_docente.toLowerCase().trim(), r.usuario_id);
      }
      if (r.nombre_completo) {
        teacherByName.set(r.nombre_completo.toLowerCase().trim(), r.usuario_id);
      }
    });

    // Fetch all existing emails (including admins/students) to avoid duplicates
    const allEmailsResult = await pool.request().query("SELECT correo FROM dbo.Usuarios");
    allEmailsResult.recordset.forEach(r => {
      if (r.correo) existingEmails.add(r.correo.toLowerCase());
    });

    // 2. Fetch existing subjects
    const subjectsResult = await pool.request().query("SELECT materia_id, clave, nombre FROM dbo.Materias");
    const subjectByClave = new Map();
    const subjectByName = new Map();
    subjectsResult.recordset.forEach(r => {
      if (r.clave) subjectByClave.set(r.clave.toLowerCase().trim(), r.materia_id);
      if (r.nombre) subjectByName.set(r.nombre.toLowerCase().trim(), r.materia_id);
    });

    // 3. Fetch existing groups (ordinary ones + those from this period)
    const groupsResult = await pool.request()
      .input("periodoId", sql.Int, parseInt(periodoId))
      .query("SELECT grupo_id, clave FROM dbo.Grupos WHERE periodo_id IS NULL OR periodo_id = @periodoId");
    const groupByClave = new Map();
    groupsResult.recordset.forEach(r => {
      if (r.clave) groupByClave.set(r.clave.toLowerCase().trim(), r.grupo_id);
    });

    // 4. Fetch existing assignments for this period
    const assignmentsResult = await pool.request()
      .input("periodoId", sql.Int, parseInt(periodoId))
      .query(`
        SELECT asignacion_id, docente_id, materia_id, grupo_id, horario
        FROM dbo.AsignacionesDocentes
        WHERE periodo_id = @periodoId OR (periodo_id IS NULL AND @periodoId IS NULL)
      `);
    const assignmentsMap = new Map();
    assignmentsResult.recordset.forEach(r => {
      const key = `${r.docente_id}|${r.materia_id}|${r.grupo_id}`;
      assignmentsMap.set(key, { id: r.asignacion_id, horario: r.horario });
    });

    // 5. Fetch career mappings for quick lookup
    const careerDbResult = await pool.request().query("SELECT carrera_id, clave FROM dbo.Carreras");
    const careerMap = {};
    careerDbResult.recordset.forEach(row => {
      careerMap[row.clave] = row.carrera_id;
    });

    const workbook = new exceljs.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ message: "El archivo Excel no tiene hojas de cálculo" });
    }

    let headerRowIdx = -1;
    worksheet.eachRow((row, rowNumber) => {
      const firstCell = row.getCell(1).value;
      if (firstCell && firstCell.toString().toUpperCase().includes("GRUPO")) {
        headerRowIdx = rowNumber;
      }
    });

    if (headerRowIdx === -1) {
      return res.status(400).json({ message: "No se encontró la fila de encabezados en el archivo Excel" });
    }

    const defaultPasswordHash = await bcrypt.hash("docente123", 10);

    let processedCount = 0;
    let createdDocentesCount = 0;
    let createdMateriasCount = 0;
    let createdGruposCount = 0;
    let createdAsignacionesCount = 0;

    for (let i = headerRowIdx + 1; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      
      const grupoVal = row.getCell(1).value;
      const semestreVal = row.getCell(2).value;
      const claveDocenteVal = row.getCell(3).value;
      const nombreDocenteVal = row.getCell(4).value;
      const materiaNameVal = row.getCell(5).value;
      const materiaClaveVal = row.getCell(6).value;
      
      if (!nombreDocenteVal && !grupoVal && !materiaNameVal) continue;

      processedCount++;

      // A. Process Teacher
      let teacherName = (nombreDocenteVal || "Docente Asignado").toString().trim();
      let teacherClave = claveDocenteVal ? claveDocenteVal.toString().trim() : null;

      if (!teacherClave || teacherClave === "*") {
        const cleanName = teacherName.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 10);
        teacherClave = `TEMP-${cleanName || "DOC"}`;
      }

      let docenteId = null;
      let lowerClave = teacherClave.toLowerCase().trim();
      let lowerName = teacherName.toLowerCase().trim();
      
      if (teacherByClave.has(lowerClave)) {
        docenteId = teacherByClave.get(lowerClave);
      } else if (teacherByName.has(lowerName)) {
        docenteId = teacherByName.get(lowerName);
        await pool.request()
          .input("uid", sql.Int, docenteId)
          .input("clave", sql.VarChar, teacherClave)
          .query("UPDATE dbo.PerfilesDocentes SET clave_docente = @clave WHERE usuario_id = @uid AND clave_docente IS NULL");
        teacherByClave.set(lowerClave, docenteId);
      } else {
        const teacherEmail = generateEmail(teacherName, existingEmails);
        const insertUser = await pool.request()
          .input("nombre", sql.NVarChar, teacherName)
          .input("correo", sql.NVarChar, teacherEmail)
          .input("hash", sql.NVarChar, defaultPasswordHash)
          .query(`
            INSERT INTO dbo.Usuarios (rol_id, nombre_completo, correo, password_hash)
            OUTPUT INSERTED.usuario_id
            VALUES (2, @nombre, @correo, @hash)
          `);
        
        docenteId = insertUser.recordset[0].usuario_id;
        const teacherTurn = parseTurnFromGroup(grupoVal ? grupoVal.toString() : "");

        await pool.request()
          .input("uid", sql.Int, docenteId)
          .input("turno", sql.VarChar, teacherTurn)
          .input("clave", sql.VarChar, teacherClave)
          .query(`
            INSERT INTO dbo.PerfilesDocentes (usuario_id, turno, clave_docente)
            VALUES (@uid, @turno, @clave)
          `);

        teacherByClave.set(lowerClave, docenteId);
        teacherByName.set(lowerName, docenteId);
        createdDocentesCount++;
      }

      // B. Process Materia
      let materiaName = (materiaNameVal || "Materia Genérica").toString().trim();
      let materiaClave = materiaClaveVal ? materiaClaveVal.toString().trim() : null;

      if (!materiaClave || materiaClave === "*") {
        const upperName = materiaName.toUpperCase();
        if (upperName.includes("FORTALECIMIENTO")) materiaClave = "ADM-FORT";
        else if (upperName.includes("INVESTIGACION")) materiaClave = "ADM-INV";
        else if (upperName.includes("TESIS")) materiaClave = "ADM-TESIS";
        else if (upperName.includes("CACEI")) materiaClave = "ADM-CACEI";
        else if (upperName.includes("TUTORIA")) {
          materiaClave = "TUTO-001";
          materiaName = "Tutoría";
        }
        else materiaClave = generateSubjectCode(materiaName);
      }

      let materiaId = null;
      let lowerMatClave = materiaClave.toLowerCase().trim();
      let lowerMatName = materiaName.toLowerCase().trim();
      
      if (subjectByClave.has(lowerMatClave)) {
        materiaId = subjectByClave.get(lowerMatClave);
      } else if (subjectByName.has(lowerMatName)) {
        materiaId = subjectByName.get(lowerMatName);
      } else {
        const insertSubject = await pool.request()
          .input("clave", sql.VarChar, materiaClave)
          .input("nombre", sql.NVarChar, materiaName)
          .query(`
            INSERT INTO dbo.Materias (clave, nombre, creditos)
            OUTPUT INSERTED.materia_id
            VALUES (@clave, @nombre, 5)
          `);
        materiaId = insertSubject.recordset[0].materia_id;
        subjectByClave.set(lowerMatClave, materiaId);
        subjectByName.set(lowerMatName, materiaId);
        createdMateriasCount++;
      }

      // C. Process Grupo
      let grupoClave = (grupoVal || "*").toString().trim();
      let excelSemestre = semestreVal ? semestreVal.toString().trim() : null;

      let grupoId = null;
      let lowerGrpClave = grupoClave.toLowerCase().trim();
      
      if (groupByClave.has(lowerGrpClave)) {
        grupoId = groupByClave.get(lowerGrpClave);
      } else {
        const semester = parseSemesterFromGroup(grupoClave, excelSemestre);
        const turn = parseTurnFromGroup(grupoClave);
        const careerClave = getCareerClave(grupoClave);
        const careerId = careerMap[careerClave] || careerMap["OTR"];

        const insertGroup = await pool.request()
          .input("clave", sql.VarChar, grupoClave)
          .input("semestre", sql.TinyInt, semester)
          .input("turno", sql.VarChar, turn)
          .input("carreraId", sql.Int, careerId)
          .input("periodoId", sql.Int, isInterPeriod ? parseInt(periodoId) : null)
          .query(`
            INSERT INTO dbo.Grupos (clave, semestre, turno, cupo, carrera_id, periodo_id)
            OUTPUT INSERTED.grupo_id
            VALUES (@clave, @semestre, @turno, 30, @carreraId, @periodoId)
          `);
        grupoId = insertGroup.recordset[0].grupo_id;
        groupByClave.set(lowerGrpClave, grupoId);
        createdGruposCount++;
      }

      // D. Parse Schedule Columns (Lunes=col 7 to Sabado=col 12)
      const daysAbbrev = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];
      const scheduleBlocks = [];

      for (let dayOffset = 0; dayOffset < 6; dayOffset++) {
        const cellVal = row.getCell(7 + dayOffset).value;
        if (cellVal) {
          const hours = cellVal.toString().trim();
          scheduleBlocks.push(`${daysAbbrev[dayOffset]} ${hours}`);
        }
      }

      const horarioString = scheduleBlocks.join(", ") || "Sin horario";

      // E. Create or Update AsignacionDocente
      const assignmentKey = `${docenteId}|${materiaId}|${grupoId}`;
      const existingAssignment = assignmentsMap.get(assignmentKey);
      
      if (!existingAssignment) {
        await pool.request()
          .input("docenteId", sql.Int, docenteId)
          .input("materiaId", sql.Int, materiaId)
          .input("grupoId", sql.Int, grupoId)
          .input("horario", sql.NVarChar, horarioString)
          .input("periodoId", sql.Int, parseInt(periodoId))
          .query(`
            INSERT INTO dbo.AsignacionesDocentes (docente_id, materia_id, grupo_id, horario, periodo_id)
            VALUES (@docenteId, @materiaId, @grupoId, @horario, @periodoId);
          `);
        createdAsignacionesCount++;
      } else if (existingAssignment.horario !== horarioString) {
        await pool.request()
          .input("id", sql.Int, existingAssignment.id)
          .input("horario", sql.NVarChar, horarioString)
          .query(`
            UPDATE dbo.AsignacionesDocentes
            SET horario = @horario
            WHERE asignacion_id = @id
          `);
      }
    }

    // Automatically migrate and sync student enrollments/groups for this period
    await syncStudentEnrollmentsForActivePeriod();

    return res.json({
      success: true,
      message: "Horarios importados y sincronizados con éxito",
      stats: {
        processedCount,
        createdDocentesCount,
        createdMateriasCount,
        createdGruposCount,
        createdAsignacionesCount
      }
    });

  } catch (error) {
    console.error("Error importAssignments:", error);
    return res.status(500).json({ message: `Error al procesar el archivo Excel: ${error.message}` });
  }
};

export const getIntersemestralClasses = async (req, res) => {
  try {
    const activePeriodId = await runQuery(`
      SELECT TOP 1 periodo_id FROM dbo.PeriodosEscolares WHERE activo = 1 ORDER BY creado_en DESC
    `);
    
    const periodoId = activePeriodId.recordset[0]?.periodo_id;
    if (!periodoId) {
      return res.status(404).json({ message: "No hay un ciclo activo configurado" });
    }

    const result = await runQuery(`
      SELECT 
        ad.asignacion_id AS id,
        ad.docente_id,
        u.nombre_completo AS docente_nombre,
        ad.materia_id,
        m.nombre AS materia_nombre,
        m.clave AS materia_clave,
        ad.grupo_id,
        g.clave AS grupo_clave,
        g.cupo AS grupo_cupo,
        ad.horario,
        (SELECT COUNT(*) FROM dbo.Inscripciones i WHERE i.asignacion_id = ad.asignacion_id) AS alumnos_inscritos
      FROM dbo.AsignacionesDocentes ad
      JOIN dbo.Usuarios u ON ad.docente_id = u.usuario_id
      JOIN dbo.Materias m ON ad.materia_id = m.materia_id
      JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
      WHERE ad.periodo_id = @periodoId
      ORDER BY m.nombre;
    `, [{ name: "periodoId", type: sql.Int, value: periodoId }]);

    return res.json(result.recordset);
  } catch (error) {
    console.error("Error getIntersemestralClasses:", error);
    return res.status(500).json({ message: "Error al obtener las materias intersemestrales" });
  }
};

export const getIntersemestralStudents = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await runQuery(`
      SELECT 
        u.usuario_id AS id,
        u.nombre_completo AS nombre,
        u.correo,
        pa.matricula
      FROM dbo.Inscripciones i
      JOIN dbo.Usuarios u ON i.alumno_id = u.usuario_id
      JOIN dbo.PerfilesAlumnos pa ON pa.usuario_id = u.usuario_id
      WHERE i.asignacion_id = @asignacionId AND u.activo = 1
      ORDER BY u.nombre_completo;
    `, [{ name: "asignacionId", type: sql.Int, value: parseInt(id) }]);

    return res.json(result.recordset);
  } catch (error) {
    console.error("Error getIntersemestralStudents:", error);
    return res.status(500).json({ message: "Error al obtener alumnos inscritos" });
  }
};

export const enrollStudentIntersemestral = async (req, res) => {
  const { alumnoId, asignacionId } = req.body || {};

  if (!alumnoId || !asignacionId) {
    return res.status(400).json({ message: "alumnoId y asignacionId son obligatorios" });
  }

  try {
    const classCheck = await runQuery(`
      SELECT 
        ad.grupo_id,
        g.cupo AS grupo_cupo,
        (SELECT COUNT(*) FROM dbo.Inscripciones i WHERE i.asignacion_id = ad.asignacion_id) AS alumnos_inscritos
      FROM dbo.AsignacionesDocentes ad
      JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
      WHERE ad.asignacion_id = @asignacionId
    `, [{ name: "asignacionId", type: sql.Int, value: parseInt(asignacionId) }]);

    if (!classCheck.recordset.length) {
      return res.status(404).json({ message: "La materia ofertada no existe" });
    }

    const { grupo_id, grupo_cupo, alumnos_inscritos } = classCheck.recordset[0];

    if (alumnos_inscritos >= grupo_cupo) {
      return res.status(400).json({ message: `La materia ha alcanzado su cupo límite de ${grupo_cupo} alumnos` });
    }

    const enrollCheck = await runQuery(`
      SELECT 1 FROM dbo.Inscripciones 
      WHERE alumno_id = @alumnoId AND asignacion_id = @asignacionId
    `, [
      { name: "alumnoId", type: sql.Int, value: parseInt(alumnoId) },
      { name: "asignacionId", type: sql.Int, value: parseInt(asignacionId) }
    ]);

    if (enrollCheck.recordset.length > 0) {
      return res.status(409).json({ message: "El alumno ya está inscrito en esta materia" });
    }

    await runQuery(`
      INSERT INTO dbo.Inscripciones (alumno_id, asignacion_id, estatus)
      VALUES (@alumnoId, @asignacionId, 'activo')
    `, [
      { name: "alumnoId", type: sql.Int, value: parseInt(alumnoId) },
      { name: "asignacionId", type: sql.Int, value: parseInt(asignacionId) }
    ]);

    return res.json({ success: true, message: "Alumno inscrito con éxito" });
  } catch (error) {
    console.error("Error enrollStudentIntersemestral:", error);
    return res.status(500).json({ message: "Error al inscribir al alumno" });
  }
};

export const deregisterStudentIntersemestral = async (req, res) => {
  const { alumnoId, asignacionId } = req.body || {};

  if (!alumnoId || !asignacionId) {
    return res.status(400).json({ message: "alumnoId y asignacionId son obligatorios" });
  }

  try {
    await runQuery(`
      DELETE FROM dbo.Inscripciones
      WHERE alumno_id = @alumnoId AND asignacion_id = @asignacionId
    `, [
      { name: "alumnoId", type: sql.Int, value: parseInt(alumnoId) },
      { name: "asignacionId", type: sql.Int, value: parseInt(asignacionId) }
    ]);

    return res.json({ success: true, message: "Alumno desvinculado con éxito" });
  } catch (error) {
    console.error("Error deregisterStudentIntersemestral:", error);
    return res.status(500).json({ message: "Error al desvincular al alumno" });
  }
};

export const updateIntersemestralCupo = async (req, res) => {
  const { id } = req.params;
  const { cupo } = req.body || {};

  if (!id || cupo === undefined) {
    return res.status(400).json({ message: "ID de asignación y nuevo cupo son obligatorios" });
  }

  try {
    const classCheck = await runQuery(`
      SELECT grupo_id FROM dbo.AsignacionesDocentes WHERE asignacion_id = @id
    `, [{ name: "id", type: sql.Int, value: parseInt(id) }]);

    if (!classCheck.recordset.length) {
      return res.status(404).json({ message: "La materia ofertada no existe" });
    }

    const { grupo_id } = classCheck.recordset[0];

    await runQuery(`
      UPDATE dbo.Grupos
      SET cupo = @cupo
      WHERE grupo_id = @grupoId
    `, [
      { name: "grupoId", type: sql.Int, value: grupo_id },
      { name: "cupo", type: sql.Int, value: parseInt(cupo) }
    ]);

    return res.json({ success: true, message: "Cupo límite actualizado con éxito", nuevo_cupo: cupo });
  } catch (error) {
    console.error("Error updateIntersemestralCupo:", error);
    return res.status(500).json({ message: "Error al actualizar el cupo límite" });
  }
};

export const clearActivePeriodAssignments = async (req, res) => {
  try {
    const activePeriodResult = await runQuery(`
      SELECT TOP 1 periodo_id FROM dbo.PeriodosEscolares WHERE activo = 1 ORDER BY creado_en DESC
    `);
    
    const periodoId = activePeriodResult.recordset[0]?.periodo_id;
    if (!periodoId) {
      return res.status(404).json({ message: "No hay un ciclo activo configurado" });
    }

    // 1. Delete registers in Inscripciones
    await runQuery(`
      DELETE FROM dbo.Inscripciones 
      WHERE asignacion_id IN (
        SELECT asignacion_id 
        FROM dbo.AsignacionesDocentes 
        WHERE periodo_id = @periodoId
      );
    `, [{ name: "periodoId", type: sql.Int, value: periodoId }]);

    // 2. Delete registers in RegistrosAsistencia
    await runQuery(`
      DELETE FROM dbo.RegistrosAsistencia
      WHERE sesion_id IN (
        SELECT sesion_id 
        FROM dbo.SesionesAsistencia sa
        JOIN dbo.AsignacionesDocentes ad ON sa.asignacion_id = ad.asignacion_id
        WHERE ad.periodo_id = @periodoId
      );
    `, [{ name: "periodoId", type: sql.Int, value: periodoId }]);

    // 3. Delete registers in SesionesAsistencia
    await runQuery(`
      DELETE FROM dbo.SesionesAsistencia
      WHERE asignacion_id IN (
        SELECT asignacion_id 
        FROM dbo.AsignacionesDocentes 
        WHERE periodo_id = @periodoId
      );
    `, [{ name: "periodoId", type: sql.Int, value: periodoId }]);

    // 4. Delete registers in AsignacionesDocentes
    await runQuery(`
      DELETE FROM dbo.AsignacionesDocentes
      WHERE periodo_id = @periodoId;
    `, [{ name: "periodoId", type: sql.Int, value: periodoId }]);

    return res.json({ success: true, message: "Todos los horarios y asignaciones del ciclo activo fueron eliminados con éxito" });
  } catch (error) {
    console.error("Error clearActivePeriodAssignments:", error);
    return res.status(500).json({ message: "Error al vaciar los datos del periodo activo" });
  }
};

export const createGroup = async (req, res) => {
  const { clave, turno, cupo = 30, semestre = 1 } = req.body || {};

  if (!clave || !turno) {
    return res.status(400).json({ message: "Clave y turno son obligatorios" });
  }

  try {
    if (await isPeriodClosed()) {
      return res.status(403).json({
        message: "El ciclo escolar activo ha concluido o está en modo solo lectura. No se permite crear grupos."
      });
    }

    const activePeriodResult = await runQuery(`
      SELECT TOP 1 periodo_id FROM dbo.PeriodosEscolares WHERE activo = 1 ORDER BY creado_en DESC
    `);
    const activePeriodId = activePeriodResult.recordset[0]?.periodo_id || null;

    const existing = await runQuery(`
      SELECT grupo_id, clave, semestre, turno, cupo 
      FROM dbo.Grupos 
      WHERE clave = @clave AND turno = @turno
    `, [
      { name: "clave", type: sql.VarChar, value: clave },
      { name: "turno", type: sql.VarChar, value: turno },
    ]);

    if (existing.recordset.length) {
      const g = existing.recordset[0];
      return res.status(200).json({
        grupo_id: g.grupo_id,
        clave: g.clave,
        semestre: g.semestre,
        turno: g.turno,
        cupo: g.cupo,
        message: "Grupo existente reutilizado"
      });
    }

    let parsedCarreraId = req.body.carrera_id ? parseInt(req.body.carrera_id) : null;
    if (!parsedCarreraId && req.body.carreraId) {
      parsedCarreraId = parseInt(req.body.carreraId);
    }
    if (!parsedCarreraId) {
      const careerRes = await runQuery(
        "SELECT TOP 1 carrera_id FROM dbo.Carreras WHERE clave = 'ISC' ORDER BY carrera_id ASC"
      );
      parsedCarreraId = careerRes.recordset[0]?.carrera_id || null;
    }

    const result = await runQuery(`
      INSERT INTO dbo.Grupos (clave, semestre, turno, cupo, carrera_id, periodo_id)
      OUTPUT INSERTED.grupo_id
      VALUES (@clave, @semestre, @turno, @cupo, @carreraId, @periodoId);
    `, [
      { name: "clave", type: sql.VarChar, value: clave },
      { name: "turno", type: sql.VarChar, value: turno },
      { name: "cupo", type: sql.Int, value: parseInt(cupo) },
      { name: "semestre", type: sql.TinyInt, value: parseInt(semestre) },
      { name: "carreraId", type: sql.Int, value: parsedCarreraId },
      { name: "periodoId", type: sql.Int, value: activePeriodId },
    ]);

    const newGroupId = result.recordset[0].grupo_id;

    return res.status(201).json({
      grupo_id: newGroupId,
      clave,
      semestre,
      turno,
      cupo,
      carrera_id: parsedCarreraId,
    });
  } catch (error) {
    console.error("Error creating group:", error);
    return res.status(500).json({ message: "Error al crear el grupo" });
  }
};

function getSemesterGroupKeyForSemester(oldKey, targetSemester) {
  const match = oldKey.match(/\d+/);
  if (!match) return oldKey;
  const digits = match[0];
  if (digits.length < 2) return oldKey;
  const semIndex = digits.length - 2;
  const nextDigits = digits.substring(0, semIndex) + targetSemester + digits.substring(semIndex + 1);
  return oldKey.replace(digits, nextDigits);
}

async function resolveStudentsByGroupForCycle(targetCiclo) {
  let activePeriod = null;
  if (targetCiclo) {
    const pRes = await runQuery(
      "SELECT TOP 1 periodo_id, clave, nombre FROM dbo.PeriodosEscolares WHERE clave = @ciclo",
      [{ name: "ciclo", type: sql.VarChar, value: targetCiclo }]
    );
    if (pRes.recordset.length > 0) activePeriod = pRes.recordset[0];
  }
  if (!activePeriod) {
    const pRes = await runQuery(
      "SELECT TOP 1 periodo_id, clave, nombre FROM dbo.PeriodosEscolares WHERE activo = 1 ORDER BY creado_en DESC"
    );
    activePeriod = pRes.recordset[0];
  }
  const activePeriodId = activePeriod?.periodo_id || null;

  const allPeriodsResult = await runQuery(
    "SELECT periodo_id, nombre FROM dbo.PeriodosEscolares ORDER BY fecha_inicio ASC"
  );
  const regularPeriods = allPeriodsResult.recordset.filter(p => !p.nombre.toLowerCase().includes("intersemestral"));
  const periodIndexMap = new Map();
  regularPeriods.forEach((p, idx) => {
    periodIndexMap.set(p.periodo_id, idx);
  });

  const [allStudents, allGroups] = await Promise.all([
    runQuery(`
      SELECT 
        u.usuario_id AS alumno_id,
        u.nombre_completo,
        u.correo,
        pa.matricula,
        pa.semestre AS base_semestre,
        (
          SELECT TOP 1 g.grupo_id
          FROM dbo.Inscripciones i
          JOIN dbo.AsignacionesDocentes ad ON i.asignacion_id = ad.asignacion_id
          JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
          WHERE i.alumno_id = u.usuario_id AND ad.periodo_id = @activePeriodId AND i.estatus = 'activo'
        ) AS active_grupo_id,
        (
          SELECT TOP 1 g.clave
          FROM dbo.Inscripciones i
          JOIN dbo.AsignacionesDocentes ad ON i.asignacion_id = ad.asignacion_id
          JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
          WHERE i.alumno_id = u.usuario_id AND ad.periodo_id = @activePeriodId AND i.estatus = 'activo'
        ) AS active_grupo_clave,
        (
          SELECT TOP 1 g.semestre
          FROM dbo.Inscripciones i
          JOIN dbo.AsignacionesDocentes ad ON i.asignacion_id = ad.asignacion_id
          JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
          WHERE i.alumno_id = u.usuario_id AND ad.periodo_id = @activePeriodId AND i.estatus = 'activo'
        ) AS active_grupo_semestre,
        (
          SELECT TOP 1 g.grupo_id
          FROM dbo.Inscripciones i
          JOIN dbo.AsignacionesDocentes ad ON i.asignacion_id = ad.asignacion_id
          JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
          WHERE i.alumno_id = u.usuario_id AND i.estatus = 'activo'
          ORDER BY ad.periodo_id DESC
        ) AS last_grupo_id,
        (
          SELECT TOP 1 g.clave
          FROM dbo.Inscripciones i
          JOIN dbo.AsignacionesDocentes ad ON i.asignacion_id = ad.asignacion_id
          JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
          WHERE i.alumno_id = u.usuario_id AND i.estatus = 'activo'
          ORDER BY ad.periodo_id DESC
        ) AS last_grupo_clave,
        (
          SELECT TOP 1 g.semestre
          FROM dbo.Inscripciones i
          JOIN dbo.AsignacionesDocentes ad ON i.asignacion_id = ad.asignacion_id
          JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
          WHERE i.alumno_id = u.usuario_id AND i.estatus = 'activo'
          ORDER BY ad.periodo_id DESC
        ) AS last_grupo_semestre,
        (
          SELECT TOP 1 ad.periodo_id
          FROM dbo.Inscripciones i
          JOIN dbo.AsignacionesDocentes ad ON i.asignacion_id = ad.asignacion_id
          WHERE i.alumno_id = u.usuario_id AND i.estatus = 'activo'
          ORDER BY ad.periodo_id DESC
        ) AS last_grupo_periodo_id
      FROM dbo.Usuarios u
      JOIN dbo.PerfilesAlumnos pa ON u.usuario_id = pa.usuario_id
      WHERE u.activo = 1 AND u.rol_id = 3 AND u.is_debug = 0
    `, [{ name: "activePeriodId", type: sql.Int, value: activePeriodId }]),
    runQuery("SELECT grupo_id, clave, semestre FROM dbo.Grupos")
  ]);

  const groupKeyMap = new Map();
  allGroups.recordset.forEach(g => {
    groupKeyMap.set(g.clave.toLowerCase().trim(), g);
  });

  const studentsByGroupId = new Map();

  allStudents.recordset.forEach(s => {
    let assignedGroupId = s.active_grupo_id;
    let assignedSemester = s.active_grupo_semestre || s.base_semestre;

    if (!assignedGroupId && s.last_grupo_clave && s.last_grupo_periodo_id) {
      const lastIdx = periodIndexMap.get(s.last_grupo_periodo_id);
      const activeIdx = periodIndexMap.get(activePeriodId);
      if (lastIdx !== undefined && activeIdx !== undefined) {
        const diff = activeIdx - lastIdx;
        assignedSemester = s.last_grupo_semestre + diff;
        if (assignedSemester > 9) assignedSemester = 9;
        if (assignedSemester < 1) assignedSemester = 1;

        const projectedKey = getSemesterGroupKeyForSemester(s.last_grupo_clave, assignedSemester);
        const projectedGroup = groupKeyMap.get(projectedKey.toLowerCase().trim());
        if (projectedGroup) {
          assignedGroupId = projectedGroup.grupo_id;
        }
      }
    }

    if (assignedGroupId) {
      if (!studentsByGroupId.has(assignedGroupId)) {
        studentsByGroupId.set(assignedGroupId, []);
      }
      studentsByGroupId.get(assignedGroupId).push({
        alumno_id: s.alumno_id,
        nombre_completo: s.nombre_completo,
        correo: s.correo,
        matricula: s.matricula,
        semestre: assignedSemester,
        total_materias_inscritas: 0
      });
    }
  });

  return { activePeriodId, studentsByGroupId };
}

export const getAllGroups = async (req, res) => {
  const { ciclo = null } = req.query;
  try {
    const { activePeriodId, studentsByGroupId } = await resolveStudentsByGroupForCycle(ciclo);

    const query = `
      SELECT 
        g.grupo_id,
        g.clave,
        g.semestre,
        g.turno,
        g.cupo,
        g.carrera_id,
        g.periodo_id,
        c.clave AS carrera_clave,
        c.nombre AS carrera_nombre,
        (SELECT COUNT(DISTINCT ad.asignacion_id) 
         FROM dbo.AsignacionesDocentes ad 
         WHERE ad.grupo_id = g.grupo_id AND (ad.periodo_id = @activePeriodId OR (@activePeriodId IS NULL AND ad.periodo_id IS NULL))) AS total_materias,
        (SELECT COUNT(*) 
         FROM dbo.InvitacionesAlumnos ia 
         WHERE ia.grupo_id = g.grupo_id) AS total_invitaciones
      FROM dbo.Grupos g
      LEFT JOIN dbo.Carreras c ON g.carrera_id = c.carrera_id
      WHERE (UPPER(RTRIM(g.clave)) LIKE '%M' OR UPPER(RTRIM(g.clave)) LIKE '%V')
        AND g.clave != '*'
      ORDER BY g.semestre, g.clave;
    `;

    const result = await runQuery(query, [{ name: "activePeriodId", type: sql.Int, value: activePeriodId }]);
    
    const enriched = result.recordset.map(g => ({
      ...g,
      total_alumnos: studentsByGroupId.get(g.grupo_id)?.length || 0
    }));

    return res.json(enriched);
  } catch (error) {
    console.error("Error getAllGroups:", error);
    return res.status(500).json({ message: "Error al obtener la lista de grupos" });
  }
};

export const updateGroup = async (req, res) => {
  const { id } = req.params;
  const { clave, turno, semestre, cupo } = req.body || {};
  const adminId = req.user?.id || null;

  if (!id) {
    return res.status(400).json({ message: "ID de grupo obligatorio" });
  }

  if (!clave || !turno) {
    return res.status(400).json({ message: "Clave y turno son obligatorios" });
  }

  try {
    const grupoId = parseInt(id);

    const groupCheck = await runQuery(
      "SELECT grupo_id, clave, turno, semestre, cupo, periodo_id FROM dbo.Grupos WHERE grupo_id = @grupoId",
      [{ name: "grupoId", type: sql.Int, value: grupoId }]
    );

    if (groupCheck.recordset.length === 0) {
      return res.status(404).json({ message: "Grupo no encontrado" });
    }

    const groupInfo = groupCheck.recordset[0];

    if (groupInfo.periodo_id && await isPeriodClosed(groupInfo.periodo_id)) {
      return res.status(403).json({
        message: "No se puede editar un grupo de un ciclo escolar concluido (modo solo lectura)."
      });
    }

    // Check if another group already has this clave + turno
    const existing = await runQuery(
      `SELECT grupo_id FROM dbo.Grupos WHERE clave = @clave AND turno = @turno AND grupo_id != @grupoId`,
      [
        { name: "clave", type: sql.VarChar, value: clave.trim() },
        { name: "turno", type: sql.VarChar, value: turno },
        { name: "grupoId", type: sql.Int, value: grupoId }
      ]
    );

    if (existing.recordset.length > 0) {
      return res.status(400).json({
        message: `Ya existe otro grupo con la clave "${clave.trim()}" y turno "${turno}".`
      });
    }

    const parsedSemestre = semestre !== undefined ? parseInt(semestre) : groupInfo.semestre;
    const parsedCupo = cupo !== undefined ? parseInt(cupo) : groupInfo.cupo;

    await runQuery(`
      UPDATE dbo.Grupos
      SET clave = @clave,
          turno = @turno,
          semestre = @semestre,
          cupo = @cupo
      WHERE grupo_id = @grupoId;
    `, [
      { name: "clave", type: sql.VarChar, value: clave.trim() },
      { name: "turno", type: sql.VarChar, value: turno },
      { name: "semestre", type: sql.TinyInt, value: parsedSemestre },
      { name: "cupo", type: sql.Int, value: parsedCupo },
      { name: "grupoId", type: sql.Int, value: grupoId }
    ]);

    // Log in ActivityLog
    await runQuery(`
      INSERT INTO dbo.ActivityLog (actor_id, actor_role, action_type, entity_type, entity_id, description)
      VALUES (@actorId, 'admin', 'UPDATE_GROUP', 'Grupos', @entityId, @description)
    `, [
      { name: "actorId", type: sql.Int, value: adminId },
      { name: "entityId", type: sql.NVarChar, value: String(grupoId) },
      { name: "description", type: sql.NVarChar, value: `Grupo ${clave.trim()} (ID: ${grupoId}) actualizado por administrador (Cupo: ${parsedCupo}, Turno: ${turno}, Semestre: ${parsedSemestre})` }
    ]);

    return res.json({
      success: true,
      message: `Grupo ${clave.trim()} actualizado correctamente.`,
      grupo: {
        grupo_id: grupoId,
        clave: clave.trim(),
        turno,
        semestre: parsedSemestre,
        cupo: parsedCupo
      }
    });
  } catch (error) {
    console.error("Error updateGroup:", error);
    return res.status(500).json({ message: "Error al actualizar el grupo" });
  }
};

export const deleteGroup = async (req, res) => {
  const { id } = req.params;
  const adminId = req.user?.id || null;

  if (!id) {
    return res.status(400).json({ message: "ID de grupo obligatorio" });
  }

  try {
    const grupoId = parseInt(id);

    const groupCheck = await runQuery(
      "SELECT grupo_id, clave, periodo_id FROM dbo.Grupos WHERE grupo_id = @grupoId",
      [{ name: "grupoId", type: sql.Int, value: grupoId }]
    );

    if (groupCheck.recordset.length === 0) {
      return res.status(404).json({ message: "Grupo no encontrado" });
    }

    const groupInfo = groupCheck.recordset[0];

    if (groupInfo.periodo_id && await isPeriodClosed(groupInfo.periodo_id)) {
      return res.status(403).json({
        message: "No se puede eliminar un grupo de un ciclo escolar concluido (modo solo lectura)."
      });
    }

    // 1. Delete RegistrosAsistencia for sessions associated with this group
    await runQuery(`
      DELETE ra
      FROM dbo.RegistrosAsistencia ra
      JOIN dbo.SesionesAsistencia sa ON ra.sesion_id = sa.sesion_id
      JOIN dbo.AsignacionesDocentes ad ON sa.asignacion_id = ad.asignacion_id
      WHERE ad.grupo_id = @grupoId
    `, [{ name: "grupoId", type: sql.Int, value: grupoId }]);

    // 2. Delete TokensAsistencia
    await runQuery(`
      DELETE ta
      FROM dbo.TokensAsistencia ta
      JOIN dbo.AsignacionesDocentes ad ON ta.asignacion_id = ad.asignacion_id
      WHERE ad.grupo_id = @grupoId
    `, [{ name: "grupoId", type: sql.Int, value: grupoId }]);

    // 3. Delete SesionesAsistencia
    await runQuery(`
      DELETE sa
      FROM dbo.SesionesAsistencia sa
      JOIN dbo.AsignacionesDocentes ad ON sa.asignacion_id = ad.asignacion_id
      WHERE ad.grupo_id = @grupoId
    `, [{ name: "grupoId", type: sql.Int, value: grupoId }]);

    // 4. Delete Inscripciones
    await runQuery(`
      DELETE i
      FROM dbo.Inscripciones i
      JOIN dbo.AsignacionesDocentes ad ON i.asignacion_id = ad.asignacion_id
      WHERE ad.grupo_id = @grupoId
    `, [{ name: "grupoId", type: sql.Int, value: grupoId }]);

    // 5. Delete InvitacionesAlumnos
    await runQuery(`
      DELETE FROM dbo.InvitacionesAlumnos
      WHERE grupo_id = @grupoId
    `, [{ name: "grupoId", type: sql.Int, value: grupoId }]);

    // 6. Delete AsignacionesDocentes
    await runQuery(`
      DELETE FROM dbo.AsignacionesDocentes
      WHERE grupo_id = @grupoId
    `, [{ name: "grupoId", type: sql.Int, value: grupoId }]);

    // 7. Delete the Group itself
    await runQuery(`
      DELETE FROM dbo.Grupos
      WHERE grupo_id = @grupoId
    `, [{ name: "grupoId", type: sql.Int, value: grupoId }]);

    // 8. Log in ActivityLog
    await runQuery(`
      INSERT INTO dbo.ActivityLog (actor_id, actor_role, action_type, entity_type, entity_id, description)
      VALUES (@actorId, 'admin', 'DELETE_GROUP', 'Grupos', @entityId, @description)
    `, [
      { name: "actorId", type: sql.Int, value: adminId },
      { name: "entityId", type: sql.NVarChar, value: String(grupoId) },
      { name: "description", type: sql.NVarChar, value: `Grupo ${groupInfo.clave} (ID: ${grupoId}) eliminado por administrador` }
    ]);

    return res.json({
      success: true,
      message: `Grupo ${groupInfo.clave} eliminado exitosamente con todas sus dependencias limpiadas.`
    });
  } catch (error) {
    console.error("Error deleteGroup:", error);
    return res.status(500).json({ message: "Error al eliminar el grupo" });
  }
};

export const getGroupStudents = async (req, res) => {
  const { id } = req.params;
  const { ciclo = null } = req.query;
  if (!id) {
    return res.status(400).json({ message: "ID de grupo obligatorio" });
  }

  try {
    const grupoId = parseInt(id);
    const { studentsByGroupId } = await resolveStudentsByGroupForCycle(ciclo);
    const students = studentsByGroupId.get(grupoId) || [];
    return res.json(students);
  } catch (error) {
    console.error("Error getGroupStudents:", error);
    return res.status(500).json({ message: "Error al obtener los alumnos del grupo" });
  }
};

export const removeStudentFromGroup = async (req, res) => {
  const { id, studentId } = req.params;
  const adminId = req.user?.id || null;

  if (!id || !studentId) {
    return res.status(400).json({ message: "ID de grupo y de alumno son obligatorios" });
  }

  try {
    const grupoId = parseInt(id);
    const alumnoId = parseInt(studentId);

    const gCheck = await runQuery(
      "SELECT grupo_id, clave, periodo_id FROM dbo.Grupos WHERE grupo_id = @grupoId",
      [{ name: "grupoId", type: sql.Int, value: grupoId }]
    );
    if (gCheck.recordset.length === 0) {
      return res.status(404).json({ message: "Grupo no encontrado" });
    }
    const groupInfo = gCheck.recordset[0];

    if (groupInfo.periodo_id && await isPeriodClosed(groupInfo.periodo_id)) {
      return res.status(403).json({
        message: "No se puede remover alumnos de un grupo en un ciclo escolar concluido (modo solo lectura)."
      });
    }

    const uCheck = await runQuery(
      "SELECT usuario_id, nombre_completo, correo FROM dbo.Usuarios WHERE usuario_id = @alumnoId",
      [{ name: "alumnoId", type: sql.Int, value: alumnoId }]
    );
    if (uCheck.recordset.length === 0) {
      return res.status(404).json({ message: "Alumno no encontrado" });
    }
    const userInfo = uCheck.recordset[0];

    // 1. Delete RegistrosAsistencia for this student in sessions of this group
    await runQuery(`
      DELETE ra
      FROM dbo.RegistrosAsistencia ra
      JOIN dbo.SesionesAsistencia sa ON ra.sesion_id = sa.sesion_id
      JOIN dbo.AsignacionesDocentes ad ON sa.asignacion_id = ad.asignacion_id
      WHERE ad.grupo_id = @grupoId AND ra.alumno_id = @alumnoId
    `, [
      { name: "grupoId", type: sql.Int, value: grupoId },
      { name: "alumnoId", type: sql.Int, value: alumnoId }
    ]);

    // 2. Delete Inscripciones for this student in assignments of this group
    await runQuery(`
      DELETE i
      FROM dbo.Inscripciones i
      JOIN dbo.AsignacionesDocentes ad ON i.asignacion_id = ad.asignacion_id
      JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
      WHERE i.alumno_id = @alumnoId 
        AND (g.grupo_id = @grupoId OR g.clave = @clave OR RIGHT(g.clave, 2) = RIGHT(@clave, 2))
    `, [
      { name: "grupoId", type: sql.Int, value: grupoId },
      { name: "alumnoId", type: sql.Int, value: alumnoId },
      { name: "clave", type: sql.VarChar, value: groupInfo.clave }
    ]);

    // 3. Delete InvitacionesAlumnos if any
    if (userInfo.correo) {
      await runQuery(`
        DELETE FROM dbo.InvitacionesAlumnos
        WHERE grupo_id = @grupoId AND correo = @correo
      `, [
        { name: "grupoId", type: sql.Int, value: grupoId },
        { name: "correo", type: sql.NVarChar, value: userInfo.correo }
      ]);
    }

    // 4. Log in ActivityLog
    await runQuery(`
      INSERT INTO dbo.ActivityLog (actor_id, actor_role, action_type, entity_type, entity_id, description)
      VALUES (@actorId, 'admin', 'REMOVE_STUDENT_FROM_GROUP', 'Inscripciones', @entityId, @description)
    `, [
      { name: "actorId", type: sql.Int, value: adminId },
      { name: "entityId", type: sql.NVarChar, value: String(alumnoId) },
      { name: "description", type: sql.NVarChar, value: `Alumno ${userInfo.nombre_completo} (ID: ${alumnoId}) removido del grupo ${groupInfo.clave} (ID: ${grupoId})` }
    ]);

    return res.json({
      success: true,
      message: `Alumno ${userInfo.nombre_completo} removido exitosamente del grupo ${groupInfo.clave}.`
    });
  } catch (error) {
    console.error("Error removeStudentFromGroup:", error);
    return res.status(500).json({ message: "Error al remover el alumno del grupo" });
  }
};


