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
SELECT 1
FROM dbo.AsignacionesDocentes
WHERE docente_id = @docenteId AND materia_id = @materiaId AND grupo_id = @grupoId;
`;

const INSERT_ASSIGNMENT = `
DECLARE @activePeriodId INT;
SELECT TOP 1 @activePeriodId = periodo_id FROM dbo.PeriodosEscolares WHERE activo = 1 ORDER BY creado_en DESC;

INSERT INTO dbo.AsignacionesDocentes (docente_id, materia_id, grupo_id, horario, periodo_id)
OUTPUT INSERTED.asignacion_id
VALUES (@docenteId, @materiaId, @grupoId, @horario, @activePeriodId);
`;

export const getAssignmentOptions = async (req, res) => {
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

    // Resolve active period
    const activePeriodResult = await runQuery(`
      SELECT TOP 1 periodo_id, nombre FROM dbo.PeriodosEscolares WHERE activo = 1 ORDER BY creado_en DESC
    `);
    const activePeriod = activePeriodResult.recordset[0];
    const activePeriodId = activePeriod?.periodo_id;
    const isInter = activePeriod?.nombre?.toLowerCase().includes("intersemestral");

    let dynamicGruposQuery = `
      SELECT grupo_id AS id, clave, turno, semestre
      FROM dbo.Grupos
      WHERE periodo_id IS NULL
      ORDER BY clave;
    `;
    let queryParams = [];

    if (isInter && activePeriodId) {
      dynamicGruposQuery = `
        SELECT grupo_id AS id, clave, turno, semestre
        FROM dbo.Grupos
        WHERE periodo_id IS NULL OR periodo_id = @activePeriodId
        ORDER BY clave;
      `;
      queryParams.push({ name: "activePeriodId", type: sql.Int, value: activePeriodId });
    }

    const [docentesResult, materiasResult, gruposResult, asignacionesResult] = await Promise.all([
      runQuery(DOCENTES_QUERY),
      runQuery(MATERIAS_QUERY),
      runQuery(dynamicGruposQuery, queryParams),
      runQuery(ASIGNACIONES_QUERY),
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
  const { docenteId, materiaId, grupoId, horario = null } = req.body || {};

  if (!docenteId || !materiaId || !grupoId) {
    return res.status(400).json({
      message: "docenteId, materiaId y grupoId son obligatorios",
    });
  }

  try {
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
  const { horario } = req.body || {};

  if (!id) {
    return res.status(400).json({ message: "ID de asignación obligatorio" });
  }

  try {
    const asignacionId = parseInt(id);

    await runQuery(`
      UPDATE dbo.AsignacionesDocentes
      SET horario = @horario
      WHERE asignacion_id = @asignacionId
    `, [
      { name: "asignacionId", type: sql.Int, value: asignacionId },
      { name: "horario", type: sql.NVarChar, value: horario }
    ]);

    return res.json({ 
      success: true, 
      message: "Horario de asignación actualizado con éxito",
      asignacion_id: asignacionId,
      horario
    });
  } catch (error) {
    console.error("Error updating assignment schedule:", error);
    return res.status(500).json({ message: "No se pudo actualizar el horario de la asignación" });
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

    const result = await runQuery(`
      INSERT INTO dbo.Grupos (clave, semestre, turno, cupo, periodo_id)
      OUTPUT INSERTED.grupo_id
      VALUES (@clave, @semestre, @turno, @cupo, @periodoId);
    `, [
      { name: "clave", type: sql.VarChar, value: clave },
      { name: "turno", type: sql.VarChar, value: turno },
      { name: "cupo", type: sql.Int, value: parseInt(cupo) },
      { name: "semestre", type: sql.TinyInt, value: parseInt(semestre) },
      { name: "periodoId", type: sql.Int, value: activePeriodId },
    ]);

    const newGroupId = result.recordset[0].grupo_id;

    return res.status(201).json({
      grupo_id: newGroupId,
      clave,
      semestre,
      turno,
      cupo,
    });
  } catch (error) {
    console.error("Error creating group:", error);
    return res.status(500).json({ message: "Error al crear el grupo temporal" });
  }
};


