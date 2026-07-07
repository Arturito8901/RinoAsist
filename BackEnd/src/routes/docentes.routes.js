import { Router } from "express";
import {
  createDocente,
  updateDocente,
  deleteDocente,
} from "../controllers/docentes.controller.js";
import { authRequired, roleRequired } from "../middlewares/auth.js";

const router = Router();

// All docente management requires log in and role of admin
router.use(authRequired, roleRequired("admin"));

router.post("/", createDocente);
router.put("/:id", updateDocente);
router.delete("/:id", deleteDocente);

export default router;
