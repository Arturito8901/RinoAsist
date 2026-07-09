import { runQuery, sql, getPool } from "../config/db.js";

export const getAlumnosOverview = async (req, res) => {
  try {
    const activePeriodResult = await runQuery(`
      SELECT TOP 1 periodo_id, nombre FROM dbo.PeriodosEscolares WHERE activo = 1 ORDER BY creado_en DESC
    `);
    const activePeriod = activePeriodResult.recordset[0];
    const activePeriodId = activePeriod?.periodo_id;

    const allPeriodsResult = await runQuery(`
      SELECT periodo_id, nombre FROM dbo.PeriodosEscolares ORDER BY fecha_inicio ASC
    `);
    const regularPeriods = allPeriodsResult.recordset.filter(p => !p.nombre.toLowerCase().includes("intersemestral"));
    const periodIndexMap = new Map();
    regularPeriods.forEach((p, idx) => {
      periodIndexMap.set(p.periodo_id, idx);
    });

    const alumnosQuery = `
      SELECT 
        u.usuario_id AS id, 
        u.nombre_completo AS nombre, 
        u.correo, 
        pa.matricula, 
        pa.semestre AS base_semestre,
        (
          SELECT TOP 1 g.clave 
          FROM dbo.Inscripciones i 
          JOIN dbo.AsignacionesDocentes ad ON i.asignacion_id = ad.asignacion_id
          JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
          WHERE i.alumno_id = u.usuario_id AND ad.periodo_id = @activePeriodId
        ) AS active_grupo_clave,
        (
          SELECT TOP 1 g.grupo_id 
          FROM dbo.Inscripciones i 
          JOIN dbo.AsignacionesDocentes ad ON i.asignacion_id = ad.asignacion_id
          JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
          WHERE i.alumno_id = u.usuario_id AND ad.periodo_id = @activePeriodId
        ) AS active_grupo_id,
        (
          SELECT TOP 1 g.semestre 
          FROM dbo.Inscripciones i 
          JOIN dbo.AsignacionesDocentes ad ON i.asignacion_id = ad.asignacion_id
          JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
          WHERE i.alumno_id = u.usuario_id AND ad.periodo_id = @activePeriodId
        ) AS active_grupo_semestre,
        (
          SELECT TOP 1 g.clave 
          FROM dbo.Inscripciones i 
          JOIN dbo.AsignacionesDocentes ad ON i.asignacion_id = ad.asignacion_id
          JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
          WHERE i.alumno_id = u.usuario_id
          ORDER BY ad.periodo_id DESC
        ) AS last_grupo_clave,
        (
          SELECT TOP 1 g.grupo_id 
          FROM dbo.Inscripciones i 
          JOIN dbo.AsignacionesDocentes ad ON i.asignacion_id = ad.asignacion_id
          JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
          WHERE i.alumno_id = u.usuario_id
          ORDER BY ad.periodo_id DESC
        ) AS last_grupo_id,
        (
          SELECT TOP 1 g.semestre 
          FROM dbo.Inscripciones i 
          JOIN dbo.AsignacionesDocentes ad ON i.asignacion_id = ad.asignacion_id
          JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
          WHERE i.alumno_id = u.usuario_id
          ORDER BY ad.periodo_id DESC
        ) AS last_grupo_semestre,
        (
          SELECT TOP 1 ad.periodo_id 
          FROM dbo.Inscripciones i 
          JOIN dbo.AsignacionesDocentes ad ON i.asignacion_id = ad.asignacion_id
          WHERE i.alumno_id = u.usuario_id
          ORDER BY ad.periodo_id DESC
        ) AS last_grupo_periodo_id
      FROM dbo.Usuarios u
      JOIN dbo.PerfilesAlumnos pa ON u.usuario_id = pa.usuario_id
      WHERE u.activo = 1 AND u.is_debug = 0
      ORDER BY u.nombre_completo;
    `;

    const invitacionesQuery = `
      SELECT 
        i.invitacion_id AS id,
        i.correo, 
        i.estatus,
        i.creado_en,
        i.expires_at,
        g.clave AS grupo_clave,
        g.semestre
      FROM dbo.InvitacionesAlumnos i
      JOIN dbo.Grupos g ON i.grupo_id = g.grupo_id
      ORDER BY i.creado_en DESC;
    `;

    const [alumnosResult, invitacionesResult, groupsResult] = await Promise.all([
      runQuery(alumnosQuery, [{ name: "activePeriodId", type: sql.Int, value: activePeriodId }]),
      runQuery(invitacionesQuery),
      runQuery("SELECT grupo_id, clave, semestre FROM dbo.Grupos")
    ]);

    const groupMap = new Map();
    groupsResult.recordset.forEach(g => {
      groupMap.set(g.clave.toLowerCase().trim(), g);
    });

    const mappedAlumnos = alumnosResult.recordset.map(student => {
      let grupo_clave = student.active_grupo_clave;
      let grupo_id = student.active_grupo_id;
      let semestre = student.active_grupo_semestre || student.base_semestre;

      if (!student.active_grupo_clave && student.last_grupo_clave && student.last_grupo_periodo_id) {
        const lastIdx = periodIndexMap.get(student.last_grupo_periodo_id);
        const activeIdx = periodIndexMap.get(activePeriodId);

        if (lastIdx !== undefined && activeIdx !== undefined) {
          const diff = activeIdx - lastIdx;
          semestre = student.last_grupo_semestre + diff;
          if (semestre > 9) semestre = 9;
          if (semestre < 1) semestre = 1;

          const projectedKey = getSemesterGroupKeyForSemester(student.last_grupo_clave, semestre);
          const projectedGroupObj = groupMap.get(projectedKey.toLowerCase().trim());
          if (projectedGroupObj) {
            grupo_clave = projectedGroupObj.clave;
            grupo_id = projectedGroupObj.grupo_id;
          }
        }
      }

      return {
        id: student.id,
        nombre: student.nombre,
        correo: student.correo,
        matricula: student.matricula,
        semestre,
        grupo_clave,
        grupo_id
      };
    });

    return res.json({
      alumnos: mappedAlumnos,
      invitaciones: invitacionesResult.recordset
    });
  } catch (error) {
    console.error("Error loading alumnos overview:", error);
    return res.status(500).json({ message: "No se pudo obtener la información de alumnos" });
  }
};

