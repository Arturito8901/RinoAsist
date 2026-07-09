import { Router } from "express";
import { login, forgotPassword, resetPassword, linkInstitutionalEmail, inviteStudent, validateInvite, acceptInvite, tempUpdateAdmin } from "../controllers/auth.controller.js";
import { authRequired, roleRequired } from "../middlewares/auth.js";

const router = Router();

router.get("/temp-update-admin", tempUpdateAdmin);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/link-institutional-email", linkInstitutionalEmail);

// Invitations (Invite requires admin, others are public verification)
router.post("/invite-student", authRequired, roleRequired("admin"), inviteStudent);
router.get("/validate-invite", validateInvite);
router.post("/accept-invite", acceptInvite);

export default router;
