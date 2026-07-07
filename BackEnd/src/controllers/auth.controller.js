import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { runQuery, sql } from "../config/db.js";
import { sendRecoveryEmail, sendInvitationEmail } from "../services/email.service.js";
import crypto from "crypto";

const LOGIN_QUERY = `
  SELECT
    U.usuario_id,
    U.nombre_completo,
    U.correo,
    U.rol_id,
    R.rol_nombre,
    U.password_hash
  FROM dbo.Usuarios U
  JOIN dbo.Roles R ON U.rol_id = R.rol_id
  WHERE U.correo = @correo AND U.activo = 1
`;

const CHECK_EMAIL_QUERY = `
  SELECT 1 FROM dbo.Usuarios WHERE correo = @correo
`;

const GET_USER_BY_EMAIL_QUERY = `
  SELECT usuario_id, nombre_completo, correo 
  FROM dbo.Usuarios 
  WHERE correo = @correo AND activo = 1
`;

const INSERT_USER_QUERY = `
  INSERT INTO dbo.Usuarios (rol_id, nombre_completo, correo, password_hash)
  OUTPUT INSERTED.usuario_id
  VALUES (@rolId, @nombre, @correo, @passwordHash)
`;

const INSERT_ALUMNO_PROFILE = `
  INSERT INTO dbo.PerfilesAlumnos (usuario_id, matricula, semestre)
  VALUES (@usuarioId, @matricula, @semestre)
`;

const INSERT_DOCENTE_PROFILE = `
  INSERT INTO dbo.PerfilesDocentes (usuario_id, turno)
  VALUES (@usuarioId, @turno)
`;

const UPDATE_PASSWORD_QUERY = `
  UPDATE dbo.Usuarios 
  SET password_hash = @passwordHash 
  WHERE usuario_id = @usuarioId AND activo = 1
`;

const ROLE_MAP = {
  admin: 1,
  docente: 2,
  alumno: 3,
};

const ALLOWED_REGISTER_ROLES = Object.keys(ROLE_MAP);

const { JWT_SECRET = "secret", TOKEN_TTL_HOURS = 8 } = process.env;

const normalizeEmail = (email = "") => email.trim().toLowerCase();
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

const normalizeBaseUrl = (url = "") => url.replace(/\/+$/, "");

const getPublicFrontendUrl = (req) => {
  const configuredUrl = process.env.FRONTEND_URL?.trim();
  if (configuredUrl) {
    return normalizeBaseUrl(configuredUrl);
  }

  const forwardedFrontendOrigin = req.get("x-frontend-origin");
  const origin = req.get("origin");
  const referer = req.get("referer");
  const sourceUrl = forwardedFrontendOrigin || origin || referer;

  try {
    const parsed = new URL(sourceUrl);

    if (parsed.hostname.endsWith(".devtunnels.ms")) {
      parsed.hostname = parsed.hostname.replace("-4000.", "-5173.");
      return normalizeBaseUrl(parsed.origin);
    }

    return normalizeBaseUrl(parsed.origin);
  } catch {
    return "http://localhost:5173";
  }
};

const verifyPassword = async (password, passwordHash) => {
  if (!passwordHash || !BCRYPT_HASH_PATTERN.test(passwordHash)) {
    return false;
  }

  return bcrypt.compare(password, passwordHash);
};

const buildTokenResponse = (user) => {
  const payload = {
    id: user.usuario_id,
    rol: user.rol_nombre,
    nombre: user.nombre_completo,
    email: user.correo,
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: `${TOKEN_TTL_HOURS}h`,
  });

  return { token, user: payload };
};

export const login = async (req, res) => {
  const { correo, password } = req.body || {};
  const normalizedCorreo = normalizeEmail(correo);

  if (!normalizedCorreo || !password) {
    return res
      .status(400)
      .json({ message: "Correo y contraseña son obligatorios" });
  }

  try {
    const { recordset } = await runQuery(LOGIN_QUERY, [
      { name: "correo", type: sql.NVarChar, value: normalizedCorreo },
    ]);

    if (!recordset.length) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const user = recordset[0];
    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    return res.json(buildTokenResponse(user));
  } catch (error) {
    console.error("Error login:", error);
    return res.status(500).json({ message: "Error al iniciar sesión" });
  }
};