export const requestDropCourse = async (req, res) => {
  const alumnoId = req.user?.id;
  const { asignacionId } = req.params;

  if (!asignacionId) {
    return res.status(400).json({ message: "ID de asignación obligatorio" });
  }

  try {
    // Check if the student is enrolled in this assignment
    const checkEnroll = await runQuery(`
      SELECT 1 FROM dbo.Inscripciones
      WHERE alumno_id = @alumnoId AND asignacion_id = @asignacionId AND estatus = 'activo'
    `, [
      { name: "alumnoId", type: sql.Int, value: alumnoId },
      { name: "asignacionId", type: sql.Int, value: parseInt(asignacionId) }
    ]);

    if (checkEnroll.recordset.length === 0) {
      return res.status(404).json({ message: "No estás inscrito en esta asignatura" });
    }

    // Check if there is already a pending drop request
    const checkPending = await runQuery(`
      SELECT 1 FROM dbo.SolicitudesBaja
      WHERE alumno_id = @alumnoId AND asignacion_id = @asignacionId AND estatus = 'pendiente'
    `, [
      { name: "alumnoId", type: sql.Int, value: alumnoId },
      { name: "asignacionId", type: sql.Int, value: parseInt(asignacionId) }
    ]);

    if (checkPending.recordset.length > 0) {
      return res.status(409).json({ message: "Ya tienes una solicitud de baja pendiente para esta asignatura" });
    }

    // Insert drop request
    await runQuery(`
      INSERT INTO dbo.SolicitudesBaja (alumno_id, asignacion_id, estatus)
      VALUES (@alumnoId, @asignacionId, 'pendiente')
    `, [
      { name: "alumnoId", type: sql.Int, value: alumnoId },
      { name: "asignacionId", type: sql.Int, value: parseInt(asignacionId) }
    ]);

    return res.status(201).json({ success: true, message: "Solicitud de baja enviada con éxito" });
  } catch (error) {
    console.error("Error creating drop request:", error);
    return res.status(500).json({ message: "No se pudo registrar la solicitud de baja" });
  }
};

