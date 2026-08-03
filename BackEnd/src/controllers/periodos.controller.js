import { runQuery, sql, getPool } from "../config/db.js";
import { syncStudentEnrollmentsForActivePeriod } from "./alumnos.controller.js";

export const getPeriodos = async (req, res) => {
  try {
    const result = await runQuery(`
      SELECT periodo_id, clave, nombre, fecha_inicio, fecha_fin, activo, creado_en
      FROM dbo.PeriodosEscolares
      ORDER BY creado_en DESC
    `);
    return res.json(result.recordset);
  } catch (error) {
    console.error("Error getPeriodos:", error);
    return res.status(500).json({ message: "Error al obtener los periodos escolares" });
  }
};

const calculateCurrentClave = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Enero, 1 = Febrero, ..., 7 = Agosto, 8 = Septiembre
  
  if (month === 0) {
    return `${year - 1}-2`;
  } else if (month === 1) {
    return `Inter ${year - 1}-2`;
  } else if (month >= 2 && month <= 6) {
    return `${year}-1`;
  } else if (month === 7) {
    return `Inter ${year}-1`;
  } else {
    return `${year}-2`;
  }
};

export const getActivePeriodo = async (req, res) => {
  try {
    const pool = await getPool();
    
    // 1. Fetch currently active period
    const result = await pool.request().query(`
      SELECT TOP 1 periodo_id, clave, nombre, fecha_inicio, fecha_fin, activo
      FROM dbo.PeriodosEscolares
      WHERE activo = 1
      ORDER BY creado_en DESC
    `);
    
    let activePeriod = result.recordset[0];
    const now = new Date();
    
    // 2. If no active period OR active period is expired, auto-activate the current period
    if (!activePeriod || now > new Date(activePeriod.fecha_fin)) {
      const currentClave = calculateCurrentClave();
      
      // Check if current period already exists in DB
      const checkResult = await pool.request()
        .input("clave", sql.VarChar, currentClave)
        .query("SELECT periodo_id, clave, nombre, fecha_inicio, fecha_fin, activo FROM dbo.PeriodosEscolares WHERE clave = @clave");
        
      let targetPeriodId;
      
      if (checkResult.recordset.length > 0) {
        targetPeriodId = checkResult.recordset[0].periodo_id;
      } else {
        // Create the period
        const isInter = currentClave.toUpperCase().includes("INTER");
        const yearMatch = currentClave.match(/\d{4}/);
        const year = yearMatch ? parseInt(yearMatch[0]) : now.getFullYear();
        
        let nombre = `Ciclo ${currentClave}`;
        let fechaInicio = `${year}-01-01`;
        let fechaFin = `${year}-06-30`;

        if (isInter) {
          if (currentClave.endsWith("-1") || currentClave.endsWith(" 1")) {
            nombre = `Curso Intersemestral Agosto ${year}`;
            fechaInicio = `${year}-08-01`;
            fechaFin = `${year}-08-31`;
          } else {
            nombre = `Curso Intersemestral Febrero ${year + 1}`;
            fechaInicio = `${year + 1}-02-01`;
            fechaFin = `${year + 1}-02-28`;
          }
        } else {
          if (currentClave.endsWith("-1") || currentClave.endsWith(" 1")) {
            nombre = `Semestre Marzo - Julio ${year}`;
            fechaInicio = `${year}-03-01`;
            fechaFin = `${year}-07-31`;
          } else {
            nombre = `Semestre Septiembre ${year} - Enero ${year + 1}`;
            fechaInicio = `${year}-09-01`;
            fechaFin = `${year + 1}-01-31`;
          }
        }

        const insertResult = await pool.request()
          .input("clave", sql.VarChar, currentClave)
          .input("nombre", sql.NVarChar, nombre)
          .input("fechaInicio", sql.Date, fechaInicio)
          .input("fechaFin", sql.Date, fechaFin)
          .query(`
            INSERT INTO dbo.PeriodosEscolares (clave, nombre, fecha_inicio, fecha_fin, activo)
            OUTPUT INSERTED.periodo_id, INSERTED.clave, INSERTED.nombre, INSERTED.fecha_inicio, INSERTED.fecha_fin, INSERTED.activo
            VALUES (@clave, @nombre, @fechaInicio, @fechaFin, 0)
          `);
          
        targetPeriodId = insertResult.recordset[0].periodo_id;
      }
      
      // Set this calculated period to active, others to inactive
      await pool.request()
        .input("id", sql.Int, targetPeriodId)
        .query(`
          BEGIN TRANSACTION;
            UPDATE dbo.PeriodosEscolares SET activo = 0;
            UPDATE dbo.PeriodosEscolares SET activo = 1 WHERE periodo_id = @id;
          COMMIT TRANSACTION;
        `);
        
      // Sync student enrollments
      await syncStudentEnrollmentsForActivePeriod();
      
      // Re-fetch the newly activated period to return it
      const finalResult = await pool.request()
        .input("id", sql.Int, targetPeriodId)
        .query("SELECT periodo_id, clave, nombre, fecha_inicio, fecha_fin, activo FROM dbo.PeriodosEscolares WHERE periodo_id = @id");
        
      activePeriod = finalResult.recordset[0];
    }
    
    return res.json(activePeriod);
  } catch (error) {
    console.error("Error getActivePeriodo:", error);
    return res.status(500).json({ message: "Error al obtener el periodo activo" });
  }
};