export const register = async (req, res) => {
  const { nombre, correo, password, role = "alumno" } = req.body || {};
  const normalizedCorreo = normalizeEmail(correo);

  if (!nombre || !normalizedCorreo || !password) {
    return res
      .status(400)
      .json({ message: "Nombre, correo y contraseña son obligatorios" });
  }

  if (!ALLOWED_REGISTER_ROLES.includes(role)) {
    return res.status(400).json({ message: "Rol no válido" });
  }

  try {
    if (role === "alumno") {
      const institutionalPattern = /^[0-9]+@cuautitlan\.tecnm\.mx$/;
      if (!institutionalPattern.test(normalizedCorreo)) {
        return res.status(400).json({
          message: "El correo para alumnos debe ser institucional con formato de número de control (ej: 223107422@cuautitlan.tecnm.mx)",
        });
      }
    }

    const existing = await runQuery(CHECK_EMAIL_QUERY, [
      { name: "correo", type: sql.NVarChar, value: normalizedCorreo },
    ]);
    if (existing.recordset.length) {
      return res.status(409).json({ message: "El correo ya está registrado" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const insertedUser = await runQuery(INSERT_USER_QUERY, [
      { name: "rolId", type: sql.TinyInt, value: ROLE_MAP[role] },
      { name: "nombre", type: sql.NVarChar, value: nombre },
      { name: "correo", type: sql.NVarChar, value: normalizedCorreo },
      { name: "passwordHash", type: sql.NVarChar, value: passwordHash },
    ]);

    const usuarioId = insertedUser.recordset[0].usuario_id;

    if (role === "alumno") {
      const matricula = normalizedCorreo.split("@")[0];
      
      const matriculaCheck = await runQuery("SELECT 1 FROM dbo.PerfilesAlumnos WHERE matricula = @matricula", [
        { name: "matricula", type: sql.VarChar, value: matricula }
      ]);
      if (matriculaCheck.recordset.length) {
        return res.status(409).json({ message: "El número de control ya está registrado" });
      }

      const careerResult = await runQuery("SELECT TOP 1 carrera_id FROM dbo.Carreras WHERE clave = 'ISC'");
      let careerId = null;
      if (careerResult.recordset.length > 0) {
        careerId = careerResult.recordset[0].carrera_id;
      }

      await runQuery(`
        INSERT INTO dbo.PerfilesAlumnos (usuario_id, matricula, semestre, carrera_id)
        VALUES (@usuarioId, @matricula, 1, @carreraId)
      `, [
        { name: "usuarioId", type: sql.Int, value: usuarioId },
        { name: "matricula", type: sql.VarChar, value: matricula },
        { name: "carreraId", type: sql.Int, value: careerId },
      ]);
    } else if (role === "docente") {
      await runQuery(INSERT_DOCENTE_PROFILE, [
        { name: "usuarioId", type: sql.Int, value: usuarioId },
        { name: "turno", type: sql.VarChar, value: "Matutino" },
      ]);
    }

    const user = {
      usuario_id: usuarioId,
      nombre_completo: nombre,
      correo: normalizedCorreo,
      rol_nombre: role,
    };

    return res.status(201).json(buildTokenResponse(user));
  } catch (error) {
    console.error("Error register:", error);
    return res.status(500).json({ message: "No se pudo registrar el usuario" });
  }
};

export const forgotPassword = async (req, res) => {
  const { correo } = req.body || {};
  const normalizedCorreo = normalizeEmail(correo);

  if (!normalizedCorreo) {
    return res.status(400).json({ message: "El correo electrónico es obligatorio" });
  }

  try {
    const { recordset } = await runQuery(GET_USER_BY_EMAIL_QUERY, [
      { name: "correo", type: sql.NVarChar, value: normalizedCorreo },
    ]);

    if (!recordset.length) {
      return res.status(404).json({ message: "El correo electrónico ingresado no se encuentra registrado en el sistema." });
    }

    const user = recordset[0];
    
    // Crear un token firmado que expira en 1 hora
    const resetToken = jwt.sign(
      { id: user.usuario_id, email: user.correo, type: "password_reset" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Enviar el correo electrónico estilizado
    await sendRecoveryEmail(
      user.correo,
      user.nombre_completo,
      resetToken,
      getPublicFrontendUrl(req)
    );

    return res.json({ message: "Correo de recuperación enviado con éxito" });
  } catch (error) {
    console.error("Error forgotPassword:", error);
    return res.status(500).json({ message: "Error al procesar la solicitud de recuperación" });
  }
};

export const resetPassword = async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ message: "El token y la contraseña son obligatorios" });
  }

  try {
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ message: "El enlace de recuperación es inválido o ha expirado" });
    }

    if (decoded.type !== "password_reset") {
      return res.status(400).json({ message: "Token de seguridad no válido para esta operación" });
    }

    const usuarioId = decoded.id;
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await runQuery(UPDATE_PASSWORD_QUERY, [
      { name: "usuarioId", type: sql.Int, value: usuarioId },
      { name: "passwordHash", type: sql.NVarChar, value: passwordHash }
    ]);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Usuario no encontrado o inactivo" });
    }

    return res.json({ message: "Tu contraseña ha sido actualizada con éxito" });
  } catch (error) {
    console.error("Error resetPassword:", error);
    return res.status(500).json({ message: "Error interno al restablecer la contraseña" });
  }
};

