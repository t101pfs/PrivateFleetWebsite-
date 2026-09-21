import { AIRPORT_COORDINATES } from '@/data/airportCoordinates';

// Typical block speeds (km/h) by aircraft category, used when the category is known.
const SPEED_KMH: Record<string, number> = {
  'Very Light Jet': 620,
  'Light Jet': 720,
  'Midsize Jet': 800,
  'Super-Midsize Jet': 840,
  'Heavy Jet': 880,
  'VIP Airliner': 900,
};
const DEFAULT_SPEED_KMH = 800;
// Taxi, take-off, climb, descent and approach, on top of the time in the cruise.
const OVERHEAD_HOURS = 0.4;
// Flights are never perfectly straight (air corridors, weather, arrival routes).
const ROUTING_FACTOR = 1.05;
const EARTH_RADIUS_KM = 6371;

/** ICAO code from a route label like "Dubai (OMDW)" or a bare "OMDW". */
export function airportCode(route: string): string | null {
  const bracketed = route.match(/\(([A-Z0-9]{4})\)/);
  if (bracketed) return bracketed[1];
  const bare = route.trim().toUpperCase();
  return /^[A-Z0-9]{4}$/.test(bare) ? bare : null;
}

function greatCircleKm(a: [number, number], b: [number, number]): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export interface FlightTimeEstimate {
  minutes: number;
  /** e.g. "5h 10m" */
  label: string;
  distanceKm: number;
}

/** Flight time between two airports, worked out from their real positions:
 * the great-circle distance (plus a little for routing) at the aircraft
 * category's typical speed, plus the time on the ground and in the climb and
 * descent. Rounded to 5 minutes. Null if either airport isn't known. */
export function estimateFlightTime(from: string, to: string, category?: string): FlightTimeEstimate | null {
  const fromCode = airportCode(from);
  const toCode = airportCode(to);
  if (!fromCode || !toCode) return null;
  const a = AIRPORT_COORDINATES[fromCode];
  const b = AIRPORT_COORDINATES[toCode];
  if (!a || !b) return null;

  const distanceKm = greatCircleKm(a, b);
  if (distanceKm < 1) return null;
  const speed = (category && SPEED_KMH[category]) || DEFAULT_SPEED_KMH;
  const hours = (distanceKm * ROUTING_FACTOR) / speed + OVERHEAD_HOURS;
  const minutes = Math.max(15, Math.round((hours * 60) / 5) * 5);
  return { minutes, label: formatDuration(minutes), distanceKm: Math.round(distanceKm) };
}
