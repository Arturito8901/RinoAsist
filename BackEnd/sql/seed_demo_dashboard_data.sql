USE AsistenciasDB;
GO

SET NOCOUNT ON;

DECLARE @pass NVARCHAR(255) = '$2b$10$AEhHCVaOXX2Wlxj37ZR3FO/SLKN7l9UkM54lGSHGazDG3wZdK0.tm';
DECLARE @baseMonday DATE =
    DATEADD(DAY, -(DATEDIFF(DAY, 0, CAST(GETDATE() AS DATE)) % 7), CAST(GETDATE() AS DATE));

DECLARE @DemoAlumnos TABLE (
    n         INT PRIMARY KEY,
    nombre    NVARCHAR(120),
    correo    NVARCHAR(150),
    matricula VARCHAR(20),
    semestre  TINYINT
);

;WITH N AS (
    SELECT v.n
    FROM (VALUES
        (1),(2),(3),(4),(5),
        (6),(7),(8),(9),(10)
    ) v(n)
)
INSERT INTO @DemoAlumnos (n, nombre, correo, matricula, semestre)
SELECT
    n,
    CONCAT(N'Alumno Demo ', RIGHT(CONCAT('00', n), 2)),
    CONCAT('demo', RIGHT(CONCAT('00', n), 2), '@tesci.edu.mx'),
    CONCAT('TESCI-DEMO-', RIGHT(CONCAT('000', n), 3)),
    7
FROM N;

------------------------------------------------------------
-- 1. Crear alumnos demo
------------------------------------------------------------
INSERT INTO dbo.Usuarios (rol_id, nombre_completo, correo, password_hash)
SELECT
    3,
    d.nombre,
    d.correo,
    @pass
FROM @DemoAlumnos d
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.Usuarios u
    WHERE u.correo = d.correo
);

INSERT INTO dbo.PerfilesAlumnos (usuario_id, matricula, semestre)
SELECT
    u.usuario_id,
    d.matricula,
    d.semestre
FROM @DemoAlumnos d
JOIN dbo.Usuarios u
    ON u.correo = d.correo
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.PerfilesAlumnos pa
    WHERE pa.usuario_id = u.usuario_id
);

------------------------------------------------------------
-- 2. Inscribir a todos los alumnos activos en todas las asignaciones
------------------------------------------------------------
INSERT INTO dbo.Inscripciones (alumno_id, asignacion_id, estatus)
SELECT
    pa.usuario_id,
    ad.asignacion_id,
    'activo'
FROM dbo.PerfilesAlumnos pa
JOIN dbo.Usuarios u
    ON u.usuario_id = pa.usuario_id
   AND u.activo = 1
CROSS JOIN dbo.AsignacionesDocentes ad
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.Inscripciones i
    WHERE i.alumno_id = pa.usuario_id
      AND i.asignacion_id = ad.asignacion_id
);

------------------------------------------------------------
-- 3. Generar sesiones demo de las últimas 12 semanas
------------------------------------------------------------
;WITH Weeks AS (
    SELECT v.semana
    FROM (VALUES
        (1),(2),(3),(4),(5),(6),
        (7),(8),(9),(10),(11),(12)
    ) v(semana)
),
HorarioBase AS (
    SELECT
        ad.asignacion_id,
        ad.docente_id,
        ad.horario,
        CASE
            WHEN ad.horario LIKE 'Ma%' THEN 1
            WHEN ad.horario LIKE 'Mi%' THEN 2
            WHEN ad.horario LIKE 'Ju%' THEN 3
            WHEN ad.horario LIKE 'Vi%' THEN 4
            ELSE 0
        END AS primer_offset,
        CASE
            WHEN ad.horario LIKE '%Mi%' THEN 2
            WHEN ad.horario LIKE '%Ju%' THEN 3
            WHEN ad.horario LIKE '%Vi%' THEN 4
            WHEN ad.horario LIKE '%Sa%' THEN 5
            ELSE NULL
        END AS segundo_offset
    FROM dbo.AsignacionesDocentes ad
),
FechasDemo AS (
    SELECT
        hb.asignacion_id,
        hb.docente_id,
        DATEADD(DAY, d.day_offset, DATEADD(WEEK, -w.semana, @baseMonday)) AS fecha
    FROM HorarioBase hb
    CROSS JOIN Weeks w
    CROSS APPLY (VALUES (hb.primer_offset), (hb.segundo_offset)) d(day_offset)
    WHERE d.day_offset IS NOT NULL
)
INSERT INTO dbo.SesionesAsistencia (asignacion_id, fecha, tema, creado_por)
SELECT
    fd.asignacion_id,
    fd.fecha,
    CONCAT(N'Sesión demo ', FORMAT(fd.fecha, 'dd/MM')),
    fd.docente_id
