# Backend (Node + SQL Server)

Este directorio contiene la base para el backend que consumirá la app de Asistencias.

## Requerimientos

- Node.js >= 20
- SQL Server 2019+
- Variables de entorno (`.env`):

```ini
PORT=4000
SQL_SERVER=localhost
SQL_DATABASE=AsistenciasDB
SQL_USER=sa
SQL_PASSWORD=TuPasswordSeguro123
SQL_ENCRYPT=true
JWT_SECRET=super-secret
TOKEN_TTL_HOURS=8
```

## Dependencias sugeridas

```bash
npm install express morgan cors jsonwebtoken bcryptjs mssql dotenv
npm install -D nodemon
```

## Estructura propuesta

```
backend/
├─ sql/
│  ├─ schema.sql               # creación de BD/tablas + datos base
│  └─ dashboard_queries.sql    # consultas que alimentan las vistas
├─ src/
│  ├─ app.js                   # instancia de Express
│  ├─ server.js                # arranque del servidor
│  ├─ config/
│  │  └─ db.js                 # pool de SQL Server (mssql)
│  ├─ middlewares/
│  │  └─ auth.js               # valida JWT / roles
│  ├─ routes/
│  │  ├─ auth.routes.js
│  │  ├─ dashboard.routes.js   # admin
│  │  ├─ teacher.routes.js
│  │  └─ student.routes.js
│  └─ controllers/
│     ├─ auth.controller.js
│     ├─ dashboard.controller.js
│     ├─ teacher.controller.js
│     └─ student.controller.js
└─ package.json
```

## Patrón de conexión (config/db.js)

```js
import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

const pool = new sql.ConnectionPool({
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  options: { encrypt: process.env.SQL_ENCRYPT === "true" },
});

export const getPool = async () => {
  if (!pool.connected) await pool.connect();
  return pool;
};
```

## Endpoints clave

| Método | Ruta | Descripción | Tablas/Query |
|--------|------|-------------|--------------|
| POST | `/api/auth/login` | Consulta `Usuarios` por correo y genera JWT. | `dashboard_queries.sql` (login) |
| GET | `/api/dashboard/admin/summary` | KPIs, gráfica global y filtros. | `vwResumenAsistencias` + queries admin |
| GET | `/api/dashboard/docente/groups` | Materias/grupos del docente logueado. | `AsignacionesDocentes`, `Inscripciones` |
| GET | `/api/dashboard/docente/attendance/:id` | Lista sesiones + registros para CRUD. | `SesionesAsistencia`, `RegistrosAsistencia` |
| POST | `/api/dashboard/docente/attendance` | Crear sesión y registros (bulk insert). | Tablas de asistencia |
| GET | `/api/dashboard/alumno/summary` | Materias inscritas + gráfica personal. | `Inscripciones` + queries alumno |

## Flujo sugerido

1. Ejecutar `sql/schema.sql` en SQL Server (crea BD y data demo).
2. Probar consultas con `sql/dashboard_queries.sql`.
3. Configurar `src/config/db.js` y la app de Express.
4. Implementar controladores usando `mssql` y las consultas parametrizadas.
5. Conectar desde React (fetch/axios) enviando el JWT en `Authorization`.

## Seguridad

- Guardar `password_hash` con `bcrypt`.
- En APIs docentes/admin validar `req.user.rol`.
- Para registrar asistencias usar transacciones (`new sql.Transaction(pool)`).

## Siguientes pasos

- Exponer endpoints para catálogos (materias, grupos) si se necesita mantenimiento desde la UI.
- Agregar jobs (SQL Agent o cron en Node) para métricas históricas si la BD crece.
- Añadir pruebas (Jest/Supertest) para los controladores críticos.
