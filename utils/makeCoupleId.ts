// utils/makeCoupleId.ts
export function makeCoupleId(a: string, b: string) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}
