------------------------------------------------------------
-- Catálogos base
------------------------------------------------------------
CREATE TABLE dbo.Roles (
    rol_id     TINYINT      NOT NULL PRIMARY KEY,
    rol_nombre VARCHAR(20)  NOT NULL UNIQUE
);

INSERT INTO dbo.Roles (rol_id, rol_nombre)
VALUES
    (1, 'admin'),
    (2, 'docente'),
    (3, 'alumno');

CREATE TABLE dbo.Usuarios (
    usuario_id       INT            IDENTITY(1,1) PRIMARY KEY,
    rol_id           TINYINT        NOT NULL REFERENCES dbo.Roles(rol_id),
    nombre_completo  NVARCHAR(120)  NOT NULL,
    correo           NVARCHAR(150)  NOT NULL UNIQUE,
    password_hash    NVARCHAR(255)  NOT NULL,
    activo           BIT            NOT NULL DEFAULT 1,
    creado_en        DATETIME2(0)   NOT NULL DEFAULT SYSDATETIME()
);

CREATE TABLE dbo.PerfilesDocentes (
    usuario_id     INT          NOT NULL PRIMARY KEY REFERENCES dbo.Usuarios(usuario_id),
    turno          VARCHAR(20)  NOT NULL,
    biografia      NVARCHAR(250) NULL,
    clave_docente  VARCHAR(20)  NULL UNIQUE
);

CREATE TABLE dbo.Carreras (
    carrera_id     INT          IDENTITY(1,1) PRIMARY KEY,
    clave          VARCHAR(20)  NOT NULL UNIQUE,
    nombre         NVARCHAR(120) NOT NULL,
    activo         BIT          NOT NULL DEFAULT 1,
    creado_en      DATETIME2(0) NOT NULL DEFAULT SYSDATETIME()
);

CREATE TABLE dbo.PerfilesAlumnos (
    usuario_id  INT          NOT NULL PRIMARY KEY REFERENCES dbo.Usuarios(usuario_id),
    matricula   VARCHAR(20)  NOT NULL UNIQUE,
    semestre    TINYINT      NOT NULL CHECK (semestre BETWEEN 1 AND 12),
    carrera_id  INT          NULL REFERENCES dbo.Carreras(carrera_id)
);

CREATE TABLE dbo.PeriodosEscolares (
    periodo_id     INT          IDENTITY(1,1) PRIMARY KEY,
    clave          VARCHAR(20)  NOT NULL UNIQUE,
    nombre         NVARCHAR(120) NOT NULL,
    fecha_inicio   DATE         NOT NULL,
    fecha_fin      DATE         NOT NULL,
    activo         BIT          NOT NULL DEFAULT 1,
    creado_en      DATETIME2(0) NOT NULL DEFAULT SYSDATETIME()
);

CREATE TABLE dbo.Materias (
    materia_id  INT           IDENTITY(1,1) PRIMARY KEY,
    clave       VARCHAR(20)   NOT NULL UNIQUE,
    nombre      NVARCHAR(120) NOT NULL,
    creditos    TINYINT       NOT NULL DEFAULT 5
);

CREATE TABLE dbo.Grupos (
    grupo_id    INT          IDENTITY(1,1) PRIMARY KEY,
    clave       VARCHAR(10)  NOT NULL UNIQUE,
    semestre    TINYINT      NOT NULL,
    turno       VARCHAR(20)  NOT NULL,
    cupo        TINYINT      NOT NULL DEFAULT 30,
    carrera_id  INT          NULL REFERENCES dbo.Carreras(carrera_id)
);

------------------------------------------------------------
-- Relación Docente-Grupo-Materia
------------------------------------------------------------
CREATE TABLE dbo.AsignacionesDocentes (
    asignacion_id INT IDENTITY(1,1) PRIMARY KEY,
    docente_id    INT NOT NULL REFERENCES dbo.Usuarios(usuario_id),
    materia_id    INT NOT NULL REFERENCES dbo.Materias(materia_id),
    grupo_id      INT NOT NULL REFERENCES dbo.Grupos(grupo_id),
    horario       NVARCHAR(120) NULL,
    periodo_id    INT NULL REFERENCES dbo.PeriodosEscolares(periodo_id),
    CONSTRAINT uq_docente_materia_grupo_periodo UNIQUE (docente_id, materia_id, grupo_id, periodo_id)
);

CREATE TABLE dbo.Inscripciones (
    inscripcion_id INT IDENTITY(1,1) PRIMARY KEY,
    alumno_id      INT NOT NULL REFERENCES dbo.Usuarios(usuario_id),
    asignacion_id  INT NOT NULL REFERENCES dbo.AsignacionesDocentes(asignacion_id),
    estatus        VARCHAR(15) NOT NULL DEFAULT 'activo',
    inscrito_en    DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT uq_alumno_asignacion UNIQUE (alumno_id, asignacion_id)
);