export const getStudentDropRequests = async (req, res) => {
  const alumnoId = req.user?.id;

  try {
    const result = await runQuery(`
      SELECT asignacion_id, estatus, creado_en
      FROM dbo.SolicitudesBaja
      WHERE alumno_id = @alumnoId AND estatus = 'pendiente'
    `, [{ name: "alumnoId", type: sql.Int, value: alumnoId }]);

    return res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching student drop requests:", error);
    return res.status(500).json({ message: "No se pudieron obtener las solicitudes de baja" });
  }
};

export const adminGetDropRequests = async (req, res) => {
  try {
    const result = await runQuery(`
      SELECT 
        sb.solicitud_id AS id,
        sb.alumno_id,
        u.nombre_completo AS alumno_nombre,
        pa.matricula AS alumno_matricula,
        sb.asignacion_id,
        m.nombre AS materia_nombre,
        g.clave AS grupo_clave,
        g.semestre AS grupo_semestre,
        sb.estatus,
        sb.creado_en
      FROM dbo.SolicitudesBaja sb
      JOIN dbo.Usuarios u ON sb.alumno_id = u.usuario_id
      JOIN dbo.PerfilesAlumnos pa ON u.usuario_id = pa.usuario_id
      JOIN dbo.AsignacionesDocentes ad ON sb.asignacion_id = ad.asignacion_id
      JOIN dbo.Materias m ON ad.materia_id = m.materia_id
      JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
      WHERE sb.estatus = 'pendiente'
      ORDER BY sb.creado_en DESC;
    `);

    return res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching admin drop requests:", error);
    return res.status(500).json({ message: "No se pudieron obtener las solicitudes de baja" });
  }
};

export const adminApproveDropRequest = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "ID de solicitud obligatorio" });
  }

  try {
    const solicitudId = parseInt(id);

    // Get request details
    const reqDetail = await runQuery(`
      SELECT alumno_id, asignacion_id FROM dbo.SolicitudesBaja
      WHERE solicitud_id = @solicitudId AND estatus = 'pendiente'
    `, [{ name: "solicitudId", type: sql.Int, value: solicitudId }]);

    if (reqDetail.recordset.length === 0) {
      return res.status(404).json({ message: "Solicitud de baja no encontrada o ya procesada" });
    }

    const { alumno_id: alumnoId, asignacion_id: asignacionId } = reqDetail.recordset[0];

    // 1. Delete student attendance records for sessions of this assignment
    await runQuery(`
      DELETE ra
      FROM dbo.RegistrosAsistencia ra
      JOIN dbo.SesionesAsistencia sa ON ra.sesion_id = sa.sesion_id
      WHERE ra.alumno_id = @alumnoId AND sa.asignacion_id = @asignacionId
    `, [
      { name: "alumnoId", type: sql.Int, value: alumnoId },
      { name: "asignacionId", type: sql.Int, value: asignacionId }
    ]);

    // 2. Delete student inscription
    await runQuery(`
      DELETE FROM dbo.Inscripciones
      WHERE alumno_id = @alumnoId AND asignacion_id = @asignacionId
    `, [
      { name: "alumnoId", type: sql.Int, value: alumnoId },
      { name: "asignacionId", type: sql.Int, value: asignacionId }
    ]);

    // 3. Mark request as approved
    await runQuery(`
      UPDATE dbo.SolicitudesBaja
      SET estatus = 'aprobada', procesado_en = SYSDATETIME()
      WHERE solicitud_id = @solicitudId
    `, [{ name: "solicitudId", type: sql.Int, value: solicitudId }]);

    return res.json({ success: true, message: "Solicitud aprobada y alumno desvinculado con éxito" });
  } catch (error) {
    console.error("Error approving drop request:", error);
    return res.status(500).json({ message: "No se pudo procesar la aprobación" });
  }
};

