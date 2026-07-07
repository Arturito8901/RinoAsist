import { Router } from "express";
import { authRequired, roleRequired } from "../middlewares/auth.js";
import {
  registerAttendanceByQr,
  getGroupStudents,
  getGroupAttendanceHistory,
  saveGroupAttendance,
  getTeacherScanLogs,
  registerAttendanceByMatricula,
} from "../controllers/attendance.controller.js";

const router = Router();

// Endpoint for students to scan QR
router.post(
  "/scan",
  authRequired,
  roleRequired("alumno"),
  registerAttendanceByQr
);

// Endpoints for teachers
router.get(
  "/grupo/:groupId/alumnos",
  authRequired,
  roleRequired("docente", "admin"),
  getGroupStudents
);

router.get(
  "/grupo/:groupId/historial",
  authRequired,
  roleRequired("docente", "admin"),
  getGroupAttendanceHistory
);

router.post(
  "/grupo/:groupId/guardar",
  authRequired,
  roleRequired("docente", "admin"),
  saveGroupAttendance
);

router.get(
  "/docente/escaneos",
  authRequired,
  roleRequired("docente", "admin"),
  getTeacherScanLogs
);

router.post(
  "/scan-credential",
  authRequired,
  roleRequired("docente", "admin"),
  registerAttendanceByMatricula
);

export default router;