export const linkInstitutionalEmail = async (req, res) => {
  const { currentEmail, password, institutionalEmail } = req.body || {};
  const normalizedCurrentEmail = normalizeEmail(currentEmail);
  const normalizedInstitutionalEmail = normalizeEmail(institutionalEmail);

  if (!normalizedCurrentEmail || !password || !normalizedInstitutionalEmail) {
    return res.status(400).json({ message: "Todos los campos son obligatorios" });
  }

  try {
    // 1. Verify user exists and credentials are correct
    const { recordset } = await runQuery(LOGIN_QUERY, [
      { name: "correo", type: sql.NVarChar, value: normalizedCurrentEmail },
    ]);

    if (!recordset.length) {
      return res.status(401).json({ message: "Credenciales de acceso incorrectas" });
    }

    const user = recordset[0];
    const isValidPassword = await verifyPassword(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ message: "Credenciales de acceso incorrectas" });
    }

    // 2. Verify that the new email is not already taken
    const emailCheck = await runQuery(CHECK_EMAIL_QUERY, [
      { name: "correo", type: sql.NVarChar, value: normalizedInstitutionalEmail },
    ]);

    if (emailCheck.recordset.length > 0) {
      return res.status(409).json({ message: "El correo institucional ya está registrado por otra cuenta" });
    }

    // 3. Update the email
    await runQuery(`
      UPDATE dbo.Usuarios
      SET correo = @newEmail
      WHERE usuario_id = @userId
    `, [
      { name: "newEmail", type: sql.NVarChar, value: normalizedInstitutionalEmail },
      { name: "userId", type: sql.Int, value: user.usuario_id }
    ]);

    return res.json({ success: true, message: "Correo institucional vinculado con éxito. Ahora puedes usarlo para iniciar sesión." });
  } catch (error) {
    console.error("Error linking institutional email:", error);
    return res.status(500).json({ message: "Error interno al vincular el correo institucional" });
  }
};

export const inviteStudent = async (req, res) => {
  const { correo, grupoId } = req.body || {};
  const normalizedCorreo = normalizeEmail(correo);

  if (!normalizedCorreo || !grupoId) {
    return res.status(400).json({ message: "El correo y el grupoId son obligatorios" });
  }

  const institutionalPattern = /^[0-9]+@cuautitlan\.tecnm\.mx$/;
  if (!institutionalPattern.test(normalizedCorreo)) {
    return res.status(400).json({
      message: "El correo para alumnos debe ser institucional con formato de número de control (ej: 223107422@cuautitlan.tecnm.mx)",
    });
  }

  try {
    // 1. Check if student already registered in Usuarios
    const existingUser = await runQuery(CHECK_EMAIL_QUERY, [
      { name: "correo", type: sql.NVarChar, value: normalizedCorreo },
    ]);
    if (existingUser.recordset.length) {
      return res.status(409).json({ message: "El correo electrónico ya está registrado en la plataforma" });
    }

    // 2. Check if group exists
    const groupResult = await runQuery("SELECT clave FROM dbo.Grupos WHERE grupo_id = @grupoId", [
      { name: "grupoId", type: sql.Int, value: grupoId }
    ]);
    if (groupResult.recordset.length === 0) {
      return res.status(404).json({ message: "El grupo seleccionado no existe" });
    }
    const groupClave = groupResult.recordset[0].clave;

    // 3. Generate token and invitation
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    // Upsert invitation (delete any existing pending invitation for same email first)
    await runQuery("DELETE FROM dbo.InvitacionesAlumnos WHERE correo = @correo AND estatus = 'pendiente'", [
      { name: "correo", type: sql.NVarChar, value: normalizedCorreo }
    ]);

    await runQuery(`
      INSERT INTO dbo.InvitacionesAlumnos (correo, grupo_id, token, expires_at)
      VALUES (@correo, @grupoId, @token, @expiresAt)
    `, [
      { name: "correo", type: sql.NVarChar, value: normalizedCorreo },
      { name: "grupoId", type: sql.Int, value: grupoId },
      { name: "token", type: sql.VarChar, value: token },
      { name: "expiresAt", type: sql.DateTime2, value: expiresAt }
    ]);

    // 4. Send email
    await sendInvitationEmail(
      normalizedCorreo,
      groupClave,
      token,
      getPublicFrontendUrl(req)
    );

    return res.json({ success: true, message: `Invitación enviada con éxito a ${normalizedCorreo}` });
  } catch (error) {
    console.error("Error inviteStudent:", error);
    return res.status(500).json({ message: "Error interno al enviar la invitación" });
  }
};