FROM FechasDemo fd
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.SesionesAsistencia sa
    WHERE sa.asignacion_id = fd.asignacion_id
      AND sa.fecha = fd.fecha
);

------------------------------------------------------------
-- 4. Generar registros de asistencia con variación realista
------------------------------------------------------------
INSERT INTO dbo.RegistrosAsistencia (sesion_id, alumno_id, estatus, notas, marcado_en)
SELECT
    sa.sesion_id,
    i.alumno_id,
    CASE
        WHEN ABS(CHECKSUM(CONCAT(sa.sesion_id, '-', i.alumno_id))) % 100 < 72 THEN 'asistio'
        WHEN ABS(CHECKSUM(CONCAT(sa.sesion_id, '-', i.alumno_id))) % 100 < 88 THEN 'retardo'
        ELSE 'falta'
    END AS estatus,
    NULL AS notas,
    DATEADD(
        MINUTE,
        ABS(CHECKSUM(CONCAT('M', sa.sesion_id, '-', i.alumno_id))) % 20,
        CAST(sa.fecha AS DATETIME2(0))
    ) AS marcado_en
FROM dbo.SesionesAsistencia sa
JOIN dbo.Inscripciones i
    ON i.asignacion_id = sa.asignacion_id
   AND i.estatus = 'activo'
JOIN dbo.Usuarios u
    ON u.usuario_id = i.alumno_id
   AND u.activo = 1
WHERE sa.fecha >= DATEADD(WEEK, -12, @baseMonday)
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.RegistrosAsistencia ra
      WHERE ra.sesion_id = sa.sesion_id
        AND ra.alumno_id = i.alumno_id
  );

------------------------------------------------------------
-- 5. Resumen rápido para validar
------------------------------------------------------------
SELECT
    COUNT(*) AS total_alumnos
FROM dbo.PerfilesAlumnos;

SELECT
    COUNT(*) AS total_inscripciones
FROM dbo.Inscripciones;

SELECT
    COUNT(*) AS sesiones_ultimas_12_semanas
FROM dbo.SesionesAsistencia
WHERE fecha >= DATEADD(WEEK, -12, @baseMonday);

SELECT
    COUNT(*) AS registros_ultimas_12_semanas
FROM dbo.RegistrosAsistencia ra
JOIN dbo.SesionesAsistencia sa
    ON sa.sesion_id = ra.sesion_id
WHERE sa.fecha >= DATEADD(WEEK, -12, @baseMonday);

SELECT
    m.nombre AS materia,
    g.clave  AS grupo,
    COUNT(DISTINCT sa.sesion_id) AS sesiones,
    COUNT(ra.registro_id) AS registros,
    CAST(100.0 * SUM(CASE WHEN ra.estatus = 'asistio' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0) AS DECIMAL(5,2)) AS asistencia_pct
FROM dbo.SesionesAsistencia sa
JOIN dbo.RegistrosAsistencia ra
    ON ra.sesion_id = sa.sesion_id
JOIN dbo.AsignacionesDocentes ad
    ON ad.asignacion_id = sa.asignacion_id
JOIN dbo.Materias m
    ON m.materia_id = ad.materia_id
JOIN dbo.Grupos g
    ON g.grupo_id = ad.grupo_id
WHERE sa.fecha >= DATEADD(WEEK, -12, @baseMonday)
GROUP BY m.nombre, g.clave
ORDER BY sesiones DESC, registros DESC;
GO
