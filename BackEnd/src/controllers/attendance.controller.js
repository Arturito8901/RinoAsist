import crypto from "crypto";
import { runQuery, sql } from "../config/db.js";

const CAMPUS_LAT = 19.648207;
const CAMPUS_LON = -99.227478;
const TOLERANCE_RADIUS_METERS = 1000;

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function isCurrentTimeInSchedule(scheduleStr) {
  if (!scheduleStr) return true; // Si no hay horario especificado, permitir por defecto

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Domingo, 1 = Lunes, ... 6 = Sábado
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeInMinutes = currentHours * 60 + currentMinutes;

  const scheduleLower = scheduleStr.toLowerCase();

  // 1. Determinar días programados
  const days = [];
  if (scheduleLower.includes("lu") || scheduleLower.includes("lunes")) days.push(1);
  if (scheduleLower.includes("ma") || scheduleLower.includes("martes")) days.push(2);
  if (scheduleLower.includes("mi") || scheduleLower.includes("miercoles") || scheduleLower.includes("miércoles")) days.push(3);
  if (scheduleLower.includes("ju") || scheduleLower.includes("jueves")) days.push(4);
  if (scheduleLower.includes("vi") || scheduleLower.includes("viernes")) days.push(5);
  if (scheduleLower.includes("sa") || scheduleLower.includes("sabado") || scheduleLower.includes("sábado")) days.push(6);
  if (scheduleLower.includes("do") || scheduleLower.includes("domingo")) days.push(0);

  // Si no se encuentra ningún día específico en el string, permitir por seguridad
  if (days.length === 0) return true;

  // Comprobar si hoy es uno de los días de clase
  if (!days.includes(currentDay)) return false;

  // 2. Extraer horas y minutos programados (ej: "08:00", "08:00 - 10:00")
  const timeRegex = /(\d{2}):(\d{2})/g;
  const matches = [];
  let match;
  while ((match = timeRegex.exec(scheduleLower)) !== null) {
    matches.push(parseInt(match[1]) * 60 + parseInt(match[2]));
  }

  if (matches.length === 0) {
    return true; // Si no se encuentra formato de hora, permitir por seguridad
  }

  let startMinutes = matches[0];
  let endMinutes = matches[1];

  if (matches.length === 1) {
    // Si sólo hay hora de inicio, asumir clase estándar de 2 horas (120 minutos)
    endMinutes = startMinutes + 120;
  }

  // Validar si el horario actual del servidor cae dentro del rango de clase
  return currentTimeInMinutes >= startMinutes && currentTimeInMinutes <= endMinutes;
}

const VALIDATE_ASSIGNMENT = `
SELECT asignacion_id, docente_id, horario
FROM dbo.AsignacionesDocentes
WHERE asignacion_id = @asignacionId
`;

const FIND_SESSION = `
SELECT sesion_id
FROM dbo.SesionesAsistencia
WHERE asignacion_id = @asignacionId AND fecha = @fecha
`;

const CREATE_SESSION = `
INSERT INTO dbo.SesionesAsistencia (asignacion_id, fecha, tema, creado_por)
OUTPUT INSERTED.sesion_id
VALUES (@asignacionId, @fecha, @tema, @docenteId)
`;

const INSERT_TOKEN = `
INSERT INTO dbo.TokensAsistencia (token_id, asignacion_id, sesion_id, token_hash, expires_at, creado_por)
VALUES (@tokenId, @asignacionId, @sesionId, @tokenHash, @expiresAt, @docenteId)
`;

const FIND_TOKEN = `
SELECT
  tt.token_id,
  tt.asignacion_id,
  tt.sesion_id,
  sa.fecha,
  ad.docente_id,
  DATEDIFF(minute, tt.creado_en, SYSDATETIME()) AS minutos_transcurridos
FROM dbo.TokensAsistencia tt
JOIN dbo.SesionesAsistencia sa ON sa.sesion_id = tt.sesion_id
JOIN dbo.AsignacionesDocentes ad ON ad.asignacion_id = tt.asignacion_id
WHERE tt.token_hash = @tokenHash
  AND tt.expires_at >= SYSDATETIME()
`;

