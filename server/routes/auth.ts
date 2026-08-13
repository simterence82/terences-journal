import { Router } from "express";
import { z } from "zod";
import { firebaseAuth } from "../firebase";
import { requireAuth } from "../auth/middleware";

const router = Router();

// First-run setup checks whether ANY Firebase user exists yet. Login and
// logout are handled entirely client-side by the Firebase Auth SDK -- the
// backend only needs to (a) tell the frontend whether setup is needed, (b)
// perform the privileged first-admin creation (setting a custom claim
// requires the Admin SDK), and (c) verify tokens on protected routes.
router.get("/setup-status", async (_req, res) => {
  try {
    const result = await firebaseAuth.listUsers(1);
    res.json({ hasUsers: result.users.length > 0 });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to check setup status" });
  }
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
});

router.post("/register", async (req, res) => {
  try {
    const existing = await firebaseAuth.listUsers(1);
    if (existing.users.length > 0) {
      res.status(403).json({ error: "Setup already complete. Ask an admin to create your account." });
      return;
    }

    const input = registerSchema.parse(req.body);

    const userRecord = await firebaseAuth.createUser({
      email: input.email.toLowerCase(),
      password: input.password,
      displayName: input.displayName,
    });

    await firebaseAuth.setCustomUserClaims(userRecord.uid, { role: "admin" });

    // Mint a custom token so the frontend can sign the new admin in
    // immediately, without asking them to re-enter their password.
    const customToken = await firebaseAuth.createCustomToken(userRecord.uid);

    res.json({
      customToken,
      user: {
        id: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        role: "admin" as const,
      },
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Registration failed" });
  }
});

router.get("/session", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
