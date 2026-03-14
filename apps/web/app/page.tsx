type RacePick = {
  horseName: string;
  winProbability: number;
  confidence: string;
};

type Race = {
  id: string;
  raceNumber: number;
  postTime: string;
  distance: number;
  topPicks: RacePick[];
};

type Meeting = {
  venueName: string;
  raceDate: string;
  races: Race[];
};

type RaceResponse = {
  meetings: Meeting[];
  source: "database" | "fallback";
};

async function getRaces(): Promise<RaceResponse> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
  const response = await fetch(`${base}/races/today`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }
  return response.json();
}

export default async function HomePage() {
  const data = await getRaces();

  return (
    <main>
      <h1>BetMate MVP Dashboard</h1>
      <p className="subtitle">
        Racing-first view with live data from <code>GET /api/races/today</code>
      </p>
      <p className="muted">
        Source: <span className="pill">{data.source}</span>
      </p>

      <div className="grid">
        {data.meetings.map((meeting) => (
          <section className="card" key={`${meeting.venueName}-${meeting.raceDate}`}>
            <h2>
              {meeting.venueName} ({meeting.raceDate})
            </h2>
            {meeting.races.map((race) => (
              <article key={race.id} className="card">
                <strong>Race {race.raceNumber}</strong>
                <div className="muted">
                  {new Date(race.postTime).toLocaleTimeString()} | {race.distance}m
                </div>
                <ol className="pick-list">
                  {race.topPicks.map((pick) => (
                    <li key={`${race.id}-${pick.horseName}`}>
                      {pick.horseName} - {(pick.winProbability * 100).toFixed(1)}% ({pick.confidence})
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