const CHECK_ENROLLMENT = `
SELECT 1
FROM dbo.Inscripciones
WHERE alumno_id = @alumnoId AND asignacion_id = @asignacionId
`;

const UPSERT_ATTENDANCE = `
MERGE dbo.RegistrosAsistencia AS target
USING (SELECT @sesionId AS sesion_id, @alumnoId AS alumno_id) AS source
ON target.sesion_id = source.sesion_id AND target.alumno_id = source.alumno_id
WHEN MATCHED THEN
  UPDATE SET estatus = 'asistio', notas = NULL, marcado_en = SYSDATETIME()
WHEN NOT MATCHED THEN
  INSERT (sesion_id, alumno_id, estatus, notas)
  VALUES (source.sesion_id, source.alumno_id, 'asistio', NULL);
`;

export const generateQrToken = async (req, res) => {
  const docenteId = req.user?.id;
  const role = req.user?.rol || req.user?.role;
  const { assignmentId, sessionDate, expiresInMinutes = 15, topic = null } =
    req.body || {};

  if (!assignmentId) {
    return res.status(400).json({ message: "assignmentId es requerido" });
  }

  const sessionDay = sessionDate ? new Date(sessionDate) : new Date();
  if (Number.isNaN(sessionDay.getTime())) {
    return res.status(400).json({ message: "sessionDate inválida" });
  }
  const normalizedDate = sessionDay.toISOString().slice(0, 10);

  try {
    const assignment = await runQuery(VALIDATE_ASSIGNMENT, [
      { name: "asignacionId", type: sql.Int, value: assignmentId },
    ]);

    if (!assignment.recordset.length) {
      return res.status(404).json({ message: "Asignación no encontrada" });
    }

    if (
      role !== "admin" &&
      assignment.recordset[0].docente_id !== docenteId
    ) {
      return res.status(403).json({ message: "Sin permisos para este grupo" });
    }

    // Validar si estamos dentro del horario programado de la clase
    const scheduleStr = assignment.recordset[0].horario;
    if (role !== "admin" && !isCurrentTimeInSchedule(scheduleStr)) {
      return res.status(400).json({ 
        message: `No está permitido generar el código QR fuera del horario programado para esta clase (${scheduleStr || 'Sin horario programado'}).` 
      });
    }

    let sesionId;
    const existingSession = await runQuery(FIND_SESSION, [
      { name: "asignacionId", type: sql.Int, value: assignmentId },
      { name: "fecha", type: sql.Date, value: normalizedDate },
    ]);

    if (existingSession.recordset.length) {
      sesionId = existingSession.recordset[0].sesion_id;
    } else {
      const created = await runQuery(CREATE_SESSION, [
        { name: "asignacionId", type: sql.Int, value: assignmentId },
        { name: "fecha", type: sql.Date, value: normalizedDate },
        { name: "tema", type: sql.NVarChar, value: topic },
        { name: "docenteId", type: sql.Int, value: docenteId },
      ]);
      sesionId = created.recordset[0].sesion_id;
    }

    const token = crypto
      .randomBytes(24)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest();
    const tokenId = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + Math.max(1, expiresInMinutes) * 60 * 1000
    )
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    await runQuery(INSERT_TOKEN, [
      { name: "tokenId", type: sql.UniqueIdentifier, value: tokenId },
      { name: "asignacionId", type: sql.Int, value: assignmentId },
      { name: "sesionId", type: sql.Int, value: sesionId },
      { name: "tokenHash", type: sql.VarBinary, value: tokenHash },
      { name: "expiresAt", type: sql.DateTime2, value: expiresAt },
      { name: "docenteId", type: sql.Int, value: docenteId },
    ]);

    return res.json({
      token,
      expiresAt,
      sessionDate: normalizedDate,
    });
  } catch (error) {
    console.error("Error generating QR:", error);
    return res
      .status(500)
      .json({ message: "No se pudo generar el código QR" });
  }
};

