export const STOREY_RANGE_OPTIONS = [
  'Below GB',
  'Ground Floor',
  'Ground to Roof',
  '1st to Roof',
  '2nd to Roof',
  'Custom',
] as const;

export interface BarGroup {
  bar_count: number;
  diameter_mm: number;
}

const STEEL_DENSITY_KG_PER_M = 0.00617;
const BAR_GROUP_PATTERN = /^(\d+)\s*[ØTD]\s*(\d+(?:\.\d+)?)$/i;
const TIE_DIAMETER_PATTERN = /^[ØTD]?\s*(\d+(?:\.\d+)?)$/i;
const TIE_SPACING_TOKEN_PATTERN = /^\d+(\.\d+)?"?$/;
const INCH_TO_MM = 25.4;

export function parseBarGroups(text: string): BarGroup[] {
  const groups: BarGroup[] = [];
  for (const part of text.split('+')) {
    const match = part.trim().match(BAR_GROUP_PATTERN);
    if (!match) return [];
    groups.push({ bar_count: parseInt(match[1], 10), diameter_mm: parseFloat(match[2]) });
  }
  return groups;
}

export function formatBarGroups(groups: BarGroup[]): string {
  return groups.map((g) => `${g.bar_count}Ø${g.diameter_mm}`).join(' + ');
}

export function parseTieDiameter(text: string): number | null {
  const match = text.trim().match(TIE_DIAMETER_PATTERN);
  return match ? parseFloat(match[1]) : null;
}

// Exact notation is stored as written; this derives the mid-span spacing in mm for calculations.
export function parseTieSpacingMm(notation: string): number | null {
  const parts = notation.split('/').map((p) => p.trim());
  const values: number[] = [];
  for (const part of parts) {
    if (!TIE_SPACING_TOKEN_PATTERN.test(part)) return null;
    const value = parseFloat(part);
    if (value <= 0) return null;
    values.push(part.endsWith('"') ? value * INCH_TO_MM : value);
  }
  const mid = values.length >= 2 ? values[1] : values[0];
  return mid === undefined ? null : Math.round(mid * 10) / 10;
}

export function calcConcreteVolume(widthMm: number, depthMm: number, heightM: number, quantity: number): number {
  if (widthMm <= 0 || depthMm <= 0 || heightM <= 0 || quantity <= 0) return 0;
  return (widthMm / 1000) * (depthMm / 1000) * heightM * quantity;
}

interface SteelInput {
  groups: BarGroup[];
  tieDiameterMm: number | null;
  tieSpacingMm: number | null;
  widthMm: number;
  depthMm: number;
  heightM: number;
  quantity: number;
  clearCoverMm: number;
}

// Tie perimeter is measured to the inside of the cover on each face.
export function calcSteelWeight(input: SteelInput): number {
  const { groups, tieDiameterMm, tieSpacingMm, widthMm, depthMm, heightM, quantity, clearCoverMm } = input;
  if (heightM <= 0 || quantity <= 0) return 0;
  let weight = 0;

  const barLength = heightM + 0.15;
  for (const group of groups) {
    const unitWeight = STEEL_DENSITY_KG_PER_M * group.diameter_mm * group.diameter_mm;
    weight += group.bar_count * barLength * unitWeight * quantity;
  }

  const coreWidthM = Math.max(widthMm - 2 * clearCoverMm, 0) / 1000;
  const coreDepthM = Math.max(depthMm - 2 * clearCoverMm, 0) / 1000;
  const corePerimeterM = 2 * (coreWidthM + coreDepthM);
  if (tieDiameterMm && tieSpacingMm && tieSpacingMm > 0 && corePerimeterM > 0) {
    const tieCount = Math.ceil(heightM / (tieSpacingMm / 1000));
    const tieLength = 2 * (corePerimeterM + 0.1);
    const unitWeight = STEEL_DENSITY_KG_PER_M * tieDiameterMm * tieDiameterMm;
    weight += tieCount * tieLength * unitWeight * quantity;
  }

  return Math.round(weight * 100) / 100;
}
