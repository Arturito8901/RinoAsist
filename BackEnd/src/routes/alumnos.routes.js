import { Router } from "express";
import { 
  getAlumnosOverview,
  requestDropCourse,
  getStudentDropRequests,
  adminGetDropRequests,
  adminApproveDropRequest,
  adminRejectDropRequest,
  deleteAlumno,
  deleteInvitation,
  updateAlumno
} from "../controllers/alumnos.controller.js";
import { authRequired, roleRequired } from "../middlewares/auth.js";

const router = Router();

// Admin routes
router.get("/", authRequired, roleRequired("admin"), getAlumnosOverview);
router.get("/drop-requests", authRequired, roleRequired("admin"), adminGetDropRequests);
router.post("/drop-requests/:id/approve", authRequired, roleRequired("admin"), adminApproveDropRequest);
router.post("/drop-requests/:id/reject", authRequired, roleRequired("admin"), adminRejectDropRequest);
router.delete("/:id", authRequired, roleRequired("admin"), deleteAlumno);
router.delete("/invitations/:id", authRequired, roleRequired("admin"), deleteInvitation);
router.put("/:id", authRequired, roleRequired("admin"), updateAlumno);

// Student routes
router.post("/my-courses/:asignacionId/request-drop", authRequired, roleRequired("alumno"), requestDropCourse);
router.get("/my-courses/drop-requests", authRequired, roleRequired("alumno"), getStudentDropRequests);

export default router;