export const registerAttendanceByQr = async (req, res) => {
  const alumnoId = req.user?.id;
  const { token, lat, lon } = req.body || {};

  if (!token) {
    return res.status(400).json({ message: "Token requerido" });
  }

  if (!lat || !lon) {
    return res.status(400).json({ 
      message: "Acceso de geolocalización requerido. Es obligatorio permitir la localización para verificar que estás dentro del aula." 
    });
  }

  const distance = getDistanceInMeters(Number(lat), Number(lon), CAMPUS_LAT, CAMPUS_LON);
  if (distance > TOLERANCE_RADIUS_METERS) {
    return res.status(400).json({ 
      message: `No te encuentras dentro del campus de la institución (distancia: ${Math.round(distance)} metros). Registro de asistencia denegado por seguridad.` 
    });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest();
    const tokenResult = await runQuery(FIND_TOKEN, [
      { name: "tokenHash", type: sql.VarBinary, value: tokenHash },
    ]);

    if (!tokenResult.recordset.length) {
      return res.status(400).json({ message: "Código QR inválido o expirado" });
    }

    const tokenRow = tokenResult.recordset[0];

    const enrollment = await runQuery(CHECK_ENROLLMENT, [
      { name: "alumnoId", type: sql.Int, value: alumnoId },
      { name: "asignacionId", type: sql.Int, value: tokenRow.asignacion_id },
    ]);

    if (!enrollment.recordset.length) {
      return res
        .status(403)
        .json({ message: "No perteneces a este grupo" });
    }

    // 1. Check if attendance is already registered for this session to prevent double scans
    const existingRecord = await runQuery(`
      SELECT estatus, FORMAT(marcado_en, 'HH:mm:ss') AS hora
      FROM dbo.RegistrosAsistencia
      WHERE sesion_id = @sesionId AND alumno_id = @alumnoId;
    `, [
      { name: "sesionId", type: sql.Int, value: tokenRow.sesion_id },
      { name: "alumnoId", type: sql.Int, value: alumnoId }
    ]);

    if (existingRecord.recordset.length) {
      const record = existingRecord.recordset[0];
      if (record.estatus === 'asistio' || record.estatus === 'retardo') {
        return res.status(409).json({ 
          message: `Ya has registrado tu asistencia para esta clase (marcada a las ${record.hora}).` 
        });
      }
    }

    // 2. Evaluate real elapsed minutes / tolerance
    const mins = Number(tokenRow.minutos_transcurridos || 0);
    let estatus = 'asistio';
    let notas = `Código QR (Min: ${mins})`;

    if (mins > 20) {
      return res.status(400).json({ 
        message: `El registro QR ha cerrado. Has excedido los 20 minutos de tolerancia de la clase.` 
      });
    } else if (mins > 10) {
      estatus = 'retardo';
      notas = `Código QR (Retardo - Min: ${mins})`;
    }

    // 3. Upsert the attendance
    await runQuery(`
      MERGE dbo.RegistrosAsistencia AS target
      USING (SELECT @sesionId AS sesion_id, @alumnoId AS alumno_id) AS source
      ON target.sesion_id = source.sesion_id AND target.alumno_id = source.alumno_id
      WHEN MATCHED THEN
        UPDATE SET estatus = @estatus, notas = @notas, marcado_en = SYSDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (sesion_id, alumno_id, estatus, notas)
        VALUES (source.sesion_id, source.alumno_id, @estatus, @notas);
    `, [
      { name: "sesionId", type: sql.Int, value: tokenRow.sesion_id },
      { name: "alumnoId", type: sql.Int, value: alumnoId },
      { name: "estatus", type: sql.VarChar, value: estatus },
      { name: "notas", type: sql.NVarChar, value: notas }
    ]);

    return res.json({
      message: estatus === 'retardo' 
        ? `Registrado como RETARDO (Llegaste ${mins} min tarde. Tolerancia Asistencia: 10 min).` 
        : `Registrado como ASISTENCIA (Llegaste a tiempo - ${mins} min).`,
      sessionDate: tokenRow.fecha,
      status: estatus === 'retardo' ? 'RETARDO' : 'ASISTENCIA'
    });
  } catch (error) {
    console.error("Error QR scan:", error);
    return res.status(500).json({ message: "No se pudo registrar asistencia" });
  }
};

