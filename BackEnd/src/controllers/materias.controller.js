import sql from "mssql";
import { runQuery } from "../config/db.js";

export const getMaterias = async (req, res) => {
  const { ciclo = null } = req.query;
  try {
    // Resolve target period (same pattern as assignments and dashboard controllers)
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

    let queryParams = [];
    let countSubquery = `(SELECT COUNT(*) FROM dbo.AsignacionesDocentes ad WHERE ad.materia_id = m.materia_id)`;
    if (activePeriodId) {
      countSubquery = `(SELECT COUNT(*) FROM dbo.AsignacionesDocentes ad WHERE ad.materia_id = m.materia_id AND ad.periodo_id = @activePeriodId)`;
      queryParams.push({ name: "activePeriodId", type: sql.Int, value: activePeriodId });
    }

    const result = await runQuery(`
      SELECT 
        m.materia_id,
        m.clave,
        m.nombre,
        m.creditos,
        m.activo,
        ${countSubquery} AS asignaciones_count,
        (SELECT COUNT(*) FROM dbo.AsignacionesDocentes ad WHERE ad.materia_id = m.materia_id) AS total_historico_count
      FROM dbo.Materias m
      ORDER BY m.activo DESC, m.nombre ASC
    `, queryParams);

    return res.json(result.recordset || []);
  } catch (error) {
    console.error("Error al obtener materias:", error);
    return res.status(500).json({ message: "Error interno al obtener el catálogo de materias" });
  }
};

export const createMateria = async (req, res) => {
  const { clave, nombre, creditos = 5 } = req.body || {};

  if (!clave || !nombre) {
    return res.status(400).json({ message: "La clave y el nombre de la materia son obligatorios" });
  }

  const cleanClave = String(clave).trim().toUpperCase();
  const cleanNombre = String(nombre).trim();
  const cleanCreditos = parseInt(creditos) || 5;

  try {
    // Check if clave already exists
    const checkClave = await runQuery(`
      SELECT materia_id FROM dbo.Materias WHERE UPPER(clave) = @clave
    `, [{ name: "clave", type: sql.VarChar, value: cleanClave }]);

    if (checkClave.recordset && checkClave.recordset.length > 0) {
      return res.status(409).json({ message: `Ya existe una materia registrada con la clave "${cleanClave}"` });
    }

    const insertResult = await runQuery(`
      INSERT INTO dbo.Materias (clave, nombre, creditos, activo)
      OUTPUT INSERTED.materia_id, INSERTED.clave, INSERTED.nombre, INSERTED.creditos, INSERTED.activo
      VALUES (@clave, @nombre, @creditos, 1)
    `, [
      { name: "clave", type: sql.VarChar, value: cleanClave },
      { name: "nombre", type: sql.NVarChar, value: cleanNombre },
      { name: "creditos", type: sql.TinyInt, value: cleanCreditos }
    ]);

    const newMateria = insertResult.recordset[0];
    return res.status(201).json({
      success: true,
      message: "Materia registrada exitosamente en el catálogo",
      materia: { ...newMateria, asignaciones_count: 0, total_historico_count: 0 }
    });
  } catch (error) {
    console.error("Error al crear materia:", error);
    return res.status(500).json({ message: "No se pudo registrar la materia" });
  }
};

export const updateMateria = async (req, res) => {
  const { id } = req.params;
  const { clave, nombre, creditos } = req.body || {};

  if (!id) {
    return res.status(400).json({ message: "ID de materia obligatorio" });
  }

  if (!clave || !nombre) {
    return res.status(400).json({ message: "La clave y el nombre de la materia son obligatorios" });
  }

  const materiaId = parseInt(id);
  const cleanClave = String(clave).trim().toUpperCase();
  const cleanNombre = String(nombre).trim();
  const cleanCreditos = parseInt(creditos) || 5;

  try {
    // Verify existence
    const checkExist = await runQuery(`
      SELECT materia_id, clave, activo FROM dbo.Materias WHERE materia_id = @materiaId
    `, [{ name: "materiaId", type: sql.Int, value: materiaId }]);

    if (!checkExist.recordset || checkExist.recordset.length === 0) {
      return res.status(404).json({ message: "Materia no encontrada" });
    }

    // Check if new clave conflicts with another subject
    const checkClave = await runQuery(`
      SELECT materia_id FROM dbo.Materias 
      WHERE UPPER(clave) = @clave AND materia_id <> @materiaId
    `, [
      { name: "clave", type: sql.VarChar, value: cleanClave },
      { name: "materiaId", type: sql.Int, value: materiaId }
    ]);

    if (checkClave.recordset && checkClave.recordset.length > 0) {
      return res.status(409).json({ message: `La clave "${cleanClave}" ya está en uso por otra materia` });
    }

    await runQuery(`
      UPDATE dbo.Materias
      SET clave = @clave,
          nombre = @nombre,
          creditos = @creditos
      WHERE materia_id = @materiaId
    `, [
      { name: "materiaId", type: sql.Int, value: materiaId },
      { name: "clave", type: sql.VarChar, value: cleanClave },
      { name: "nombre", type: sql.NVarChar, value: cleanNombre },
      { name: "creditos", type: sql.TinyInt, value: cleanCreditos }
    ]);

    return res.json({
      success: true,
      message: "Materia actualizada con éxito",
      materia: {
        materia_id: materiaId,
        clave: cleanClave,
        nombre: cleanNombre,
        creditos: cleanCreditos,
        activo: checkExist.recordset[0].activo
      }
    });
  } catch (error) {
    console.error("Error al actualizar materia:", error);
    return res.status(500).json({ message: "No se pudo actualizar la materia" });
  }
};

