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

export interface SlabBarGroup extends BarGroup {
  length_m: number;
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

interface ColumnSteelInput {
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
export function calcSteelWeight(input: ColumnSteelInput): number {
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

// ---- Beam ----

export interface BeamLayerGroups {
  top: BarGroup[];
  bottom: BarGroup[];
  extraLeft: BarGroup[];
  extraMid: BarGroup[];
  extraRight: BarGroup[];
}

interface BeamSteelInput {
  layers: BeamLayerGroups;
  stirrupDiameterMm: number | null;
  stirrupSpacingMm: number | null;
  widthMm: number;
  depthMm: number;
  lengthM: number;
  quantity: number;
  clearCoverMm: number;
}

export function calcBeamConcreteVolume(widthMm: number, depthMm: number, lengthM: number, quantity: number): number {
  if (widthMm <= 0 || depthMm <= 0 || lengthM <= 0 || quantity <= 0) return 0;
  return (widthMm / 1000) * (depthMm / 1000) * lengthM * quantity;
}

export function calcBeamSteelWeight(input: BeamSteelInput): number {
  const { layers, stirrupDiameterMm, stirrupSpacingMm, widthMm, depthMm, lengthM, quantity, clearCoverMm } = input;
  if (lengthM <= 0 || quantity <= 0) return 0;
  let weight = 0;

  const allGroups = [...layers.top, ...layers.bottom, ...layers.extraLeft, ...layers.extraMid, ...layers.extraRight];
  for (const group of allGroups) {
    const unitWeight = STEEL_DENSITY_KG_PER_M * group.diameter_mm * group.diameter_mm;
    weight += group.bar_count * lengthM * unitWeight * quantity;
  }

  const coreWidthM = Math.max(widthMm - 2 * clearCoverMm, 0) / 1000;
  const coreDepthM = Math.max(depthMm - 2 * clearCoverMm, 0) / 1000;
  const corePerimeterM = 2 * (coreWidthM + coreDepthM);
  if (stirrupDiameterMm && stirrupSpacingMm && stirrupSpacingMm > 0 && corePerimeterM > 0) {
    const stirrupCount = Math.ceil(lengthM / (stirrupSpacingMm / 1000));
    const stirrupLength = 2 * (corePerimeterM + 0.1);
    const unitWeight = STEEL_DENSITY_KG_PER_M * stirrupDiameterMm * stirrupDiameterMm;
    weight += stirrupCount * stirrupLength * unitWeight * quantity;
  }

  return Math.round(weight * 100) / 100;
}

// ---- Footing ----

export interface FootingLayerGroups {
  bottomX: BarGroup[];
  bottomY: BarGroup[];
  top: BarGroup[];
}

interface FootingSteelInput {
  layers: FootingLayerGroups;
  lengthMm: number;
  widthMm: number;
  clearCoverMm: number;
  quantity: number;
}

export function calcFootingConcreteVolume(
  lengthMm: number,
  widthMm: number,
  thicknessMm: number,
  quantity: number,
  pedestalLengthMm = 0,
  pedestalWidthMm = 0,
  pedestalHeightMm = 0,
): number {
  if (lengthMm <= 0 || widthMm <= 0 || thicknessMm <= 0 || quantity <= 0) return 0;
  const slabVolume = (lengthMm / 1000) * (widthMm / 1000) * (thicknessMm / 1000) * quantity;
  const pedestalVolume =
    pedestalLengthMm > 0 && pedestalWidthMm > 0 && pedestalHeightMm > 0
      ? (pedestalLengthMm / 1000) * (pedestalWidthMm / 1000) * (pedestalHeightMm / 1000) * quantity
      : 0;
  return slabVolume + pedestalVolume;
}

export function calcFootingExcavationVolume(lengthMm: number, widthMm: number, foundationDepthM: number, quantity: number): number {
  if (lengthMm <= 0 || widthMm <= 0 || foundationDepthM <= 0 || quantity <= 0) return 0;
  return (lengthMm / 1000) * (widthMm / 1000) * foundationDepthM * quantity;
}

export function calcFootingSteelWeight(input: FootingSteelInput): number {
  const { layers, lengthMm, widthMm, clearCoverMm, quantity } = input;
  if (quantity <= 0) return 0;
  let weight = 0;

  const xLengthM = Math.max(lengthMm - 2 * clearCoverMm, 0) / 1000;
  const yLengthM = Math.max(widthMm - 2 * clearCoverMm, 0) / 1000;

  for (const group of layers.bottomX) {
    const unitWeight = STEEL_DENSITY_KG_PER_M * group.diameter_mm * group.diameter_mm;
    weight += group.bar_count * xLengthM * unitWeight * quantity;
  }
  for (const group of layers.bottomY) {
    const unitWeight = STEEL_DENSITY_KG_PER_M * group.diameter_mm * group.diameter_mm;
    weight += group.bar_count * yLengthM * unitWeight * quantity;
  }
  for (const group of layers.top) {
    const unitWeight = STEEL_DENSITY_KG_PER_M * group.diameter_mm * group.diameter_mm;
    weight += group.bar_count * Math.max(xLengthM, yLengthM) * unitWeight * quantity;
  }

  return Math.round(weight * 100) / 100;
}

// ---- Slab ----

export interface SlabLayerGroups {
  main: SlabBarGroup[];
  distribution: SlabBarGroup[];
}

interface SlabSteelInput {
  layers: SlabLayerGroups;
  areaSqm: number;
  thicknessMm: number;
  clearCoverMm: number;
  quantity: number;
}

export function calcSlabConcreteVolume(thicknessMm: number, areaSqm: number, quantity: number): number {
  if (thicknessMm <= 0 || areaSqm <= 0 || quantity <= 0) return 0;
  return (thicknessMm / 1000) * areaSqm * quantity;
}

// Slab steel: each group's total length x unit weight, summed.
export function calcSlabSteelWeight(input: SlabSteelInput): number {
  const { layers, quantity } = input;
  if (quantity <= 0) return 0;
  let weight = 0;

  for (const group of [...layers.main, ...layers.distribution]) {
    const unitWeight = STEEL_DENSITY_KG_PER_M * group.diameter_mm * group.diameter_mm;
    weight += group.bar_count * group.length_m * unitWeight * quantity;
  }

  return Math.round(weight * 100) / 100;
}

// ---- Rebar ----

export function calcRebarWeight(diameterMm: number, numberOfBars: number, lengthPerBarM: number): number {
  if (diameterMm <= 0 || numberOfBars <= 0 || lengthPerBarM <= 0) return 0;
  const unitWeight = STEEL_DENSITY_KG_PER_M * diameterMm * diameterMm;
  return Math.round(numberOfBars * lengthPerBarM * unitWeight * 100) / 100;
}

// ---- Structural cost estimation ----

export const STRUCTURAL_RATES = {
  concrete: 12000,
  steel: 110,
  excavation: 350,
} as const;

export function calcStructuralCost(concreteCum: number, steelKg: number, excavationCum: number = 0): number {
  return Math.round(concreteCum * STRUCTURAL_RATES.concrete + steelKg * STRUCTURAL_RATES.steel + excavationCum * STRUCTURAL_RATES.excavation);
}