export const getGroupStudents = async (req, res) => {
  const { groupId } = req.params;
  if (!groupId) {
    return res.status(400).json({ message: "groupId es requerido" });
  }
  try {
    const result = await runQuery(`
      SELECT 
        u.usuario_id AS id,
        u.nombre_completo AS name,
        ISNULL(
          (
            SELECT CAST(100.0 * SUM(CASE WHEN ra.estatus = 'asistio' THEN 1 ELSE 0 END) / NULLIF(COUNT(sa.sesion_id), 0) AS INT)
            FROM dbo.SesionesAsistencia sa
            LEFT JOIN dbo.RegistrosAsistencia ra ON ra.sesion_id = sa.sesion_id AND ra.alumno_id = i.alumno_id
            WHERE sa.asignacion_id = i.asignacion_id
          ), 100
        ) AS attendanceRate
      FROM dbo.Inscripciones i
      JOIN dbo.Usuarios u ON i.alumno_id = u.usuario_id
      WHERE i.asignacion_id = @groupId AND u.activo = 1
      ORDER BY u.nombre_completo;
    `, [
      { name: "groupId", type: sql.Int, value: parseInt(groupId) }
    ]);

    const mapped = result.recordset.map(s => ({
      id: s.id.toString(),
      name: s.name,
      attendanceRate: s.attendanceRate
    }));

    return res.json(mapped);
  } catch (error) {
    console.error("Error loading group students:", error);
    return res.status(500).json({ message: "Error al obtener alumnos del grupo" });
  }
};

export const getGroupAttendanceHistory = async (req, res) => {
  const { groupId } = req.params;
  if (!groupId) {
    return res.status(400).json({ message: "groupId es requerido" });
  }
  try {
    const sessionsResult = await runQuery(`
      SELECT sesion_id, FORMAT(fecha, 'yyyy-MM-dd') AS fecha, creado_por
      FROM dbo.SesionesAsistencia
      WHERE asignacion_id = @groupId
      ORDER BY fecha DESC;
    `, [
      { name: "groupId", type: sql.Int, value: parseInt(groupId) }
    ]);

    const recordsResult = await runQuery(`
      SELECT ra.sesion_id, ra.alumno_id, ra.estatus, ra.notas AS notas, ra.marcado_en
      FROM dbo.RegistrosAsistencia ra
      JOIN dbo.SesionesAsistencia sa ON sa.sesion_id = ra.sesion_id
      WHERE sa.asignacion_id = @groupId;
    `, [
      { name: "groupId", type: sql.Int, value: parseInt(groupId) }
    ]);

    const history = sessionsResult.recordset.map(session => {
      const sessionRecords = recordsResult.recordset.filter(r => r.sesion_id === session.sesion_id);
      
      let maxMarcadoEn = null;
      const records = sessionRecords.map(r => {
        if (!maxMarcadoEn || new Date(r.marcado_en) > new Date(maxMarcadoEn)) {
          maxMarcadoEn = r.marcado_en;
        }
        
        let uiStatus = 'F';
        if (r.estatus === 'asistio') uiStatus = 'A';
        else if (r.estatus === 'retardo') uiStatus = 'R';
        else if (r.estatus === 'falta') {
          if (r.notas && (r.notas.toLowerCase() === 'justificado' || r.notas.toLowerCase().startsWith('justificado:'))) {
            uiStatus = 'J';
          } else {
            uiStatus = 'F';
          }
        }

        return {
          studentId: r.alumno_id.toString(),
          status: uiStatus,
          notes: r.notas || ''
        };
      });

      const formatDateTime = (dateObj) => {
        if (!dateObj) return "";
        const d = new Date(dateObj);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleString('es-MX', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }) + ' hrs';
      };

      return {
        id: `SESS-${session.sesion_id}`,
        groupId: groupId.toString(),
        date: session.fecha,
        records,
        updatedAt: maxMarcadoEn ? formatDateTime(maxMarcadoEn) : ''
      };
    });

    return res.json(history);
  } catch (error) {
    console.error("Error loading group attendance history:", error);
    return res.status(500).json({ message: "Error al obtener historial de asistencias" });
  }
};