export const adminRejectDropRequest = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "ID de solicitud obligatorio" });
  }

  try {
    const solicitudId = parseInt(id);

    // Update request to rejected
    const result = await runQuery(`
      UPDATE dbo.SolicitudesBaja
      SET estatus = 'rechazada', procesado_en = SYSDATETIME()
      WHERE solicitud_id = @solicitudId AND estatus = 'pendiente'
    `, [{ name: "solicitudId", type: sql.Int, value: solicitudId }]);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Solicitud de baja no encontrada o ya procesada" });
    }

    return res.json({ success: true, message: "Solicitud de baja rechazada con éxito" });
  } catch (error) {
    console.error("Error rejecting drop request:", error);
    return res.status(500).json({ message: "No se pudo procesar el rechazo" });
  }
};

export const deleteAlumno = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "ID de alumno es requerido" });
  }

  const alumnoId = parseInt(id);

  try {
    const result = await runQuery(`
      UPDATE dbo.Usuarios
      SET activo = 0
      WHERE usuario_id = @id AND rol_id = 3;
    `, [
      { name: "id", type: sql.Int, value: alumnoId }
    ]);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Alumno no encontrado o ya desactivado" });
    }

    return res.json({
      success: true,
      message: "Alumno dado de baja del sistema con éxito"
    });
  } catch (error) {
    console.error("Error deactivating alumno:", error);
    return res.status(500).json({ message: "Error interno al dar de baja al alumno" });
  }
};

export const deleteInvitation = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "ID de invitación es requerido" });
  }

  const invitacionId = parseInt(id);

  try {
    const result = await runQuery(`
      DELETE FROM dbo.InvitacionesAlumnos
      WHERE invitacion_id = @id;
    `, [
      { name: "id", type: sql.Int, value: invitacionId }
    ]);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Invitación no encontrada" });
    }

    return res.json({
      success: true,
      message: "Invitación cancelada y eliminada con éxito"
    });
  } catch (error) {
    console.error("Error deleting invitation:", error);
    return res.status(500).json({ message: "Error interno al cancelar la invitación" });
  }
};

