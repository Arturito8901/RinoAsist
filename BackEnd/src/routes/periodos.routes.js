import { Router } from "express";
import {
  getPeriodos,
  getActivePeriodo,
  createPeriodo,
  activatePeriodo,
  setActivePeriodoByClave
} from "../controllers/periodos.controller.js";
import { authRequired, roleRequired } from "../middlewares/auth.js";

const router = Router();

// Public / Authenticated route to get the active cycle
router.get("/active", getActivePeriodo);

// Admin-only routes to manage school cycles
router.get("/", authRequired, roleRequired("admin"), getPeriodos);
router.post("/", authRequired, roleRequired("admin"), createPeriodo);
router.post("/set-active", authRequired, roleRequired("admin"), setActivePeriodoByClave);
router.put("/:id/activate", authRequired, roleRequired("admin"), activatePeriodo);

export default router;
