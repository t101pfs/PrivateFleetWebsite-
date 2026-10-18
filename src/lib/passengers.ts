/** Displays the passenger count as whatever Sales originally typed ("6-8",
 * "6 to 8") when a range was entered, falling back to the plain number.
 * `passengers` itself always stays the top of that range - it's what every
 * pricing/capacity calculation actually uses - this is purely for showing
 * it back the way it was written. */
export function formatPassengers(passengers: number, passengersRange: string | null | undefined): string {
  return passengersRange?.trim() || String(passengers);
}