export const createPeriodo = async (req, res) => {
  const { clave, nombre, fechaInicio, fechaFin } = req.body || {};

  if (!clave || !nombre || !fechaInicio || !fechaFin) {
    return res.status(400).json({ message: "Clave, nombre, fecha de inicio y fecha de fin son requeridos" });
  }

  try {
    // Check if clave already exists
    const existing = await runQuery(`
      SELECT 1 FROM dbo.PeriodosEscolares WHERE clave = @clave
    `, [{ name: "clave", type: sql.VarChar, value: clave }]);

    if (existing.recordset.length) {
      return res.status(409).json({ message: "Ya existe un periodo escolar con esa clave" });
    }

    // Insert new period
    const result = await runQuery(`
      INSERT INTO dbo.PeriodosEscolares (clave, nombre, fecha_inicio, fecha_fin, activo)
      OUTPUT INSERTED.periodo_id
      VALUES (@clave, @nombre, @fechaInicio, @fechaFin, 0)
    `, [
      { name: "clave", type: sql.VarChar, value: clave },
      { name: "nombre", type: sql.NVarChar, value: nombre },
      { name: "fechaInicio", type: sql.Date, value: fechaInicio },
      { name: "fechaFin", type: sql.Date, value: fechaFin }
    ]);

    const newPeriodId = result.recordset[0].periodo_id;
    return res.status(201).json({ success: true, message: "Periodo escolar creado con éxito", periodoId: newPeriodId });
  } catch (error) {
    console.error("Error createPeriodo:", error);
    return res.status(500).json({ message: "Error al crear el periodo escolar" });
  }
};

export const activatePeriodo = async (req, res) => {
  const { id } = req.params;

  try {
    // Check if period exists
    const periodCheck = await runQuery(`
      SELECT 1 FROM dbo.PeriodosEscolares WHERE periodo_id = @id
    `, [{ name: "id", type: sql.Int, value: parseInt(id) }]);

    if (!periodCheck.recordset.length) {
      return res.status(404).json({ message: "El periodo escolar no existe" });
    }

    // Deactivate all periods, then activate the target one
    await runQuery(`
      BEGIN TRANSACTION;
        UPDATE dbo.PeriodosEscolares SET activo = 0;
        UPDATE dbo.PeriodosEscolares SET activo = 1 WHERE periodo_id = @id;
      COMMIT TRANSACTION;
    `, [{ name: "id", type: sql.Int, value: parseInt(id) }]);

    // Synchronize and promote student semesters/groups for the new period
    await syncStudentEnrollmentsForActivePeriod();

    return res.json({ success: true, message: "Periodo escolar activado correctamente" });
  } catch (error) {
    console.error("Error activatePeriodo:", error);
    return res.status(500).json({ message: "Error al activar el periodo escolar" });
  }
};

export const setActivePeriodoByClave = async (req, res) => {
  const { clave } = req.body || {};

  if (!clave) {
    return res.status(400).json({ message: "La clave del ciclo escolar es obligatoria" });
  }

  try {
    const pool = await getPool();
    
    // Check if it already exists
    const checkResult = await pool.request()
      .input("clave", sql.VarChar, clave)
      .query("SELECT periodo_id FROM dbo.PeriodosEscolares WHERE clave = @clave");

    let targetId;

    if (checkResult.recordset.length > 0) {
      targetId = checkResult.recordset[0].periodo_id;
    } else {
      // It does not exist, parse and create it following the pattern
      const isInter = clave.toUpperCase().includes("INTER");
      const yearMatch = clave.match(/\d{4}/);
      const year = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
      
      let nombre = `Ciclo ${clave}`;
      let fechaInicio = `${year}-01-01`;
      let fechaFin = `${year}-06-30`;

      if (isInter) {
        if (clave.endsWith("-1") || clave.endsWith(" 1")) {
          nombre = `Curso Intersemestral Agosto ${year}`;
          fechaInicio = `${year}-08-01`;
          fechaFin = `${year}-08-31`;
        } else {
          nombre = `Curso Intersemestral Febrero ${year + 1}`;
          fechaInicio = `${year + 1}-02-01`;
          fechaFin = `${year + 1}-02-28`;
        }
      } else {
        if (clave.endsWith("-1") || clave.endsWith(" 1")) {
          nombre = `Semestre Marzo - Julio ${year}`;
          fechaInicio = `${year}-03-01`;
          fechaFin = `${year}-07-31`;
        } else {
          nombre = `Semestre Septiembre ${year} - Enero ${year + 1}`;
          fechaInicio = `${year}-09-01`;
          fechaFin = `${year + 1}-01-31`;
        }
      }

      const insertResult = await pool.request()
        .input("clave", sql.VarChar, clave)
        .input("nombre", sql.NVarChar, nombre)
        .input("fechaInicio", sql.Date, fechaInicio)
        .input("fechaFin", sql.Date, fechaFin)
        .query(`
          INSERT INTO dbo.PeriodosEscolares (clave, nombre, fecha_inicio, fecha_fin, activo)
          OUTPUT INSERTED.periodo_id
          VALUES (@clave, @nombre, @fechaInicio, @fechaFin, 0)
        `);
      
      targetId = insertResult.recordset[0].periodo_id;
    }

    // Set this period as active and all others as inactive
    await pool.request()
      .input("id", sql.Int, targetId)
      .query(`
        BEGIN TRANSACTION;
          UPDATE dbo.PeriodosEscolares SET activo = 0;
          UPDATE dbo.PeriodosEscolares SET activo = 1 WHERE periodo_id = @id;
        COMMIT TRANSACTION;
      `);

    // Synchronize and promote student semesters/groups for the new period
    await syncStudentEnrollmentsForActivePeriod();

    return res.json({ success: true, message: "Ciclo escolar alternado correctamente", periodo_id: targetId, clave });

  } catch (error) {
    console.error("Error setActivePeriodoByClave:", error);
    return res.status(500).json({ message: "Error al alternar el ciclo escolar activo" });
  }
};

