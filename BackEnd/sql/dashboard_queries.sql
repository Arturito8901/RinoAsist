USE AsistenciasDB;
GO

------------------------------------------------------------
-- 1. Login básico (Node llamará a este query parametrizado)
------------------------------------------------------------
SELECT
    U.usuario_id,
    U.nombre_completo,
    U.correo,
    U.rol_id,
    R.rol_nombre,
    U.password_hash
FROM dbo.Usuarios U
JOIN dbo.Roles R ON U.rol_id = R.rol_id
WHERE U.correo = @correo
  AND U.activo = 1;
-- (La verificación del password_hash se hace en Node)

------------------------------------------------------------
-- 2. Resumen para Admin (cards + gráfico global)
------------------------------------------------------------
SELECT
    (SELECT COUNT(*) FROM dbo.PerfilesDocentes)        AS total_docentes,
    (SELECT COUNT(*) FROM dbo.AsignacionesDocentes)    AS total_grupos,
    (SELECT COUNT(*) FROM dbo.PerfilesAlumnos)         AS total_alumnos,
    (SELECT AVG(asistencia_pct) FROM dbo.vwResumenAsistencias) AS asistencia_promedio
;

-- Serie mensual (últimos 6 meses)
WITH ResumenMensual AS (
    SELECT
        FORMAT(sa.fecha, 'MMM', 'es-MX') AS etiqueta,
        AVG(CASE WHEN ra.estatus = 'asistio' THEN 100.0 ELSE 0 END) AS pct
    FROM dbo.RegistrosAsistencia ra
    JOIN dbo.SesionesAsistencia sa ON ra.sesion_id = sa.sesion_id
    WHERE sa.fecha >= DATEADD(MONTH, -6, CAST(GETDATE() AS DATE))
    GROUP BY FORMAT(sa.fecha, 'yyyyMM'), FORMAT(sa.fecha, 'MMM', 'es-MX')
)
SELECT etiqueta, CAST(pct AS DECIMAL(5,2)) AS asistencia_pct
FROM ResumenMensual
ORDER BY MIN(etiqueta);

------------------------------------------------------------
-- 3. Listado y filtros para Admin
------------------------------------------------------------
SELECT
    TA.docente_id,
    U.nombre_completo      AS docente,
    U.correo,
    PD.turno,
    COUNT(DISTINCT TA.asignacion_id) AS grupos,
    COUNT(DISTINCT I.alumno_id)      AS alumnos,
    AVG(VS.asistencia_pct)           AS asistencia_promedio
FROM dbo.AsignacionesDocentes TA
JOIN dbo.Usuarios U ON TA.docente_id = U.usuario_id
JOIN dbo.PerfilesDocentes PD ON PD.usuario_id = TA.docente_id
LEFT JOIN dbo.Inscripciones I ON I.asignacion_id = TA.asignacion_id
LEFT JOIN dbo.vwResumenAsistencias VS ON VS.asignacion_id = TA.asignacion_id
WHERE (@busqueda IS NULL OR U.nombre_completo LIKE CONCAT('%', @busqueda, '%') OR U.correo LIKE CONCAT('%', @busqueda, '%'))
  AND (@turno IS NULL OR @turno = 'all' OR PD.turno = @turno)
GROUP BY TA.docente_id, U.nombre_completo, U.correo, PD.turno
ORDER BY U.nombre_completo;

------------------------------------------------------------
-- 4. Panel docente (sus grupos / gráficas / acciones)
------------------------------------------------------------
-- Listado de grupos/materias del docente autenticado
SELECT
    TA.asignacion_id,
    M.nombre     AS materia,
    G.clave      AS grupo,
    M.clave      AS clave,
    COUNT(DISTINCT I.alumno_id) AS inscritos,
    AVG(VS.asistencia_pct)      AS asistencia_promedio
FROM dbo.AsignacionesDocentes TA
JOIN dbo.Materias M ON TA.materia_id = M.materia_id
JOIN dbo.Grupos G ON TA.grupo_id = G.grupo_id
LEFT JOIN dbo.Inscripciones I ON I.asignacion_id = TA.asignacion_id
LEFT JOIN dbo.vwResumenAsistencias VS ON VS.asignacion_id = TA.asignacion_id
WHERE TA.docente_id = @docenteId
GROUP BY TA.asignacion_id, M.nombre, G.clave, M.clave
ORDER BY M.nombre;

-- Serie temporal (últimas 4 semanas) para cada grupo del docente
SELECT
    TA.asignacion_id,
    FORMAT(sa.fecha, 'dd/MM') AS etiqueta,
    CAST(AVG(CASE WHEN ra.estatus = 'asistio' THEN 100.0 ELSE 0 END) AS DECIMAL(5,2)) AS asistencia_pct
FROM dbo.SesionesAsistencia sa
JOIN dbo.RegistrosAsistencia ra ON ra.sesion_id = sa.sesion_id
JOIN dbo.AsignacionesDocentes TA ON sa.asignacion_id = TA.asignacion_id
WHERE TA.docente_id = @docenteId
  AND sa.fecha >= DATEADD(WEEK, -4, CAST(GETDATE() AS DATE))
GROUP BY TA.asignacion_id, sa.fecha
ORDER BY TA.asignacion_id, sa.fecha;

------------------------------------------------------------
-- 5. Panel alumno (materias inscritas + gráfica personal)
------------------------------------------------------------
SELECT
    M.nombre            AS materia,
    G.clave             AS grupo,
    U.nombre_completo   AS docente,
    AVG(CASE WHEN ra.estatus = 'asistio' THEN 100.0 ELSE 0 END) AS asistencia_pct
FROM dbo.Inscripciones I
JOIN dbo.AsignacionesDocentes TA ON I.asignacion_id = TA.asignacion_id
JOIN dbo.Materias M ON TA.materia_id = M.materia_id
JOIN dbo.Grupos G ON TA.grupo_id = G.grupo_id
JOIN dbo.Usuarios U ON TA.docente_id = U.usuario_id
LEFT JOIN dbo.SesionesAsistencia sa ON sa.asignacion_id = TA.asignacion_id
LEFT JOIN dbo.RegistrosAsistencia ra
       ON ra.sesion_id = sa.sesion_id AND ra.alumno_id = I.alumno_id
WHERE I.alumno_id = @alumnoId
GROUP BY M.nombre, G.clave, U.nombre_completo;

-- Serie personal (últimas sesiones del alumno)
SELECT TOP (20)
    FORMAT(sa.fecha, 'dd/MM') AS etiqueta,
    CASE ra.estatus
        WHEN 'asistio' THEN 100
        WHEN 'retardo' THEN 70
        ELSE 0
    END AS asistencia_pct
FROM dbo.SesionesAsistencia sa
JOIN dbo.RegistrosAsistencia ra ON ra.sesion_id = sa.sesion_id
WHERE ra.alumno_id = @alumnoId
ORDER BY sa.fecha DESC;
GO
