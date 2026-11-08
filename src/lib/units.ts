const MM_PER_INCH = 25.4;
const MM_PER_FOOT = 12 * MM_PER_INCH;

export function feetInchesToMm(feet: number, inches: number): number {
  return Math.round((feet * MM_PER_FOOT + inches * MM_PER_INCH) * 100) / 100;
}

export function mmToFeetInches(mm: number): { feet: number; inches: number } {
  const totalInches = mm / MM_PER_INCH;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round((totalInches - feet * 12) * 100) / 100;
  return { feet, inches };
}

export function formatFeetInches(mm: number): string {
  const { feet, inches } = mmToFeetInches(mm);
  return `${feet}'-${inches}"`;
}
