import { Router } from "express";
import {
  createAssignment,
  getAssignmentOptions,
  deleteAssignment,
  deleteMyAssignment,
  updateAssignment,
} from "../controllers/assignments.controller.js";
import { authRequired, roleRequired } from "../middlewares/auth.js";

const router = Router();

router.get(
  "/options",
  authRequired,
  roleRequired("admin"),
  getAssignmentOptions
);

router.post("/", authRequired, roleRequired("admin"), createAssignment);
router.put("/:id", authRequired, roleRequired("admin"), updateAssignment);
router.delete("/my-assignments/:id", authRequired, roleRequired("docente"), deleteMyAssignment);
router.delete("/:id", authRequired, roleRequired("admin"), deleteAssignment);

export default router;
