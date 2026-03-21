import { CLASSES } from '../../shared/constants.js';
import { dk } from '../../shared/utils.js';

export const PF = "'Press Start 2P', monospace";
export const VT = "'VT323', monospace";
export const FIBONACCI = [1, 2, 3, 5, 8, 13, 21];

export function fibStepDelta(a, b) {
  const ia = FIBONACCI.indexOf(Number(a));
  const ib = FIBONACCI.indexOf(Number(b));
  if (ia === -1 || ib === -1) return 0;
  return Math.abs(ia - ib);
}

export function avgEstimate(votes) {
  const nums = (votes || []).filter(v => typeof v === 'number' && FIBONACCI.includes(v));
  if (!nums.length) return null;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return FIBONACCI.reduce((best, f) => Math.abs(f - mean) < Math.abs(best - mean) ? f : best, FIBONACCI[0]);
}

export function makeMyMember(avatar) {
  const cl = avatar?.cls || CLASSES[0];
  return { id: 0, name: 'YOU', lv: 3, cls: cl, hat: avatar?.helmet?.pv || cl.color, body: avatar?.armor?.pv || cl.color, btc: avatar?.boots?.pv || dk(cl.color, 60), skin: avatar?.skin || '#fdd', isP: true };
}

export function makeAnonMember(index, name = '') {
  const cl = CLASSES[index % CLASSES.length];
  return { id: index + 1, name: name || `P${index + 1}`, lv: 1 + (index % 5), cls: cl, hat: cl.color, body: cl.color, btc: dk(cl.color, 60), skin: ['#fdd', '#fed', '#edc', '#ffe', '#fec'][index % 5], isP: false };
}
