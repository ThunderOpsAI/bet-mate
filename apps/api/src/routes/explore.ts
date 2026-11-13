import { Router } from "express";
import { getMlApiUrl } from "../services/mlApi";

const router = Router();

router.get("/hot-picks", async (req, res) => {
  try {
    const mlApi = getMlApiUrl();
    const response = await fetch(`${mlApi}/explore/hot-picks`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`ML API returned ${response.status}`);
    const data = await response.json();
    return res.json(data);
  } catch (error: any) {
    console.error("Failed to fetch explore hot-picks:", error);
    return res.status(503).json([]);
  }
});

router.get("/value-plays", async (req, res) => {
  try {
    const mlApi = getMlApiUrl();
    const response = await fetch(`${mlApi}/explore/value-plays`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`ML API returned ${response.status}`);
    const data = await response.json();
    return res.json(data);
  } catch (error: any) {
    console.error("Failed to fetch explore value-plays:", error);
    return res.status(503).json([]);
  }
});

router.get("/top-jockeys", async (req, res) => {
  try {
    const mlApi = getMlApiUrl();
    const response = await fetch(`${mlApi}/explore/top-jockeys`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`ML API returned ${response.status}`);
    const data = await response.json();
    return res.json(data);
  } catch (error: any) {
    console.error("Failed to fetch explore top-jockeys:", error);
    return res.status(503).json([]);
  }
});

router.get("/top-trainers", async (req, res) => {
  try {
    const mlApi = getMlApiUrl();
    const response = await fetch(`${mlApi}/explore/top-trainers`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`ML API returned ${response.status}`);
    const data = await response.json();
    return res.json(data);
  } catch (error: any) {
    console.error("Failed to fetch explore top-trainers:", error);
    return res.status(503).json([]);
  }
});

export default router;