export const saveGroupAttendance = async (req, res) => {
  const { groupId } = req.params;
  const { date, records } = req.body || {};
  const docenteId = req.user?.id;

  if (!groupId || !date || !records) {
    return res.status(400).json({ message: "groupId, date y records son requeridos" });
  }

  try {
    let sesionId;
    const sessionSearch = await runQuery(`
      SELECT sesion_id FROM dbo.SesionesAsistencia
      WHERE asignacion_id = @groupId AND fecha = @date;
    `, [
      { name: "groupId", type: sql.Int, value: parseInt(groupId) },
      { name: "date", type: sql.Date, value: date }
    ]);

    if (sessionSearch.recordset.length) {
      sesionId = sessionSearch.recordset[0].sesion_id;
    } else {
      const sessionCreate = await runQuery(`
        INSERT INTO dbo.SesionesAsistencia (asignacion_id, fecha, creado_por)
        OUTPUT INSERTED.sesion_id
        VALUES (@groupId, @date, @docenteId);
      `, [
        { name: "groupId", type: sql.Int, value: parseInt(groupId) },
        { name: "date", type: sql.Date, value: date },
        { name: "docenteId", type: sql.Int, value: docenteId }
      ]);
      sesionId = sessionCreate.recordset[0].sesion_id;
    }

    for (const rec of records) {
      let dbStatus = 'falta';
      let dbNotes = rec.notes || null;

      if (rec.status === 'A') {
        dbStatus = 'asistio';
      } else if (rec.status === 'R') {
        dbStatus = 'retardo';
      } else if (rec.status === 'J') {
        dbStatus = 'falta';
        dbNotes = dbNotes ? `Justificado: ${dbNotes}` : 'Justificado';
      }

      await runQuery(`
        MERGE dbo.RegistrosAsistencia AS target
        USING (SELECT @sesionId AS sesion_id, @alumnoId AS alumno_id) AS source
        ON target.sesion_id = source.sesion_id AND target.alumno_id = source.alumno_id
        WHEN MATCHED THEN
          UPDATE SET estatus = @estatus, notas = @notas, marcado_en = SYSDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (sesion_id, alumno_id, estatus, notas)
          VALUES (source.sesion_id, source.alumno_id, @estatus, @notas);
      `, [
        { name: "sesionId", type: sql.Int, value: sesionId },
        { name: "alumnoId", type: sql.Int, value: parseInt(rec.studentId) },
        { name: "estatus", type: sql.VarChar, value: dbStatus },
        { name: "notas", type: sql.NVarChar, value: dbNotes }
      ]);
    }

    return res.json({ success: true, message: "Pase de lista guardado con éxito", sessionId: `SESS-${sesionId}` });
  } catch (error) {
    console.error("Error saving attendance:", error);
    return res.status(500).json({ message: "Error al guardar el pase de lista" });
  }
};