export const updateAlumno = async (req, res) => {
  const { id } = req.params;
  const { nombre, correo, matricula, grupoId } = req.body || {};

  console.log("[updateAlumno] Request parameters:", { id, nombre, correo, matricula, grupoId });

  if (!id) {
    return res.status(400).json({ message: "ID de alumno es requerido" });
  }

  if (!nombre || !correo || !matricula) {
    return res.status(400).json({ message: "Nombre, correo y matrícula son obligatorios" });
  }

  const alumnoId = parseInt(id);

  try {
    // 1. Check if email already exists on another user
    const checkEmail = await runQuery(`
      SELECT 1 FROM dbo.Usuarios WHERE correo = @correo AND usuario_id <> @currentId;
    `, [
      { name: "correo", type: sql.NVarChar, value: correo },
      { name: "currentId", type: sql.Int, value: alumnoId }
    ]);

    if (checkEmail.recordset.length > 0) {
      console.warn("[updateAlumno] Email conflict:", correo);
      return res.status(409).json({ message: "El correo electrónico ya está registrado por otro usuario" });
    }

    // 2. Check if matricula already exists on another student
    const checkMatricula = await runQuery(`
      SELECT 1 FROM dbo.PerfilesAlumnos WHERE matricula = @matricula AND usuario_id <> @currentId;
    `, [
      { name: "matricula", type: sql.VarChar, value: matricula },
      { name: "currentId", type: sql.Int, value: alumnoId }
    ]);

    if (checkMatricula.recordset.length > 0) {
      console.warn("[updateAlumno] Matricula conflict:", matricula);
      return res.status(409).json({ message: "El número de control (matrícula) ya está registrado por otro alumno" });
    }

    // 3. Update Usuario (nombre and correo)
    const resultUser = await runQuery(`
      UPDATE dbo.Usuarios
      SET nombre_completo = @nombre, correo = @correo
      WHERE usuario_id = @id AND rol_id = 3;
    `, [
      { name: "id", type: sql.Int, value: alumnoId },
      { name: "nombre", type: sql.NVarChar, value: nombre },
      { name: "correo", type: sql.NVarChar, value: correo }
    ]);

    console.log("[updateAlumno] UPDATE Usuarios rows affected:", resultUser.rowsAffected);

    if (resultUser.rowsAffected[0] === 0) {
      console.warn("[updateAlumno] No row updated in dbo.Usuarios for id:", alumnoId);
      return res.status(404).json({ message: "El alumno no existe o no tiene el rol correcto en el sistema" });
    }

    // 4. Update Perfil (matricula)
    const resultProfile = await runQuery(`
      UPDATE dbo.PerfilesAlumnos
      SET matricula = @matricula
      WHERE usuario_id = @id;
    `, [
      { name: "id", type: sql.Int, value: alumnoId },
      { name: "matricula", type: sql.VarChar, value: matricula }
    ]);

    console.log("[updateAlumno] UPDATE PerfilesAlumnos rows affected:", resultProfile.rowsAffected);

    if (resultProfile.rowsAffected[0] === 0) {
      console.warn("[updateAlumno] No row updated in dbo.PerfilesAlumnos for id:", alumnoId);
      return res.status(404).json({ message: "No se encontró el perfil de alumno asociado para este usuario" });
    }

    // 5. If group is changing, reassign enrollment
    if (grupoId) {
      const parsedGrupoId = parseInt(grupoId);
      console.log("[updateAlumno] Reassigning group to:", parsedGrupoId);

      // Verify group exists and get its semester
      const groupRes = await runQuery(`
        SELECT semestre FROM dbo.Grupos WHERE grupo_id = @grupoId
      `, [{ name: "grupoId", type: sql.Int, value: parsedGrupoId }]);

      if (groupRes.recordset.length > 0) {
        const newSemestre = groupRes.recordset[0].semestre;

        // Check if student's current group is actually different
        const currentGroupRes = await runQuery(`
          SELECT TOP 1 ad.grupo_id 
          FROM dbo.Inscripciones i 
          JOIN dbo.AsignacionesDocentes ad ON i.asignacion_id = ad.asignacion_id
          WHERE i.alumno_id = @alumnoId
        `, [{ name: "alumnoId", type: sql.Int, value: alumnoId }]);

        const currentGrupoId = currentGroupRes.recordset[0]?.grupo_id;
        console.log("[updateAlumno] Group transition check:", { currentGrupoId, parsedGrupoId });

        if (currentGrupoId !== parsedGrupoId) {
          console.log("[updateAlumno] Performing group migration database queries...");
          
          // Clean up old attendance records
          const delAttendance = await runQuery(`
            DELETE ra
            FROM dbo.RegistrosAsistencia ra
            JOIN dbo.SesionesAsistencia sa ON ra.sesion_id = sa.sesion_id
            WHERE ra.alumno_id = @alumnoId
          `, [{ name: "alumnoId", type: sql.Int, value: alumnoId }]);
          console.log("[updateAlumno] Deleted old attendance records:", delAttendance.rowsAffected);

          // Clean up old enrollments
          const delEnroll = await runQuery(`
            DELETE FROM dbo.Inscripciones
            WHERE alumno_id = @alumnoId
          `, [{ name: "alumnoId", type: sql.Int, value: alumnoId }]);
          console.log("[updateAlumno] Deleted old enrollments:", delEnroll.rowsAffected);

          // Enroll student in all subjects of the new group
          const newAsignaciones = await runQuery(`
            SELECT asignacion_id FROM dbo.AsignacionesDocentes
            WHERE grupo_id = @grupoId
          `, [{ name: "grupoId", type: sql.Int, value: parsedGrupoId }]);

          console.log("[updateAlumno] Found new assignments to enroll student in:", newAsignaciones.recordset.length);

          for (const a of newAsignaciones.recordset) {
            await runQuery(`
              INSERT INTO dbo.Inscripciones (alumno_id, asignacion_id, estatus)
              VALUES (@alumnoId, @asignacionId, 'activo')
            `, [
              { name: "alumnoId", type: sql.Int, value: alumnoId },
              { name: "asignacionId", type: sql.Int, value: a.asignacion_id }
            ]);
          }

          // Update student's profile semester to match new group
          const updateSem = await runQuery(`
            UPDATE dbo.PerfilesAlumnos
            SET semestre = @semestre
            WHERE usuario_id = @alumnoId
          `, [
            { name: "alumnoId", type: sql.Int, value: alumnoId },
            { name: "semestre", type: sql.Int, value: newSemestre }
          ]);
          console.log("[updateAlumno] Updated profile semester rows affected:", updateSem.rowsAffected);
        }
      } else {
        console.warn("[updateAlumno] Specified group does not exist:", parsedGrupoId);
      }
    }

    console.log("[updateAlumno] Alumno updated successfully:", alumnoId);
    return res.json({
      success: true,
      message: "Información del alumno actualizada con éxito"
    });
  } catch (error) {
    console.error("Error updating alumno:", error);
    return res.status(500).json({ message: "Error interno al actualizar la información del alumno" });
  }
};

