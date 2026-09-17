import { EventEmitter } from "node:events";

export interface PriceFluc {
  timestamp: number;
  odds: number;
}

export type MoverDirection = "shortening" | "lengthening" | "steady";

export interface RunnerFlucData {
  runnerId: string;
  runnerName: string;
  openingOdds: number;
  currentOdds: number;
  previousOdds?: number;
  flucs: PriceFluc[];
  moverDirection: MoverDirection;
  percentageChange: number; // e.g. -20.0 for 20% price drop (shortening)
  pointsChange: number;     // e.g. -1.00 for $5.00 -> $4.00
  moverScore: number;       // Score indicating market mover strength (higher = bigger move in)
  lastUpdated: number;
  historyString: string;    // e.g. "$5.00 -> $4.50 -> $4.00"
}

export interface RaceFlucSnapshot {
  raceId: string;
  runners: Record<string, RunnerFlucData>;
  lastUpdated: number;
}

export interface FlucUpdateEvent {
  raceId: string;
  runnerId: string;
  runnerName: string;
  oldOdds: number;
  newOdds: number;
  timestamp: number;
  direction: MoverDirection;
  percentageChange: number;
  historyString: string;
}

export class RealtimeFlucsService extends EventEmitter {
  private raceSnapshots: Map<string, RaceFlucSnapshot> = new Map();

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Formats a list of odds into a history string (e.g., "$4.50 -> $3.80 -> $3.20")
   */
  public formatHistoryString(flucs: PriceFluc[] | number[], limit: number = 4): string {
    const oddsList = flucs.map((f) => (typeof f === "number" ? f : f.odds));
    const recentOdds = oddsList.slice(-limit);
    if (recentOdds.length === 0) return "";
    return recentOdds.map((o) => `$${o.toFixed(2)}`).join(" -> ");
  }

  /**
   * Calculates movement metrics for a runner
   */
  public calculateMoverMetrics(openingOdds: number, currentOdds: number, previousOdds?: number) {
    const pointsChange = Number((currentOdds - openingOdds).toFixed(2));
    const percentageChange = openingOdds > 0 
      ? Number((((currentOdds - openingOdds) / openingOdds) * 100).toFixed(1))
      : 0;

    let moverDirection: MoverDirection = "steady";
    const refOdds = previousOdds ?? openingOdds;
    if (currentOdds < refOdds) {
      moverDirection = "shortening";
    } else if (currentOdds > refOdds) {
      moverDirection = "lengthening";
    }

    // Mover score prioritizes significant percentage shortening on shorter odds
    // Shortening (negative percentageChange) results in a positive moverScore
    const shorteningPercent = percentageChange < 0 ? Math.abs(percentageChange) : 0;
    const priceWeight = currentOdds < 5 ? 1.5 : currentOdds < 10 ? 1.2 : 1.0;
    const moverScore = Number((shorteningPercent * priceWeight).toFixed(2));

    return {
      pointsChange,
      percentageChange,
      moverDirection,
      moverScore,
    };
  }

  /**
   * Initializes or gets the snapshot for a race
   */
  public getRaceSnapshot(raceId: string): RaceFlucSnapshot {
    let snapshot = this.raceSnapshots.get(raceId);
    if (!snapshot) {
      snapshot = {
        raceId,
        runners: {},
        lastUpdated: Date.now(),
      };
      this.raceSnapshots.set(raceId, snapshot);
    }
    return snapshot;
  }

