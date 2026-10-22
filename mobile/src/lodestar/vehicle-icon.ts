// The icon and colour for a vehicle's temperature class next to its kind ("Reefer truck", "Dry van"): a snowflake in
// teal for a chilled (reefer) vehicle, a box in amber for a dry (ambient) one. Never a snowflake on a dry vehicle.
const svg = (stroke: string, d: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="${d}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;

export const CHILLED_COLOR = '#0e7490';
export const DRY_COLOR = '#b45309';

const SNOWFLAKE = svg(CHILLED_COLOR, 'M12 2v20M4.2 7l15.6 10M4.2 17 19.8 7');
const BOX = svg(DRY_COLOR, 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16ZM3.3 7 12 12l8.7-5M12 22V12');

/** `{ xml, color }` for the vehicle's temp class (`CHILLED` → reefer snowflake; anything else → dry box). */
export function tempClassIcon(tempClass?: string | null): { xml: string; color: string; chilled: boolean } {
  const chilled = tempClass === 'CHILLED';
  return chilled ? { xml: SNOWFLAKE, color: CHILLED_COLOR, chilled } : { xml: BOX, color: DRY_COLOR, chilled };
}
