export const DEFAULT_ADVANCE_PCT = 10;

export function calculateAdvanceAmount(contractValue: number, advancePct: number): number {
  return Math.round((contractValue * advancePct) / 100);
}
