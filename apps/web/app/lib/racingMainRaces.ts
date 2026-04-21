type RacingMeetingLite = {
  venue: string;
  meeting_type?: string;
  meeting_region?: string;
};

const MAIN_RACE_VENUE_ALIASES = new Set([
  "flemington",
  "caulfield",
  "moonee valley",
  "mvrc",
  "sandown",
  "sandown hillside",
  "sandown lakeside",
  "randwick",
  "royal randwick",
  "randwick kensington",
  "rosehill",
  "rosehill gardens",
  "canterbury",
  "canterbury park",
  "warwick farm",
  "eagle farm",
  "doomben",
  "ascot",
  "ascot wa",
  "belmont",
  "belmont park",
  "belmont wa",
]);

function normalizeVenueName(venue: string) {
  return venue
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isPhase2MainRace(race: RacingMeetingLite) {
  const normalizedVenue = normalizeVenueName(race.venue);

  if (MAIN_RACE_VENUE_ALIASES.has(normalizedVenue)) {
    return true;
  }

  if (race.meeting_type !== "metro") {
    return false;
  }

  return race.meeting_region === "VIC" || race.meeting_region === "NSW";
}
