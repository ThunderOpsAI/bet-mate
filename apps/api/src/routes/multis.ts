import { Router, Request, Response } from "express";
import { getMlApiUrl } from "../services/mlApi";

const router = Router();
const REQUEST_TIMEOUT_MS = 30000;

async function forwardPost(targetPath: string, req: Request, res: Response) {
  try {
    const mlApi = getMlApiUrl();
    const response = await fetch(`${mlApi}${targetPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body ?? {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const contentType = response.headers.get("content-type") || "";
    let data: any;
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { message: text };
    }

    return res.status(response.status).json(data);
  } catch (error: any) {
    console.error(`Prediction engine POST ${targetPath} error:`, error?.message || error);
    return res.status(503).json({
      error: "Prediction engine is unavailable",
      details: error?.message || "Service unreachable",
    });
  }
}

/**
 * POST /api/multis/recommend
 * Body: { win_legs, place_legs, sport_mode, min_odds, max_odds, after_time, current_legs }
 * Returns: { multis: [...], booster_legs: [...] }
 */
router.post("/recommend", (req: Request, res: Response) => {
  return forwardPost("/api/multis/recommend", req, res);
});

export default router;