export const getTeacherScanLogs = async (req, res) => {
  const docenteId = req.user?.id;
  const { groupId = null } = req.query;

  try {
    const logsResult = await runQuery(`
      SELECT 
        ra.registro_id AS id,
        u.nombre_completo AS studentName,
        pa.matricula AS studentMatricula,
        m.nombre AS courseName,
        CONCAT(m.clave, '-', g.clave) AS groupKey,
        FORMAT(ra.marcado_en, 'yyyy-MM-dd HH:mm:ss') AS timestamp,
        ra.estatus AS status,
        ra.notas AS notes
      FROM dbo.RegistrosAsistencia ra
      JOIN dbo.Usuarios u ON ra.alumno_id = u.usuario_id
      LEFT JOIN dbo.PerfilesAlumnos pa ON pa.usuario_id = u.usuario_id
      JOIN dbo.SesionesAsistencia sa ON sa.sesion_id = ra.sesion_id
      JOIN dbo.AsignacionesDocentes ad ON sa.asignacion_id = ad.asignacion_id
      JOIN dbo.Materias m ON ad.materia_id = m.materia_id
      JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
      WHERE ad.docente_id = @docenteId
        AND (@groupId IS NULL OR ad.asignacion_id = @groupId)
      ORDER BY ra.marcado_en DESC;
    `, [
      { name: "docenteId", type: sql.Int, value: docenteId },
      { name: "groupId", type: sql.Int, value: groupId ? parseInt(groupId) : null }
    ]);

    const mappedLogs = logsResult.recordset.map(log => {
      let uiStatus = 'F';
      if (log.status === 'asistio') uiStatus = 'A';
      else if (log.status === 'retardo') uiStatus = 'R';
      else if (log.status === 'falta') {
        if (log.notes && (log.notes.toLowerCase() === 'justificado' || log.notes.toLowerCase().startsWith('justificado:'))) {
          uiStatus = 'J';
        } else {
          uiStatus = 'F';
        }
      }

      return {
        id: log.id.toString(),
        studentName: log.studentName,
        studentMatricula: log.studentMatricula || 'S/M',
        courseName: log.courseName,
        groupKey: log.groupKey,
        timestamp: log.timestamp,
        status: uiStatus,
        notes: log.notes || ''
      };
    });

    return res.json(mappedLogs);
  } catch (error) {
    console.error("Error getting scan logs:", error);
    return res.status(500).json({ message: "Error al obtener historial de escaneos" });
  }
};

