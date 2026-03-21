import { CLASSES } from '../../shared/constants.js';
import { dk } from '../../shared/utils.js';

export const PF = "'Press Start 2P', monospace";
export const VT = "'VT323', monospace";

export const TSHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const TSHIRT_POINTS = { XS: 1, S: 2, M: 3, L: 5, XL: 8, XXL: 13 };

export const STEPS = { LOBBY: 1, BREAKDOWN: 2, GM_MERGE: 3, QUICK_ESTIMATE: 4, SUM_REVEAL: 5, GAP_ANALYSIS: 6, APPROVAL: 7 };

export function makeAnonMember(index, name = '') {
  const cl = CLASSES[index % CLASSES.length];
  return { id: index + 1, name: name || `P${index + 1}`, lv: 1 + (index % 5), cls: cl, hat: cl.color, body: cl.color, btc: dk(cl.color, 60), skin: ['#fdd', '#fed', '#edc', '#ffe', '#fec'][index % 5], isP: false };
}