------------------------------------------------------------
-- Asistencias
------------------------------------------------------------
CREATE TABLE dbo.SesionesAsistencia (
    sesion_id      INT IDENTITY(1,1) PRIMARY KEY,
    asignacion_id  INT   NOT NULL REFERENCES dbo.AsignacionesDocentes(asignacion_id),
    fecha          DATE  NOT NULL,
    tema           NVARCHAR(150) NULL,
    creado_por     INT   NOT NULL REFERENCES dbo.Usuarios(usuario_id),
    estado         VARCHAR(20) NOT NULL DEFAULT 'activo',
    actualizado_en DATETIME2(0) NULL,
    actualizado_por INT NULL REFERENCES dbo.Usuarios(usuario_id),
    CONSTRAINT uq_asignacion_fecha UNIQUE (asignacion_id, fecha)
);

CREATE TABLE dbo.RegistrosAsistencia (
    registro_id     BIGINT IDENTITY(1,1) PRIMARY KEY,
    sesion_id       INT       NOT NULL REFERENCES dbo.SesionesAsistencia(sesion_id),
    alumno_id       INT       NOT NULL REFERENCES dbo.Usuarios(usuario_id),
    estatus         VARCHAR(10) NOT NULL CHECK (estatus IN ('asistio','falta','retardo')),
    notas           NVARCHAR(200) NULL,
    marcado_en      DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    justificada     BIT       NOT NULL DEFAULT 0,
    justificacion   NVARCHAR(200) NULL,
    actualizado_en  DATETIME2(0) NULL,
    actualizado_por INT       NULL REFERENCES dbo.Usuarios(usuario_id),
    origen          VARCHAR(20) NOT NULL DEFAULT 'web',
    CONSTRAINT uq_sesion_alumno UNIQUE (sesion_id, alumno_id)
);

CREATE TABLE dbo.TokensAsistencia (
    token_id      UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    asignacion_id INT              NOT NULL REFERENCES dbo.AsignacionesDocentes(asignacion_id),
    sesion_id     INT              NOT NULL REFERENCES dbo.SesionesAsistencia(sesion_id),
    token_hash    VARBINARY(32)    NOT NULL UNIQUE,
    expires_at    DATETIME2(0)     NOT NULL,
    creado_por    INT              NOT NULL REFERENCES dbo.Usuarios(usuario_id),
    creado_en     DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME()
);

CREATE TABLE dbo.ActivityLog (
    log_id        BIGINT IDENTITY(1,1) PRIMARY KEY,
    actor_id      INT NULL REFERENCES dbo.Usuarios(usuario_id),
    actor_role    VARCHAR(20) NULL,
    action_type   VARCHAR(80) NOT NULL,
    entity_type   VARCHAR(40) NOT NULL,
    entity_id     NVARCHAR(80) NULL,
    description   NVARCHAR(250) NOT NULL,
    metadata_json NVARCHAR(MAX) NULL,
    created_at    DATETIME2(0) NOT NULL DEFAULT SYSDATETIME()
);

CREATE NONCLUSTERED INDEX IX_TokensAsistencia_Hash
    ON dbo.TokensAsistencia (token_hash);

------------------------------------------------------------
-- Vista de apoyo para KPIs
------------------------------------------------------------
GO
CREATE OR ALTER VIEW dbo.vwResumenAsistencias
AS
SELECT
    ad.asignacion_id,
    ad.docente_id,
    ad.grupo_id,
    ad.materia_id,
    COUNT(DISTINCT ra.alumno_id) AS total_registros,
    SUM(CASE WHEN ra.estatus = 'asistio' THEN 1 ELSE 0 END) AS total_asistencias,
    SUM(CASE WHEN ra.estatus = 'falta' THEN 1 ELSE 0 END) AS total_faltas,
    SUM(CASE WHEN ra.estatus = 'retardo' THEN 1 ELSE 0 END) AS total_retardos,
    CAST(100.0 * SUM(CASE WHEN ra.estatus = 'asistio' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0) AS DECIMAL(5,2)) AS asistencia_pct
FROM dbo.RegistrosAsistencia ra
JOIN dbo.SesionesAsistencia sa ON ra.sesion_id = sa.sesion_id
JOIN dbo.AsignacionesDocentes ad ON sa.asignacion_id = ad.asignacion_id
GROUP BY ad.asignacion_id, ad.docente_id, ad.grupo_id, ad.materia_id;
GO

------------------------------------------------------------
-- Datos de ejemplo iniciales (Usuario Administrador)
------------------------------------------------------------
DECLARE @pass NVARCHAR(255) = '$2b$10$AEhHCVaOXX2Wlxj37ZR3FO/SLKN7l9UkM54lGSHGazDG3wZdK0.tm';

INSERT INTO dbo.Usuarios (rol_id, nombre_completo, correo, password_hash)
VALUES
    (1, 'Administrador TESCI', 'sistemas@cuautitlan.tecnm.mx', @pass);
GO
