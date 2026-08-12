export type Track = {
  id: string; // normalized key e.g. "flemington"
  name: string; // "Flemington"
  state: string; // "VIC" or "NZ"
  country: 'AU' | 'NZ';
  type: 'thoroughbred' | 'greyhound' | 'harness' | 'mixed';
  metro: boolean;
  aliases: string[];
};

export const TRACKS: Track[] = [
  // AU Metro Thoroughbred
  { id: 'flemington', name: 'Flemington', state: 'VIC', country: 'AU', type: 'thoroughbred', metro: true, aliases: ['flem'] },
  { id: 'randwick', name: 'Randwick', state: 'NSW', country: 'AU', type: 'thoroughbred', metro: true, aliases: ['rand'] },
  { id: 'rosehill', name: 'Rosehill', state: 'NSW', country: 'AU', type: 'thoroughbred', metro: true, aliases: ['rose'] },
  { id: 'caulfield', name: 'Caulfield', state: 'VIC', country: 'AU', type: 'thoroughbred', metro: true, aliases: ['caul'] },
  { id: 'moonee-valley', name: 'Moonee Valley', state: 'VIC', country: 'AU', type: 'thoroughbred', metro: true, aliases: ['the valley', 'mv'] },
  { id: 'eagle-farm', name: 'Eagle Farm', state: 'QLD', country: 'AU', type: 'thoroughbred', metro: true, aliases: ['ef'] },
  { id: 'doomben', name: 'Doomben', state: 'QLD', country: 'AU', type: 'thoroughbred', metro: true, aliases: ['doom'] },
  { id: 'morphettville', name: 'Morphettville', state: 'SA', country: 'AU', type: 'thoroughbred', metro: true, aliases: ['morph'] },
  { id: 'ascot', name: 'Ascot', state: 'WA', country: 'AU', type: 'thoroughbred', metro: true, aliases: [] },
  { id: 'sandown', name: 'Sandown', state: 'VIC', country: 'AU', type: 'thoroughbred', metro: true, aliases: ['sandown hillside', 'sandown lakeside'] },
  { id: 'canterbury', name: 'Canterbury', state: 'NSW', country: 'AU', type: 'thoroughbred', metro: true, aliases: ['cant'] },
  { id: 'gosford', name: 'Gosford', state: 'NSW', country: 'AU', type: 'thoroughbred', metro: false, aliases: ['gos'] },
  { id: 'hawkesbury', name: 'Hawkesbury', state: 'NSW', country: 'AU', type: 'thoroughbred', metro: false, aliases: ['hawk'] },

  // NZ Thoroughbred & Harness
  { id: 'ellerslie', name: 'Ellerslie', state: 'NZ', country: 'NZ', type: 'thoroughbred', metro: true, aliases: [] },
  { id: 'te-rapa', name: 'Te Rapa', state: 'NZ', country: 'NZ', type: 'thoroughbred', metro: true, aliases: [] },
  { id: 'trentham', name: 'Trentham', state: 'NZ', country: 'NZ', type: 'thoroughbred', metro: true, aliases: [] },
  { id: 'riccarton', name: 'Riccarton', state: 'NZ', country: 'NZ', type: 'thoroughbred', metro: true, aliases: ['riccarton park'] },
  { id: 'hastings', name: 'Hastings', state: 'NZ', country: 'NZ', type: 'thoroughbred', metro: false, aliases: [] },
  { id: 'awapuni', name: 'Awapuni', state: 'NZ', country: 'NZ', type: 'thoroughbred', metro: false, aliases: [] },
  { id: 'cambridge', name: 'Cambridge', state: 'NZ', country: 'NZ', type: 'thoroughbred', metro: false, aliases: [] }, // Or mixed/harness depending on specific track, assuming thoroughbred for list
  { id: 'ruakaka', name: 'Ruakaka', state: 'NZ', country: 'NZ', type: 'thoroughbred', metro: false, aliases: [] },
  { id: 'wingatui', name: 'Wingatui', state: 'NZ', country: 'NZ', type: 'thoroughbred', metro: false, aliases: [] },
  { id: 'alexandra-park', name: 'Alexandra Park', state: 'NZ', country: 'NZ', type: 'harness', metro: true, aliases: ['alex park'] },
  { id: 'addington', name: 'Addington', state: 'NZ', country: 'NZ', type: 'harness', metro: true, aliases: [] },
];

export function searchTracks(q: string): Track[] {
  if (!q || q.trim().length < 2) return [];
  const lower = q.toLowerCase().trim();
  return TRACKS.filter(t =>
    t.name.toLowerCase().includes(lower) ||
    t.aliases.some(a => a.toLowerCase().includes(lower))
  ).slice(0, 10);
}
