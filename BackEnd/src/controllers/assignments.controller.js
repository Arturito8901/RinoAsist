import { runQuery, sql } from "../config/db.js";

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
INSERT INTO dbo.AsignacionesDocentes (docente_id, materia_id, grupo_id, horario)
OUTPUT INSERTED.asignacion_id
VALUES (@docenteId, @materiaId, @grupoId, @horario);
`;

export const getAssignmentOptions = async (req, res) => {
  try {
    const [docentesResult, materiasResult, gruposResult, asignacionesResult] = await Promise.all([
      runQuery(DOCENTES_QUERY),
      runQuery(MATERIAS_QUERY),
      runQuery(GRUPOS_QUERY),
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


