export function makeCoupleId(a: string, b: string) {
  if (!a || !b) return '';
  return [a, b].sort().join('_');
}
export default makeCoupleId;
