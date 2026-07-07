import bcrypt from "bcryptjs";
import { runQuery, sql } from "../config/db.js";

const CHECK_EMAIL_EXISTS = `
  SELECT 1 FROM dbo.Usuarios WHERE correo = @correo AND usuario_id <> @currentId;
`;

const INSERT_USER_QUERY = `
  INSERT INTO dbo.Usuarios (rol_id, nombre_completo, correo, password_hash)
  OUTPUT INSERTED.usuario_id
  VALUES (2, @nombre, @correo, @passwordHash);
`;

const INSERT_DOCENTE_PROFILE = `
  INSERT INTO dbo.PerfilesDocentes (usuario_id, turno)
  VALUES (@usuarioId, @turno);
`;

const UPDATE_USER_QUERY = `
  UPDATE dbo.Usuarios
  SET nombre_completo = @nombre, correo = @correo
  WHERE usuario_id = @id AND rol_id = 2;
`;

const UPDATE_DOCENTE_PROFILE = `
  UPDATE dbo.PerfilesDocentes
  SET turno = @turno
  WHERE usuario_id = @id;
`;

const DEACTIVATE_USER_QUERY = `
  UPDATE dbo.Usuarios
  SET activo = 0
  WHERE usuario_id = @id AND rol_id = 2;
`;

export const createDocente = async (req, res) => {
  const { nombre, correo, turno = "Matutino" } = req.body || {};

  if (!nombre || !correo) {
    return res.status(400).json({ message: "Nombre y correo son requeridos" });
  }

  try {
    // Check if email already exists
    const existing = await runQuery(CHECK_EMAIL_EXISTS, [
      { name: "correo", type: sql.NVarChar, value: correo },
      { name: "currentId", type: sql.Int, value: 0 }, // 0 means ignore currentId check
    ]);

    if (existing.recordset.length) {
      return res.status(409).json({ message: "El correo electrónico ya está registrado" });
    }

    // Default password for teachers is "docente123"
    const passwordHash = await bcrypt.hash("docente123", 10);

    // Insert user
    const userResult = await runQuery(INSERT_USER_QUERY, [
      { name: "nombre", type: sql.NVarChar, value: nombre },
      { name: "correo", type: sql.NVarChar, value: correo },
      { name: "passwordHash", type: sql.NVarChar, value: passwordHash },
    ]);

    const docenteId = userResult.recordset[0].usuario_id;

    // Insert profile
    await runQuery(INSERT_DOCENTE_PROFILE, [
      { name: "usuarioId", type: sql.Int, value: docenteId },
      { name: "turno", type: sql.VarChar, value: turno },
    ]);

    return res.status(201).json({
      success: true,
      docente: {
        docente_id: docenteId,
        docente: nombre,
        correo,
        turno,
        grupos: 0,
        alumnos: 0,
        asistencia_promedio: 100.0,
      },
    });
  } catch (error) {
    console.error("Error creating docente:", error);
    return res.status(500).json({ message: "Error interno al crear el docente" });
  }
};

export const updateDocente = async (req, res) => {
  const { id } = req.params;
  const { nombre, correo, turno } = req.body || {};

  if (!id) {
    return res.status(400).json({ message: "ID de docente es requerido" });
  }
  if (!nombre || !correo || !turno) {
    return res.status(400).json({ message: "Nombre, correo y turno son requeridos" });
  }

  const docenteId = parseInt(id);

  try {
    // Check if email already exists on another user
    const existing = await runQuery(CHECK_EMAIL_EXISTS, [
      { name: "correo", type: sql.NVarChar, value: correo },
      { name: "currentId", type: sql.Int, value: docenteId },
    ]);

    if (existing.recordset.length) {
      return res.status(409).json({ message: "El correo electrónico ya lo tiene otra cuenta" });
    }

    // Update user
    await runQuery(UPDATE_USER_QUERY, [
      { name: "id", type: sql.Int, value: docenteId },
      { name: "nombre", type: sql.NVarChar, value: nombre },
      { name: "correo", type: sql.NVarChar, value: correo },
    ]);

    // Update profile
    await runQuery(UPDATE_DOCENTE_PROFILE, [
      { name: "id", type: sql.Int, value: docenteId },
      { name: "turno", type: sql.VarChar, value: turno },
    ]);

    return res.json({
      success: true,
      docente: {
        docente_id: docenteId,
        docente: nombre,
        correo,
        turno,
      },
    });
  } catch (error) {
    console.error("Error updating docente:", error);
    return res.status(500).json({ message: "Error interno al actualizar el docente" });
  }
};

export const deleteDocente = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "ID de docente es requerido" });
  }

  const docenteId = parseInt(id);

  try {
    // Perform soft-delete by setting active = 0
    await runQuery(DEACTIVATE_USER_QUERY, [
      { name: "id", type: sql.Int, value: docenteId },
    ]);

    return res.json({
      success: true,
      message: "Docente desactivado con éxito de la plataforma",
    });
  } catch (error) {
    console.error("Error deactivating docente:", error);
    return res.status(500).json({ message: "Error interno al desactivar el docente" });
  }
};
