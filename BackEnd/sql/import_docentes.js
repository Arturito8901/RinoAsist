import exceljs from "exceljs";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { getPool, sql } from "../src/config/db.js";
import fs from "fs";
import path from "path";

dotenv.config();

// Helper to slugify names for emails
function generateEmail(nombreCompleto, existingEmails) {
  // Format: AP_PAT AP_MAT NOMBRES (e.g. Arriaga Sierra Teresita de Jesús)
  // We want: nombre.apellido@tesci.edu.mx
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
    // If it follows AP_PAT AP_MAT NOMBRES, first name is index 2
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

// Extract semester from group name
function parseSemesterFromGroup(grupoStr, excelSemester) {
  if (!grupoStr || grupoStr.trim() === "*") return 0;
  
  // Extract all digits
  const digits = grupoStr.replace(/[^0-9]/g, "");
  
  if (digits.length === 3) {
    // e.g. 383 -> middle digit is 8
    const sem = parseInt(digits[1]);
    if (sem >= 1 && sem <= 9) return sem;
  } else if (digits.length === 4) {
    // e.g. 1131 -> 3rd digit is 3
    const sem = parseInt(digits[2]);
    if (sem >= 1 && sem <= 9) return sem;
  }

  // Fallback to excel semester column if valid
  if (excelSemester && !isNaN(excelSemester)) {
    const sem = parseInt(excelSemester);
    if (sem >= 1 && sem <= 12) return sem;
  }

  return 1; // default fallback
}

// Extract turn from group name
function parseTurnFromGroup(grupoStr) {
  if (!grupoStr || grupoStr.trim() === "*") return "Mixto";
  const upper = grupoStr.toUpperCase();
  
  if (upper.includes("V")) return "Vespertino";
  if (upper.includes("MTI") || upper.includes("TICS") || upper.includes("L")) return "Mixto";
  if (upper.includes("M")) return "Matutino";
  
  return "Matutino"; // default fallback
}

// Determine career ID and mapping
function getCareerClave(grupoStr) {
  if (!grupoStr || grupoStr.trim() === "*") return "OTR";
  const upper = grupoStr.toUpperCase();

  if (upper.startsWith("3")) return "ISC";
  if (upper.startsWith("1") && !upper.startsWith("10") && !upper.startsWith("11") && !upper.startsWith("12") && !upper.startsWith("13") && !upper.startsWith("14") && !upper.startsWith("15") && !upper.startsWith("16") && !upper.startsWith("17") && !upper.startsWith("18") && !upper.startsWith("19")) {
    return "IAD";
  }
  // Groups like 111L, 121L, 131L are administration
  if (upper.endsWith("L") && (upper.startsWith("1") || upper.startsWith("6"))) {
    if (upper.startsWith("1")) return "IAD";
    if (upper.startsWith("6")) return "IIN";
  }
  if (upper.startsWith("6")) return "IIN";
  if (upper.includes("TICS")) return "ITIC";
  if (upper.includes("MTI")) return "MTI";
  if (upper.startsWith("10")) return "IMEC";

  return "OTR"; // fallback to other
}

// Generate code for missing subject codes
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

async function main() {
  console.log("=== STARTING TEACHER DATA IMPORT PROCESS ===");
  const pool = await getPool();
  
  // 1. Clean data arrays
  const importedTeachers = [];
  const existingEmails = new Set();

  try {
    // 2. Fetch existing user emails to avoid conflicts
    const emailCheckResult = await pool.request().query("SELECT correo FROM dbo.Usuarios");
    emailCheckResult.recordset.forEach(row => existingEmails.add(row.correo.toLowerCase()));
    
    // 3. Populate Careers catalog if not exists
    console.log("Populating Carreras catalog...");
    const careers = [
      { clave: "IAD", nombre: "Ingeniería en Administración" },
      { clave: "ISC", nombre: "Ingeniería en Sistemas Computacionales" },
      { clave: "IIN", nombre: "Ingeniería Industrial" },
      { clave: "ITIC", nombre: "Ingeniería en Tecnologías de la Información y Comunicaciones" },
      { clave: "MTI", nombre: "Maestría en Tecnologías de la Información" },
      { clave: "IMEC", nombre: "Ingeniería en Mecatrónica" },
      { clave: "OTR", nombre: "Otras Carreras / Tronco Común" }
    ];

    for (const c of careers) {
      await pool.request()
        .input("clave", sql.VarChar, c.clave)
        .input("nombre", sql.NVarChar, c.nombre)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM dbo.Carreras WHERE clave = @clave)
          BEGIN
            INSERT INTO dbo.Carreras (clave, nombre, activo) VALUES (@clave, @nombre, 1);
          END
        `);
    }
    console.log("Carreras catalog updated.");

    // Fetch career mappings for quick lookup
    const careerDbResult = await pool.request().query("SELECT carrera_id, clave FROM dbo.Carreras");
    const careerMap = {}; // clave -> id
    careerDbResult.recordset.forEach(row => {
      careerMap[row.clave] = row.carrera_id;
    });

    // 4. Populate PeriodosEscolares catalog if not exists
    console.log("Populating PeriodosEscolares catalog...");
    const periodoClave = "2026-1";
    await pool.request()
      .input("clave", sql.VarChar, periodoClave)
      .input("nombre", sql.NVarChar, "Semestre Enero - Junio 2026")
      .input("inicio", sql.Date, "2026-01-20")
      .input("fin", sql.Date, "2026-06-25")
      .query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.PeriodosEscolares WHERE clave = @clave)
        BEGIN
          INSERT INTO dbo.PeriodosEscolares (clave, nombre, fecha_inicio, fecha_fin, activo)
          VALUES (@clave, @nombre, @inicio, @fin, 1);
        END
      `);
    
    const periodResult = await pool.request()
      .input("clave", sql.VarChar, periodoClave)
      .query("SELECT periodo_id FROM dbo.PeriodosEscolares WHERE clave = @clave");
    const periodoId = periodResult.recordset[0].periodo_id;
    console.log(`Using School Period ID: ${periodoId} (${periodoClave})`);

    // 5. Read Excel
    const workbook = new exceljs.Workbook();
    console.log("Loading Excel file: C:\\Users\Admin\\Downloads\\BD Docentes.xlsx");
    await workbook.xlsx.readFile("C:\\Users\\Admin\\Downloads\\BD Docentes.xlsx");
    
    const worksheet = workbook.getWorksheet("sistemas horario cambio cultura");
    if (!worksheet) {
      throw new Error("Sheet 'sistemas horario cambio cultura' not found in Excel!");
    }

    // Hash default password for imported teachers: "docente123"
    console.log("Hashing default teacher password 'docente123'...");
    const defaultPasswordHash = await bcrypt.hash("docente123", 10);

    // Let's locate the header row and start parsing
    let headerRowIdx = -1;
    worksheet.eachRow((row, rowNumber) => {
      const firstCell = row.getCell(1).value;
      if (firstCell === "GRUPO (NÚMERO- TURNO)") {
        headerRowIdx = rowNumber;
      }
    });

    if (headerRowIdx === -1) {
      throw new Error("Could not find headers in Excel sheet!");
    }
    console.log(`Headers found at row: ${headerRowIdx}`);

    let processedCount = 0;
    let createdDocentesCount = 0;
    let createdMateriasCount = 0;
    let createdGruposCount = 0;
    let createdAsignacionesCount = 0;

    // We'll iterate starting from the row after headers
    for (let i = headerRowIdx + 1; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      
      const grupoVal = row.getCell(1).value;
      const semestreVal = row.getCell(2).value;
      const claveDocenteVal = row.getCell(3).value;
      const nombreDocenteVal = row.getCell(4).value;
      const materiaNameVal = row.getCell(5).value;
      const materiaClaveVal = row.getCell(6).value;
      
      // Skip empty or spacer rows
      if (!nombreDocenteVal && !grupoVal && !materiaNameVal) continue;

      processedCount++;

      // A. Process Teacher
      let teacherName = (nombreDocenteVal || "Docente Asignado").toString().trim();
      let teacherClave = claveDocenteVal ? claveDocenteVal.toString().trim() : null;

      // Handle cases where clave is missing or represents administrative placeholder '*'
      if (!teacherClave || teacherClave === "*") {
        // Generate a deterministic temporary key based on teacher's name
        const cleanName = teacherName.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 10);
        teacherClave = `TEMP-${cleanName || "DOC"}`;
      }

      // Check if teacher user already exists in db
      let docenteId;
      const teacherCheck = await pool.request()
        .input("clave", sql.VarChar, teacherClave)
        .query(`
          SELECT u.usuario_id, u.correo
          FROM dbo.Usuarios u
          JOIN dbo.PerfilesDocentes pd ON pd.usuario_id = u.usuario_id
          WHERE pd.clave_docente = @clave OR (u.nombre_completo = @clave AND u.rol_id = 2)
        `);

      if (teacherCheck.recordset.length > 0) {
        docenteId = teacherCheck.recordset[0].usuario_id;
      } else {
        // Check if teacher already exists by name to avoid duplicate accounts for same name
        const teacherNameCheck = await pool.request()
          .input("nombre", sql.NVarChar, teacherName)
          .query("SELECT usuario_id FROM dbo.Usuarios WHERE nombre_completo = @nombre AND rol_id = 2");
          
        if (teacherNameCheck.recordset.length > 0) {
          docenteId = teacherNameCheck.recordset[0].usuario_id;
          // Update their profile to set the clave if it was missing
          await pool.request()
            .input("uid", sql.Int, docenteId)
            .input("clave", sql.VarChar, teacherClave)
            .query("UPDATE dbo.PerfilesDocentes SET clave_docente = @clave WHERE usuario_id = @uid AND clave_docente IS NULL");
        } else {
          // Create new user
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
          
          // Determine turn (can be Vespertino or Matutino based on group)
          const teacherTurn = parseTurnFromGroup(grupoVal ? grupoVal.toString() : "");

          await pool.request()
            .input("uid", sql.Int, docenteId)
            .input("turno", sql.VarChar, teacherTurn)
            .input("clave", sql.VarChar, teacherClave)
            .query(`
              INSERT INTO dbo.PerfilesDocentes (usuario_id, turno, clave_docente)
              VALUES (@uid, @turno, @clave)
            `);

          createdDocentesCount++;
          importedTeachers.push({
            name: teacherName,
            clave: teacherClave,
            email: teacherEmail,
            password: "docente123"
          });
        }
      }

      // B. Process Materia
      let materiaName = (materiaNameVal || "Materia Genérica").toString().trim();
      let materiaClave = materiaClaveVal ? materiaClaveVal.toString().trim() : null;

      if (!materiaClave || materiaClave === "*") {
        // Check if subject name represents a standard administrative activity
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

      let materiaId;
      const subjectCheck = await pool.request()
        .input("clave", sql.VarChar, materiaClave)
        .query("SELECT materia_id FROM dbo.Materias WHERE clave = @clave");

      if (subjectCheck.recordset.length > 0) {
        materiaId = subjectCheck.recordset[0].materia_id;
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
        createdMateriasCount++;
      }

      // C. Process Grupo
      let grupoClave = (grupoVal || "*").toString().trim();
      let excelSemestre = semestreVal ? semestreVal.toString().trim() : null;

      let grupoId;
      const groupCheck = await pool.request()
        .input("clave", sql.VarChar, grupoClave)
        .query("SELECT grupo_id FROM dbo.Grupos WHERE clave = @clave");

      if (groupCheck.recordset.length > 0) {
        grupoId = groupCheck.recordset[0].grupo_id;
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
          .query(`
            INSERT INTO dbo.Grupos (clave, semestre, turno, cupo, carrera_id)
            OUTPUT INSERTED.grupo_id
            VALUES (@clave, @semestre, @turno, 30, @carreraId)
          `);
        grupoId = insertGroup.recordset[0].grupo_id;
        createdGruposCount++;
      }

      // D. Parse Schedule Columns (Lunes=col 7, Martes=col 8, Miercoles=col 9, Jueves=col 10, Viernes=col 11, Sabado=col 12)
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

      // E. Create AsignacionDocente
      await pool.request()
        .input("docenteId", sql.Int, docenteId)
        .input("materiaId", sql.Int, materiaId)
        .input("grupoId", sql.Int, grupoId)
        .input("horario", sql.NVarChar, horarioString)
        .input("periodoId", sql.Int, periodoId)
        .query(`
          IF NOT EXISTS (
            SELECT 1 FROM dbo.AsignacionesDocentes 
            WHERE docente_id = @docenteId AND materia_id = @materiaId AND grupo_id = @grupoId AND (periodo_id = @periodoId OR (periodo_id IS NULL AND @periodoId IS NULL))
          )
          BEGIN
            INSERT INTO dbo.AsignacionesDocentes (docente_id, materia_id, grupo_id, horario, periodo_id)
            VALUES (@docenteId, @materiaId, @grupoId, @horario, @periodoId);
          END
          ELSE
          BEGIN
            UPDATE dbo.AsignacionesDocentes
            SET horario = @horario
            WHERE docente_id = @docenteId AND materia_id = @materiaId AND grupo_id = @grupoId AND (periodo_id = @periodoId OR (periodo_id IS NULL AND @periodoId IS NULL));
          END
        `);
      createdAsignacionesCount++;
    }

    console.log("=== IMPORT STATISTICS ===");
    console.log(`Total rows processed: ${processedCount}`);
    console.log(`New Docentes created: ${createdDocentesCount}`);
    console.log(`New Materias created: ${createdMateriasCount}`);
    console.log(`New Grupos created: ${createdGruposCount}`);
    console.log(`Asignaciones created/updated: ${createdAsignacionesCount}`);

    // Write teachers summary to a markdown file
    const brainDir = "C:\\Users\\Admin\\.gemini\\antigravity\\brain\\14020ad1-d011-4c3d-8c1e-38166185c362";
    const summaryPath = path.join(brainDir, "docentes_importados.md");
    
    let summaryContent = `# Resumen de Cuentas de Docentes Importados\n\n`;
    summaryContent += `Se procesó el archivo de distribución horaria de docentes y se crearon las siguientes cuentas en **RinoAsistDB**:\n\n`;
    summaryContent += `| Nombre del Docente | Clave | Correo de Acceso | Contraseña Temporal |\n`;
    summaryContent += `| :--- | :--- | :--- | :--- |\n`;
    
    importedTeachers.forEach(t => {
      summaryContent += `| ${t.name} | ${t.clave} | ${t.email} | \`${t.password}\` |\n`;
    });
    
    summaryContent += `\n\n*Nota: La contraseña por defecto de todos los docentes es \`docente123\` (encriptada con bcrypt en la base de datos).*\n`;
    
    fs.writeFileSync(summaryPath, summaryContent, "utf-8");
    console.log(`Summary document written to: ${summaryPath}`);

    process.exit(0);
  } catch (err) {
    console.error("Error during import process:", err);
    process.exit(1);
  }
}

main();
