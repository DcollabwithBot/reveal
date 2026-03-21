import { CLASSES } from '../../shared/constants.js';
import { dk } from '../../shared/utils.js';

export function makeMyMember(avatar) {
  const cl = avatar?.cls || CLASSES[0];
  return {
    id: 0, name: 'YOU', lv: 3, cls: cl,
    hat: avatar?.helmet?.pv || cl.color,
    body: avatar?.armor?.pv || cl.color,
    btc: avatar?.boots?.pv || dk(cl.color, 60),
    skin: avatar?.skin || '#fdd', isP: true,
  };
}

export function makeAnonMember(index, name = '') {
  const cl = CLASSES[index % CLASSES.length];
  return {
    id: index, name: name || `P${index + 1}`,
    lv: 1 + (index % 5), cls: cl,
    hat: cl.color, body: cl.color,
    btc: dk(cl.color, 60),
    skin: ['#fdd','#fed','#edc','#ffe','#fec'][index % 5],
    isP: false,
  };
}

export const PF = "'Press Start 2P', monospace";
export const VT = "'VT323', monospace";
export const FIBS = [1, 2, 3, 5, 8, 13, 21];
