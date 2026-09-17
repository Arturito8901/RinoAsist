import { Router } from "express";
import multer from "multer";
import {
  createAssignment,
  getAssignmentOptions,
  deleteAssignment,
  deleteMyAssignment,
  updateAssignment,
  importAssignments,
  getIntersemestralClasses,
  getIntersemestralStudents,
  enrollStudentIntersemestral,
  deregisterStudentIntersemestral,
  updateIntersemestralCupo,
  clearActivePeriodAssignments,
  createGroup,
  getAllGroups,
  deleteGroup,
  getGroupStudents,
  removeStudentFromGroup,
} from "../controllers/assignments.controller.js";
import { authRequired, roleRequired } from "../middlewares/auth.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get(
  "/options",
  authRequired,
  roleRequired("admin"),
  getAssignmentOptions
);

// Intersemestral management routes
router.get("/intersemestral", authRequired, roleRequired("admin"), getIntersemestralClasses);
router.get("/intersemestral/:id/alumnos", authRequired, roleRequired("admin"), getIntersemestralStudents);
router.post("/intersemestral/enroll", authRequired, roleRequired("admin"), enrollStudentIntersemestral);
router.delete("/intersemestral/enroll", authRequired, roleRequired("admin"), deregisterStudentIntersemestral);
router.put("/intersemestral/:id/cupo", authRequired, roleRequired("admin"), updateIntersemestralCupo);
router.delete("/intersemestral/clear", authRequired, roleRequired("admin"), clearActivePeriodAssignments);

// Groups management routes
router.get("/groups", authRequired, roleRequired("admin"), getAllGroups);
router.post("/groups", authRequired, roleRequired("admin"), createGroup);
router.delete("/groups/:id", authRequired, roleRequired("admin"), deleteGroup);
router.get("/groups/:id/students", authRequired, roleRequired("admin"), getGroupStudents);
router.delete("/groups/:id/students/:studentId", authRequired, roleRequired("admin"), removeStudentFromGroup);

router.post("/", authRequired, roleRequired("admin"), createAssignment);
router.post("/import", authRequired, roleRequired("admin"), upload.single("file"), importAssignments);
router.put("/:id", authRequired, roleRequired("admin"), updateAssignment);
router.delete("/my-assignments/:id", authRequired, roleRequired("docente"), deleteMyAssignment);
router.delete("/:id", authRequired, roleRequired("admin"), deleteAssignment);

export default router;