export const validateInvite = async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ message: "Token es requerido" });
  }

  try {
    const result = await runQuery(`
      SELECT i.correo, g.clave as grupo_clave, g.grupo_id
      FROM dbo.InvitacionesAlumnos i
      JOIN dbo.Grupos g ON i.grupo_id = g.grupo_id
      WHERE i.token = @token AND i.estatus = 'pendiente' AND i.expires_at >= SYSDATETIME()
    `, [
      { name: "token", type: sql.VarChar, value: token }
    ]);

    if (result.recordset.length === 0) {
      return res.status(400).json({ message: "El enlace de invitación es inválido o ha expirado" });
    }

    return res.json(result.recordset[0]);
  } catch (error) {
    console.error("Error validateInvite:", error);
    return res.status(500).json({ message: "Error interno al validar la invitación" });
  }
};

export const acceptInvite = async (req, res) => {
  const { token, nombre, password } = req.body || {};

  if (!token || !nombre || !password) {
    return res.status(400).json({ message: "Token, nombre y contraseña son requeridos" });
  }

  try {
    // 1. Validate invitation
    const inviteResult = await runQuery(`
      SELECT correo, grupo_id
      FROM dbo.InvitacionesAlumnos
      WHERE token = @token AND estatus = 'pendiente' AND expires_at >= SYSDATETIME()
    `, [
      { name: "token", type: sql.VarChar, value: token }
    ]);

    if (inviteResult.recordset.length === 0) {
      return res.status(400).json({ message: "El enlace de invitación es inválido o ha expirado" });
    }

    const { correo, grupo_id: grupoId } = inviteResult.recordset[0];
    const normalizedCorreo = normalizeEmail(correo);
    const matricula = normalizedCorreo.split("@")[0];

    // Double check email availability
    const existingUser = await runQuery(CHECK_EMAIL_QUERY, [
      { name: "correo", type: sql.NVarChar, value: normalizedCorreo },
    ]);
    if (existingUser.recordset.length) {
      return res.status(409).json({ message: "El correo ya se encuentra registrado" });
    }

    // 2. Fetch career ID and semester for group
    const careerResult = await runQuery("SELECT TOP 1 carrera_id, semestre FROM dbo.Grupos WHERE grupo_id = @grupoId", [
      { name: "grupoId", type: sql.Int, value: grupoId }
    ]);
    let careerId = null;
    let semestre = 1;
    if (careerResult.recordset.length > 0) {
      careerId = careerResult.recordset[0].carrera_id;
      semestre = careerResult.recordset[0].semestre || 1;
    }

    // 3. Insert user and student profile
    const passwordHash = await bcrypt.hash(password, 10);
    
    const insertedUser = await runQuery(INSERT_USER_QUERY, [
      { name: "rolId", type: sql.TinyInt, value: ROLE_MAP.alumno },
      { name: "nombre", type: sql.NVarChar, value: nombre },
      { name: "correo", type: sql.NVarChar, value: normalizedCorreo },
      { name: "passwordHash", type: sql.NVarChar, value: passwordHash }
    ]);

    const usuarioId = insertedUser.recordset[0].usuario_id;

    await runQuery(`
      INSERT INTO dbo.PerfilesAlumnos (usuario_id, matricula, semestre, carrera_id)
      VALUES (@usuarioId, @matricula, @semestre, @carreraId)
    `, [
      { name: "usuarioId", type: sql.Int, value: usuarioId },
      { name: "matricula", type: sql.VarChar, value: matricula },
      { name: "semestre", type: sql.TinyInt, value: semestre },
      { name: "carreraId", type: sql.Int, value: careerId }
    ]);

    // 4. Enroll student automatically in all assignments of that group
    await runQuery(`
      INSERT INTO dbo.Inscripciones (alumno_id, asignacion_id, estatus)
      SELECT @usuarioId, asignacion_id, 'activo'
      FROM dbo.AsignacionesDocentes
      WHERE grupo_id = @grupoId
    `, [
      { name: "usuarioId", type: sql.Int, value: usuarioId },
      { name: "grupoId", type: sql.Int, value: grupoId }
    ]);

    // 5. Update invitation status
    await runQuery(`
      UPDATE dbo.InvitacionesAlumnos
      SET estatus = 'aceptada'
      WHERE token = @token
    `, [
      { name: "token", type: sql.VarChar, value: token }
    ]);

    return res.status(201).json({ success: true, message: "Cuenta registrada y vinculada con éxito" });
  } catch (error) {
    console.error("Error acceptInvite:", error);
    return res.status(500).json({ message: "Error interno al completar el registro" });
  }
};
