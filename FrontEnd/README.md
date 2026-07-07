# Manual de Integración y Arquitectura del FrontEnd - RinoAsist

Este documento describe la estructura, flujos de datos, diseño de interfaz y la API del frontend de **RinoAsist** para facilitar su conexión con el desarrollo del BackEnd.

---

## 1. Stack Tecnológico del FrontEnd
* **Base**: [React](https://react.dev/) + [Vite](https://vite.dev/) (Empaquetado ultra rápido en JavaScript moderno).
* **Estilizado (CSS)**: Tailwind CSS (para distribución adaptativa) y Vanilla CSS personalizado (`FrontEnd/src/index.css`) para variables del sistema de diseño (soporte nativo de tema claro/oscuro y transiciones fluidas).
* **Librería de Iconos**: [Lucide React](https://lucide.dev/).
* **Lector QR**: `html5-qrcode` para lectura instantánea de flujos de video de cámaras de celulares.
* **Gráficas**: `recharts` para el monitoreo estadístico del panel de administrador.

---

## 2. Enrutamiento del Sitio (`App.jsx`)
El frontend expone las siguientes rutas en el cliente utilizando `react-router-dom`:
* `/`: **Landing de Bienvenida** (`Welcome.jsx`). Landing institucional con Rino (la mascota interactiva con chatbot de preguntas frecuentes).
* `/login`: **Formulario de Acceso** (`Login.jsx`). Tarjeta de autenticación con control de mayúsculas (Caps Lock), recordar correo y modal de recuperación.
* `/scan`: **Escáner QR del Alumno** (`ScanAttendance.jsx`). Interfaz móvil para capturar el QR escolar del pizarrón de clases.
* `/dashboard`: **Panel de Control Unificado** (`Dashboard.jsx`). Punto de entrada para los tres roles del sistema (Admin, Docente, Alumno) según el rol persistido en la sesión del usuario.

---

## 3. Estructura de Componentes y Pestañas

### A. Vista del Alumno (Student View)
1. **Resumen (`resumen`)**: Tarjetas de promedio general y listado de clases faltadas o alertadas.
2. **Mi Agenda Escolar (`horario`)** (`StudentScheduleTab.jsx`): Horario de lunes a viernes. Detecta el día y la hora real; si coincide, resalta la materia como `"● En Curso"` y muestra un botón directo para escanear asistencia en `/scan`.
3. **Justificantes (`justificantes`)** (`StudentJustificantesTab.jsx`):
   * Formulario con **Drag & Drop** para adjuntar archivos oficiales (recetas/oficios). Si es una imagen, despliega una vista previa base64.
   * Tabla de justificantes y aclaraciones de inasistencias por fallas de lector QR.
4. **Calculadora (`calculadora`)** (`StudentCalculatorTab.jsx`): Herramienta de simulación con un **anillo radial SVG** que recalcula el promedio final según las inasistencias futuras proyectadas. Parpadea en rojo si baja del 80% mínimo reglamentario.

### B. Vista del Docente (Teacher View)
1. **Pase de Lista (`pase_lista`)**: Listado de alumnos inscritos en la materia para pases manuales en fechas seleccionadas.
2. **Escaneos QR (`escaneos`)** (`TeacherDashboardView.jsx`): Bitácora de auditoría en tiempo real agrupada por acordeones interactivos de cada materia para verificar marcas de asistencia.
3. **Generador QR (Modal)** (`TeacherDashboardView.jsx`): Proyecta el QR escolar dinámico en el pizarrón. Cuenta con un **temporizador circular SVG de 30s** sincronizado con la expiración del token de seguridad.

### C. Vista del Administrador (Admin View)
1. **Resumen (`resumen`)**: KPIs consolidados de la escuela y gráficas de área diarias consolidadas por semestre (1º a 8º).
2. **Deserción (`desersion`)** (`DesersionTab.jsx`): Lista de alumnos en riesgo menor al 80% con bitácoras editables y descarga de PDF institucionales de tutorías y plantillas grupales en Excel.

---

## 4. Estructura de la API e Integración de Red (`api.js`)
Las peticiones del frontend están centralizadas en [api.js](file:///c:/Users/Admin/Documents/Escuela/asistencias-frontend/FrontEnd/src/services/api.js). A continuación, se detallan los endpoints requeridos por el frontend:

### A. Autenticación
* **`POST /api/auth/login`**
  * *Payload*: `{ email, password }`
  * *Respuesta exitosa*: `{ token, user: { id, name, email, rol } }`
  * *Efecto*: Guarda el token y el perfil en `localStorage` (`token`, `user`).
* **`POST /api/auth/forgot-password`**
  * *Payload*: `{ email }`
* **`POST /api/auth/reset-password`**
  * *Payload*: `{ token, password }`

### B. Control de Asistencias (Docente)
* **`GET /api/attendance/grupo/:groupId/alumnos`**
  * *Respuesta*: Listado de alumnos reales inscritos en el grupo, con cálculo de su porcentaje de asistencia real en base al historial del semestre.
* **`GET /api/attendance/grupo/:groupId/historial?fecha=YYYY-MM-DD`**
  * *Respuesta*: Historial de clases calendarizadas y el estado individual de cada alumno en esa fecha (asistió, falta, retardo, justificado).
* **`POST /api/attendance/grupo/:groupId/guardar`**
  * *Payload*: `{ fecha, asistencias: [ { alumnoId, status, notas } ] }`
  * *Notas*: Estatus `'J'` (Justificado) se envía como `'falta'` en base de datos con nota `'Justificado'` para no romper restricciones CHECK de SQL.
* **`GET /api/attendance/docente/escaneos`**
  * *Respuesta*: Bitácora de escaneos QR recientes para auditar alumnos por grupo.

### C. Registro QR (Alumno)
* **`POST /api/attendance/scan`**
  * *Payload*: `{ token: "qr-string", simulatedMinutes: number }`
  * *Detalle*: El backend debe validar que el alumno no duplique su marcaje en la misma sesión y evaluar retardos/faltas según la tolerancia (ej. `simulatedMinutes < 10` = Asistió, `10-20` = Retardo, `>20` = Falta/Excedido).

---

## 5. Manejo de Sesión Local
Durante la fase de integración o pruebas locales, el frontend utiliza `localStorage` para simular bases de datos cuando el backend no responde:
* `approved_justifications`: Guarda las solicitudes de justificantes aprobadas o pendientes.
* `attendance_claims`: Almacena reportes de omisiones o aclaraciones de asistencia QR.
* `remember_email`: Almacena el correo electrónico de acceso si la casilla de "Recordarme" estuvo activa.
