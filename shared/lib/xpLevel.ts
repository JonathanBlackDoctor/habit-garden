export function xpForLevel(level: number): number {
  if (level <= 0)  return 10;
  if (level <= 10) return 10 * level * level;
  if (level <= 15) return Math.floor(28.781 * Math.pow(level, 1.5));
  if (level <= 20) return Math.floor(36.183 * Math.pow(level, 1.4));
  if (level <= 25) return Math.floor(48.084 * Math.pow(level, 1.3));
  if (level <= 30) return Math.floor(66.413 * Math.pow(level, 1.2));
  return Math.floor(94.504 * Math.pow(level, 1.1));
}