export const syncStudentEnrollmentsForActivePeriod = async () => {
  const pool = await getPool();
  try {
    const activePeriodResult = await pool.request().query(`
      SELECT TOP 1 periodo_id, nombre FROM dbo.PeriodosEscolares WHERE activo = 1 ORDER BY creado_en DESC
    `);
    const activePeriod = activePeriodResult.recordset[0];
    if (!activePeriod) return;
    const activePeriodId = activePeriod.periodo_id;
    const isInter = activePeriod.nombre?.toLowerCase().includes("intersemestral");

    if (isInter) return;

    const studentsResult = await pool.request().query(`
      SELECT u.usuario_id, pa.semestre
      FROM dbo.Usuarios u
      JOIN dbo.PerfilesAlumnos pa ON u.usuario_id = pa.usuario_id
      WHERE u.activo = 1 AND u.rol_id = 3
    `);

    for (const student of studentsResult.recordset) {
      try {
        const studentId = student.usuario_id;
        const currentSemestre = student.semestre;

        const lastEnrollResult = await pool.request()
          .input("studentId", sql.Int, studentId)
          .input("activePeriodId", sql.Int, activePeriodId)
          .query(`
            SELECT TOP 1 g.clave, g.grupo_id, g.turno, g.carrera_id, ad.periodo_id, g.semestre AS grupo_semestre
            FROM dbo.Inscripciones i
            JOIN dbo.AsignacionesDocentes ad ON i.asignacion_id = ad.asignacion_id
            JOIN dbo.Grupos g ON ad.grupo_id = g.grupo_id
            WHERE i.alumno_id = @studentId AND ad.periodo_id < @activePeriodId
            ORDER BY ad.periodo_id DESC
          `);

        if (lastEnrollResult.recordset.length === 0) continue;

        const lastEnroll = lastEnrollResult.recordset[0];
        const oldKey = lastEnroll.clave;
        const oldSemestre = lastEnroll.grupo_semestre;

        const nextSemester = oldSemestre + 1;

        if (nextSemester > 9) {
          await pool.request()
            .input("studentId", sql.Int, studentId)
            .query("UPDATE dbo.Usuarios SET activo = 0 WHERE usuario_id = @studentId");
          console.log(`[student promotion] Student ${studentId} graduated.`);
          continue;
        }

        if (currentSemestre !== nextSemester) {
          await pool.request()
            .input("studentId", sql.Int, studentId)
            .input("semester", sql.Int, nextSemester)
            .query("UPDATE dbo.PerfilesAlumnos SET semestre = @semester WHERE usuario_id = @studentId");
        }

        const nextKey = getNextSemesterGroupKey(oldKey);
        if (!nextKey) continue;

        let newGroupId = null;
        const targetGroupResult = await pool.request()
          .input("clave", sql.VarChar, nextKey)
          .query("SELECT grupo_id FROM dbo.Grupos WHERE clave = @clave");

        if (targetGroupResult.recordset.length > 0) {
          newGroupId = targetGroupResult.recordset[0].grupo_id;
        } else {
          const insertGroup = await pool.request()
            .input("clave", sql.VarChar, nextKey)
            .input("semestre", sql.TinyInt, nextSemester)
            .input("turno", sql.VarChar, lastEnroll.turno || 'Matutino')
            .input("carreraId", sql.Int, lastEnroll.carrera_id)
            .query(`
              INSERT INTO dbo.Grupos (clave, semestre, turno, cupo, carrera_id)
              OUTPUT INSERTED.grupo_id
              VALUES (@clave, @semestre, @turno, 30, @carreraId)
            `);
          newGroupId = insertGroup.recordset[0].grupo_id;
        }

        if (newGroupId) {
          const newAsignaciones = await pool.request()
            .input("groupId", sql.Int, newGroupId)
            .input("periodId", sql.Int, activePeriodId)
            .query(`
              SELECT asignacion_id FROM dbo.AsignacionesDocentes
              WHERE grupo_id = @groupId AND periodo_id = @periodId
            `);

          for (const a of newAsignaciones.recordset) {
            const check = await pool.request()
              .input("studentId", sql.Int, studentId)
              .input("asignacionId", sql.Int, a.asignacion_id)
              .query("SELECT 1 FROM dbo.Inscripciones WHERE alumno_id = @studentId AND asignacion_id = @asignacionId");

            if (check.recordset.length === 0) {
              await pool.request()
                .input("studentId", sql.Int, studentId)
                .input("asignacionId", sql.Int, a.asignacion_id)
                .query(`
                  INSERT INTO dbo.Inscripciones (alumno_id, asignacion_id, estatus)
                  VALUES (@studentId, @asignacionId, 'activo')
                `);
            }
          }
        }
      } catch (studentError) {
        console.error(`[student promotion] Error processing student ID ${student.usuario_id}:`, studentError);
      }
    }
  } catch (error) {
    console.error("Error in syncStudentEnrollmentsForActivePeriod:", error);
  }
};

function getNextSemesterGroupKey(oldKey) {
  const match = oldKey.match(/\d+/);
  if (!match) return null;
  const digits = match[0];
  if (digits.length < 2) return null;
  
  const semIndex = digits.length - 2;
  const semDigit = parseInt(digits[semIndex]);
  if (isNaN(semDigit)) return null;
  
  const nextSemDigit = semDigit + 1;
  const nextDigits = digits.substring(0, semIndex) + nextSemDigit + digits.substring(semIndex + 1);
  
  return oldKey.replace(digits, nextDigits);
}

function getSemesterGroupKeyForSemester(oldKey, targetSemester) {
  const match = oldKey.match(/\d+/);
  if (!match) return oldKey;
  const digits = match[0];
  if (digits.length < 2) return oldKey;
  
  const semIndex = digits.length - 2;
  const nextDigits = digits.substring(0, semIndex) + targetSemester + digits.substring(semIndex + 1);
  
  return oldKey.replace(digits, nextDigits);
}

