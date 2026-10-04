// C2-F1 — DIGIPIN encoder (India Post open algorithm, 4×4 grid over 10 levels).
// Spec §9.1. TODO before demo: cross-check against India Post's reference implementation.
const GRID = [
  ['F', 'C', '9', '8'],
  ['J', '3', '2', '7'],
  ['K', '4', '5', '6'],
  ['L', 'M', 'P', 'T'],
];

export function encodeDigipin(lat: number, lng: number): string {
  let minLat = 2.5, maxLat = 38.5, minLon = 63.5, maxLon = 99.5;
  if (lat < minLat || lat > maxLat || lng < minLon || lng > maxLon) throw new Error('Outside India bounds');
  let code = '';
  for (let level = 1; level <= 10; level++) {
    const latDiv = (maxLat - minLat) / 4;
    const lonDiv = (maxLon - minLon) / 4;
    let row = 3 - Math.floor((lat - minLat) / latDiv); // row 0 = north
    let col = Math.floor((lng - minLon) / lonDiv);
    row = Math.max(0, Math.min(3, row));
    col = Math.max(0, Math.min(3, col));
    code += GRID[row][col];
    if (level === 3 || level === 6) code += '-';
    maxLat = minLat + latDiv * (4 - row);
    minLat = minLat + latDiv * (3 - row);
    minLon = minLon + lonDiv * col;
    maxLon = minLon + lonDiv;
  }
  return code;
}

/** D1.12 — decode a DIGIPIN back to the centre of its ~4 m cell. Pure math: works with no network. */
export function decodeDigipin(code: string): { lat: number; lng: number } {
  const chars = code.replace(/-/g, '').toUpperCase();
  if (chars.length !== 10) throw new Error('A DIGIPIN has 10 characters');
  let minLat = 2.5, maxLat = 38.5, minLon = 63.5, maxLon = 99.5;
  for (const ch of chars) {
    let row = -1, col = -1;
    GRID.forEach((r, ri) => { const ci = r.indexOf(ch); if (ci >= 0) { row = ri; col = ci; } });
    if (row < 0) throw new Error(`Invalid DIGIPIN character: ${ch}`);
    const latDiv = (maxLat - minLat) / 4;
    const lonDiv = (maxLon - minLon) / 4;
    maxLat = minLat + latDiv * (4 - row);
    minLat = minLat + latDiv * (3 - row);
    minLon = minLon + lonDiv * col;
    maxLon = minLon + lonDiv;
  }
  return { lat: (minLat + maxLat) / 2, lng: (minLon + maxLon) / 2 };
}
