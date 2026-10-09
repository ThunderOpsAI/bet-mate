import { Router, Request, Response } from "express";

const router = Router();
const REQUEST_TIMEOUT_MS = 10000;

async function forwardPost(targetPath: string, req: Request, res: Response) {
  try {
    const mlApi = process.env.ML_API_URL || "http://127.0.0.1:8000";
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

async function forwardGet(targetPath: string, req: Request, res: Response) {
  try {
    const mlApi = process.env.ML_API_URL || "http://127.0.0.1:8000";
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === "string") {
        queryParams.append(key, value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string") queryParams.append(key, item);
        }
      }
    }
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : "";
    const response = await fetch(`${mlApi}${targetPath}${queryString}`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
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
    console.error(`Prediction engine GET ${targetPath} error:`, error?.message || error);
    return res.status(503).json({
      error: "Prediction engine is unavailable",
      details: error?.message || "Service unreachable",
    });
  }
}

// POST /api/recommendations/auto-build -> ${ML_API_URL}/api/recommendations/auto-build
router.post("/auto-build", (req: Request, res: Response) => {
  return forwardPost("/api/recommendations/auto-build", req, res);
});

// POST /api/recommendations/weakest-leg -> ${ML_API_URL}/api/recommendations/weakest-leg
router.post("/weakest-leg", (req: Request, res: Response) => {
  return forwardPost("/api/recommendations/weakest-leg", req, res);
});

// POST /api/recommendations/leg-swaps -> ${ML_API_URL}/api/recommendations/leg-swaps
router.post("/leg-swaps", (req: Request, res: Response) => {
  return forwardPost("/api/recommendations/leg-swaps", req, res);
});

// POST /api/recommendations/kelly-stake -> ${ML_API_URL}/api/recommendations/kelly-stake
router.post("/kelly-stake", (req: Request, res: Response) => {
  return forwardPost("/api/recommendations/kelly-stake", req, res);
});

// GET /api/recommendations/bobs-daily -> ${ML_API_URL}/api/recommendations/bobs-daily
router.get("/bobs-daily", (req: Request, res: Response) => {
  return forwardGet("/api/recommendations/bobs-daily", req, res);
});

// POST /api/recommendations/multi/evaluate -> ${ML_API_URL}/api/sgm/price
router.post("/multi/evaluate", (req: Request, res: Response) => {
  return forwardPost("/api/sgm/price", req, res);
});

export { router as recommendationsRouter };
export default router;
