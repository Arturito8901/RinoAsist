import { Router } from "express";
import {
  getMaterias,
  createMateria,
  updateMateria,
  deleteMateria,
  reactivateMateria
} from "../controllers/materias.controller.js";
import { authRequired, roleRequired } from "../middlewares/auth.js";

const router = Router();

router.get("/", authRequired, roleRequired("admin"), getMaterias);
router.post("/", authRequired, roleRequired("admin"), createMateria);
router.put("/:id", authRequired, roleRequired("admin"), updateMateria);
router.delete("/:id", authRequired, roleRequired("admin"), deleteMateria);
router.patch("/:id/reactivar", authRequired, roleRequired("admin"), reactivateMateria);

export default router;