export const registerAttendanceByMatricula = async (req, res) => {
  const docenteId = req.user?.id;
  const role = req.user?.rol || req.user?.role;
  const { matricula, groupId, date } = req.body || {};

  if (!matricula || !groupId) {
    return res.status(400).json({ message: "Matrícula y groupId son requeridos" });
  }

  const queryDate = date ? new Date(date) : new Date();
  if (Number.isNaN(queryDate.getTime())) {
    return res.status(400).json({ message: "Fecha inválida" });
  }
  const normalizedDate = queryDate.toISOString().slice(0, 10);

  try {
    // 1. Verify that the assignment exists and that the user is the owner (docente) or admin
    const assignment = await runQuery(VALIDATE_ASSIGNMENT, [
      { name: "asignacionId", type: sql.Int, value: parseInt(groupId) },
    ]);

    if (!assignment.recordset.length) {
      return res.status(404).json({ message: "Asignación no encontrada" });
    }

    if (role !== "admin" && assignment.recordset[0].docente_id !== docenteId) {
      return res.status(403).json({ message: "Sin permisos para este grupo" });
    }

    // Validar si estamos dentro del horario programado de la clase
    const scheduleStr = assignment.recordset[0].horario;
    if (role !== "admin" && !isCurrentTimeInSchedule(scheduleStr)) {
      return res.status(400).json({ 
        message: `No está permitido registrar asistencias fuera del horario programado para esta clase (${scheduleStr || 'Sin horario programado'}).` 
      });
    }

    // 2. Find the student by matricula
    const studentResult = await runQuery(`
      SELECT usuario_id, nombre_completo
      FROM dbo.PerfilesAlumnos pa
      JOIN dbo.Usuarios u ON pa.usuario_id = u.usuario_id
      WHERE pa.matricula = @matricula AND u.activo = 1
    `, [
      { name: "matricula", type: sql.VarChar, value: matricula.trim() }
    ]);

    if (!studentResult.recordset.length) {
      return res.status(404).json({ message: `Alumno con matrícula "${matricula}" no encontrado en la base de datos.` });
    }

    const student = studentResult.recordset[0];
    const alumnoId = student.usuario_id;

    // 3. Verify student is enrolled in this group (assignment)
    const enrollment = await runQuery(CHECK_ENROLLMENT, [
      { name: "alumnoId", type: sql.Int, value: alumnoId },
      { name: "asignacionId", type: sql.Int, value: parseInt(groupId) },
    ]);

    if (!enrollment.recordset.length) {
      return res.status(400).json({ 
        message: `El alumno ${student.nombre_completo} no está inscrito en este grupo.` 
      });
    }

    // 4. Find or create the active class session
    let sesionId;
    const existingSession = await runQuery(FIND_SESSION, [
      { name: "asignacionId", type: sql.Int, value: parseInt(groupId) },
      { name: "fecha", type: sql.Date, value: normalizedDate },
    ]);

    if (existingSession.recordset.length) {
      sesionId = existingSession.recordset[0].sesion_id;
    } else {
      const created = await runQuery(CREATE_SESSION, [
        { name: "asignacionId", type: sql.Int, value: parseInt(groupId) },
        { name: "fecha", type: sql.Date, value: normalizedDate },
        { name: "tema", type: sql.NVarChar, value: "Asistencia escaneada" },
        { name: "docenteId", type: sql.Int, value: docenteId },
      ]);
      sesionId = created.recordset[0].sesion_id;
    }

    // 5. Check if already registered
    const existingRecord = await runQuery(`
      SELECT estatus, FORMAT(marcado_en, 'HH:mm:ss') AS hora
      FROM dbo.RegistrosAsistencia
      WHERE sesion_id = @sesionId AND alumno_id = @alumnoId;
    `, [
      { name: "sesionId", type: sql.Int, value: sesionId },
      { name: "alumnoId", type: sql.Int, value: alumnoId }
    ]);

    if (existingRecord.recordset.length) {
      const record = existingRecord.recordset[0];
      if (record.estatus === 'asistio' || record.estatus === 'retardo') {
        return res.status(409).json({ 
          message: `${student.nombre_completo} ya registró su asistencia (marcada a las ${record.hora}).` 
        });
      }
    }

    // 6. Since the teacher is scanning, register them as present
    const estatus = 'asistio';
    const notas = 'Escaneo de credencial física';

    await runQuery(`
      MERGE dbo.RegistrosAsistencia AS target
      USING (SELECT @sesionId AS sesion_id, @alumnoId AS alumno_id) AS source
      ON target.sesion_id = source.sesion_id AND target.alumno_id = source.alumno_id
      WHEN MATCHED THEN
        UPDATE SET estatus = @estatus, notas = @notas, marcado_en = SYSDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (sesion_id, alumno_id, estatus, notas)
        VALUES (source.sesion_id, source.alumno_id, @estatus, @notas);
    `, [
      { name: "sesionId", type: sql.Int, value: sesionId },
      { name: "alumnoId", type: sql.Int, value: alumnoId },
      { name: "estatus", type: sql.VarChar, value: estatus },
      { name: "notas", type: sql.NVarChar, value: notas }
    ]);

    return res.json({
      success: true,
      message: `Asistencia registrada con éxito para ${student.nombre_completo} (${matricula}).`,
      studentName: student.nombre_completo,
      matricula
    });

  } catch (error) {
    console.error("Error registering attendance by matricula:", error);
    return res.status(500).json({ message: "Error interno al registrar asistencia por credencial." });
  }
};