export const deleteMateria = async (req, res) => {
  const { id } = req.params;
  const { ciclo = null } = req.query;

  if (!id) {
    return res.status(400).json({ message: "ID de materia obligatorio" });
  }

  const materiaId = parseInt(id);

  try {
    // 1. Check if materia exists
    const checkExist = await runQuery(`
      SELECT materia_id, nombre, clave, activo FROM dbo.Materias WHERE materia_id = @materiaId
    `, [{ name: "materiaId", type: sql.Int, value: materiaId }]);

    if (!checkExist.recordset || checkExist.recordset.length === 0) {
      return res.status(404).json({ message: "Materia no encontrada" });
    }

    const materia = checkExist.recordset[0];

    // Resolve target period for better error context
    let targetPeriod = null;
    if (ciclo) {
      const pRes = await runQuery(
        "SELECT TOP 1 periodo_id, clave FROM dbo.PeriodosEscolares WHERE clave = @ciclo",
        [{ name: "ciclo", type: sql.VarChar, value: ciclo }]
      );
      if (pRes.recordset.length > 0) targetPeriod = pRes.recordset[0];
    }
    if (!targetPeriod) {
      const pRes = await runQuery(
        "SELECT TOP 1 periodo_id, clave FROM dbo.PeriodosEscolares WHERE activo = 1 ORDER BY creado_en DESC"
      );
      targetPeriod = pRes.recordset[0];
    }
    const activePeriodId = targetPeriod?.periodo_id || null;

    // 2. Check assignments
    const checkAssignments = await runQuery(`
      SELECT 
        COUNT(*) AS total_historico,
        SUM(CASE WHEN periodo_id = @activePeriodId THEN 1 ELSE 0 END) AS total_ciclo
      FROM dbo.AsignacionesDocentes 
      WHERE materia_id = @materiaId
    `, [
      { name: "materiaId", type: sql.Int, value: materiaId },
      { name: "activePeriodId", type: sql.Int, value: activePeriodId || 0 }
    ]);

    const totalHistorico = checkAssignments.recordset[0]?.total_historico || 0;
    const totalCiclo = checkAssignments.recordset[0]?.total_ciclo || 0;

    if (totalCiclo > 0) {
      return res.status(400).json({
        message: `No se puede dar de baja ni eliminar "${materia.nombre}" porque tiene ${totalCiclo} clase(s) asignadas en el ciclo escolar actual (${targetPeriod?.clave || 'activo'}). Primero debes desvincular sus clases en el asignador de horarios.`
      });
    }

    if (totalHistorico > 0) {
      // SOFT DELETE: Inactivar la materia para preservar el historial académico de ciclos pasados
      await runQuery(`
        UPDATE dbo.Materias SET activo = 0 WHERE materia_id = @materiaId
      `, [{ name: "materiaId", type: sql.Int, value: materiaId }]);

      return res.json({
        success: true,
        action: "archived",
        message: `La materia "${materia.nombre}" (${materia.clave}) fue dada de baja del plan de estudios. Ya no estará disponible para nuevas asignaciones, pero su historial de ${totalHistorico} clase(s) en ciclos anteriores se conserva intacto.`
      });
    }

    // HARD DELETE: Si nunca tuvo asignaciones en ningún ciclo, se borra definitivamente
    await runQuery(`
      DELETE FROM dbo.Materias WHERE materia_id = @materiaId
    `, [{ name: "materiaId", type: sql.Int, value: materiaId }]);

    return res.json({
      success: true,
      action: "deleted",
      message: `La materia "${materia.nombre}" (${materia.clave}) no tenía historial y ha sido eliminada definitivamente del catálogo.`
    });
  } catch (error) {
    console.error("Error al eliminar materia:", error);
    return res.status(500).json({ message: "No se pudo eliminar la materia" });
  }
};

export const reactivateMateria = async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ message: "ID de materia obligatorio" });

  const materiaId = parseInt(id);

  try {
    const checkExist = await runQuery(`
      SELECT materia_id, nombre, clave, activo FROM dbo.Materias WHERE materia_id = @materiaId
    `, [{ name: "materiaId", type: sql.Int, value: materiaId }]);

    if (!checkExist.recordset || checkExist.recordset.length === 0) {
      return res.status(404).json({ message: "Materia no encontrada" });
    }

    const materia = checkExist.recordset[0];

    await runQuery(`
      UPDATE dbo.Materias SET activo = 1 WHERE materia_id = @materiaId
    `, [{ name: "materiaId", type: sql.Int, value: materiaId }]);

    return res.json({
      success: true,
      message: `La materia "${materia.nombre}" (${materia.clave}) ha sido reactivada exitosamente y vuelve a estar disponible para asignaciones.`
    });
  } catch (error) {
    console.error("Error al reactivar materia:", error);
    return res.status(500).json({ message: "No se pudo reactivar la materia" });
  }
};
