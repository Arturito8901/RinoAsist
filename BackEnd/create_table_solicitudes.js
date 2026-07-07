import { runQuery } from "./src/config/db.js";

async function run() {
  try {
    console.log("Checking if dbo.SolicitudesBaja table exists...");
    
    const createTableQuery = `
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SolicitudesBaja' AND schema_id = SCHEMA_ID('dbo'))
      BEGIN
        CREATE TABLE dbo.SolicitudesBaja (
            solicitud_id   INT IDENTITY(1,1) PRIMARY KEY,
            alumno_id      INT NOT NULL REFERENCES dbo.Usuarios(usuario_id),
            asignacion_id  INT NOT NULL REFERENCES dbo.AsignacionesDocentes(asignacion_id),
            motivo         NVARCHAR(250) NULL,
            estatus        VARCHAR(15) NOT NULL DEFAULT 'pendiente', -- 'pendiente', 'aprobada', 'rechazada'
            creado_en      DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
            procesado_en   DATETIME2(0) NULL
        );
        PRINT 'Table dbo.SolicitudesBaja created successfully.';
      END
      ELSE
      BEGIN
        PRINT 'Table dbo.SolicitudesBaja already exists.';
      END
    `;

    await runQuery(createTableQuery);
    console.log("Database migration ran successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

run();
