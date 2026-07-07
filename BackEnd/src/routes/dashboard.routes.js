import { Router } from "express";
import {
  getAdminSummary,
  getAdminPredictions,
  getTeacherOverview,
  getStudentSummary,
} from "../controllers/dashboard.controller.js";
import { authRequired, roleRequired } from "../middlewares/auth.js";
import { generateQrToken } from "../controllers/attendance.controller.js";

const router = Router();

router.get(
  "/admin/summary",
  authRequired,
  roleRequired("admin"),
  getAdminSummary
);

router.get(
  "/admin/predictions",
  authRequired,
  roleRequired("admin"),
  getAdminPredictions
);

router.get(
  "/docente/overview",
  authRequired,
  roleRequired("docente", "admin"),
  getTeacherOverview
);

router.post(
  "/docente/qr",
  authRequired,
  roleRequired("docente", "admin"),
  generateQrToken
);

router.get(
  "/alumno/summary",
  authRequired,
  roleRequired("alumno"),
  getStudentSummary
);

export default router;
