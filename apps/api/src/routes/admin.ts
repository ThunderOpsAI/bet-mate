import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import type { AuthRequest } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

router.post("/rule-request", async (req: AuthRequest, res) => {
  const { requestedCondition, notes } = req.body;
  if (!requestedCondition) {
    return res.status(400).json({ success: false, error: "Missing requestedCondition" });
  }

  console.log(`[Admin] Rule Request from user ${req.userId}:`, { requestedCondition, notes });

  return res.json({ success: true, message: "Request received" });
});

export default router;