  /**
   * Records a new price fluc for a runner and emits update event if odds changed
   */
  public recordFluc(
    raceId: string,
    runnerId: string,
    newOdds: number,
    runnerName: string = `Runner ${runnerId}`
  ): FlucUpdateEvent | null {
    if (newOdds <= 1.0) return null;

    const snapshot = this.getRaceSnapshot(raceId);
    const existing = snapshot.runners[runnerId];

    const timestamp = Date.now();
    const roundedNewOdds = Number(newOdds.toFixed(2));

    if (!existing) {
      const metrics = this.calculateMoverMetrics(roundedNewOdds, roundedNewOdds);
      const flucs: PriceFluc[] = [{ timestamp, odds: roundedNewOdds }];
      const historyString = this.formatHistoryString(flucs);

      const runnerData: RunnerFlucData = {
        runnerId,
        runnerName,
        openingOdds: roundedNewOdds,
        currentOdds: roundedNewOdds,
        flucs,
        moverDirection: metrics.moverDirection,
        percentageChange: metrics.percentageChange,
        pointsChange: metrics.pointsChange,
        moverScore: metrics.moverScore,
        lastUpdated: timestamp,
        historyString,
      };

      snapshot.runners[runnerId] = runnerData;
      snapshot.lastUpdated = timestamp;
      return null;
    }

    // Skip if odds haven't changed
    if (existing.currentOdds === roundedNewOdds) {
      return null;
    }

    const oldOdds = existing.currentOdds;
    const updatedFlucs = [...existing.flucs, { timestamp, odds: roundedNewOdds }];
    const metrics = this.calculateMoverMetrics(existing.openingOdds, roundedNewOdds, oldOdds);
    const historyString = this.formatHistoryString(updatedFlucs);

    const updatedRunnerData: RunnerFlucData = {
      ...existing,
      previousOdds: oldOdds,
      currentOdds: roundedNewOdds,
      flucs: updatedFlucs,
      moverDirection: metrics.moverDirection,
      percentageChange: metrics.percentageChange,
      pointsChange: metrics.pointsChange,
      moverScore: metrics.moverScore,
      lastUpdated: timestamp,
      historyString,
    };

    snapshot.runners[runnerId] = updatedRunnerData;
    snapshot.lastUpdated = timestamp;

    const event: FlucUpdateEvent = {
      raceId,
      runnerId,
      runnerName,
      oldOdds,
      newOdds: roundedNewOdds,
      timestamp,
      direction: metrics.moverDirection,
      percentageChange: metrics.percentageChange,
      historyString,
    };

    this.emit("fluc", event);
    this.emit(`race:${raceId}`, event);

    return event;
  }

  /**
   * Retrieves top market movers for a specific race or globally
   */
  public getMarketMovers(raceId?: string, limit: number = 10): RunnerFlucData[] {
    const allRunners: RunnerFlucData[] = [];

    if (raceId) {
      const snapshot = this.raceSnapshots.get(raceId);
      if (snapshot) {
        allRunners.push(...Object.values(snapshot.runners));
      }
    } else {
      for (const snapshot of this.raceSnapshots.values()) {
        allRunners.push(...Object.values(snapshot.runners));
      }
    }

    return allRunners
      .filter((r) => r.moverDirection === "shortening" || r.percentageChange < 0)
      .sort((a, b) => b.moverScore - a.moverScore)
      .slice(0, limit);
  }

  /**
   * Express middleware / route handler for Server-Sent Events (SSE) stream fallback
   */
  public handleSSEStream(req: any, res: any, raceId: string): void {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    if (res.flushHeaders) res.flushHeaders();

    // Send initial snapshot
    const snapshot = this.getRaceSnapshot(raceId);
    res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);

    const listener = (event: FlucUpdateEvent) => {
      res.write(`event: fluc\ndata: ${JSON.stringify(event)}\n\n`);
    };

    this.on(`race:${raceId}`, listener);

    req.on("close", () => {
      this.off(`race:${raceId}`, listener);
    });
  }

  /**
   * Express handler for HTTP polling stream fallback
   */
  public handlePollingResponse(req: any, res: any, raceId: string): void {
    const snapshot = this.getRaceSnapshot(raceId);
    const movers = this.getMarketMovers(raceId);
    res.json({
      raceId,
      snapshot,
      marketMovers: movers,
      timestamp: Date.now(),
    });
  }

  /**
   * Helper to simulate fluc ticks for demo or testing purposes
   */
  public simulateTick(raceId: string, runnerId?: string): FlucUpdateEvent | null {
    const snapshot = this.getRaceSnapshot(raceId);
    const runnerIds = Object.keys(snapshot.runners);
    if (runnerIds.length === 0) return null;

    const targetId = runnerId || runnerIds[Math.floor(Math.random() * runnerIds.length)];
    const runner = snapshot.runners[targetId];
    if (!runner) return null;

    // Simulate price fluctuation (-5% to +5%)
    const delta = (Math.random() - 0.5) * 0.1 * runner.currentOdds;
    let newOdds = Number((runner.currentOdds + delta).toFixed(2));
    if (newOdds < 1.1) newOdds = 1.1;

    return this.recordFluc(raceId, targetId, newOdds, runner.runnerName);
  }
}

export const realtimeFlucsService = new RealtimeFlucsService();

/**
 * Utility function to sort an array of runners by Market Mover strength
 */
export function sortRunnersByMarketMovers<T>(
  runners: T[],
  getRunnerId: (runner: T) => string,
  flucMap: Record<string, RunnerFlucData>
): T[] {
  return [...runners].sort((a, b) => {
    const idA = getRunnerId(a);
    const idB = getRunnerId(b);
    const flucA = flucMap[idA];
    const flucB = flucMap[idB];

    const scoreA = flucA ? flucA.moverScore : 0;
    const scoreB = flucB ? flucB.moverScore : 0;

    return scoreB - scoreA;
  });
}
