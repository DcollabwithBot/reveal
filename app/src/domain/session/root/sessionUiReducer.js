export const initialSessionUiState = {
  bossHit: false,
  bossDead: false,
  atk: false,
  npcAtk: [],
  npcHits: [],
  dmgNums: [],
  flash: null,
  shake: false,
  showAchieve: null,
  spellName: null,
};

export function sessionUiReducer(state, action) {
  switch (action.type) {
    case 'bossHit':
      return { ...state, bossHit: action.value };
    case 'bossDead':
      return { ...state, bossDead: action.value };
    case 'atk':
      return { ...state, atk: action.value };
    case 'npcAtk:add':
      return { ...state, npcAtk: [...state.npcAtk, action.value] };
    case 'npcAtk:remove':
      return { ...state, npcAtk: state.npcAtk.filter((x) => x !== action.value) };
    case 'npcHits:set':
      return { ...state, npcHits: action.value };
    case 'dmgNums:add':
      return { ...state, dmgNums: [...state.dmgNums, action.value] };
    case 'dmgNums:trimFront':
      return { ...state, dmgNums: state.dmgNums.slice(action.count || 1) };
    case 'flash':
      return { ...state, flash: action.value };
    case 'shake':
      return { ...state, shake: action.value };
    case 'showAchieve':
      return { ...state, showAchieve: action.value };
    case 'spellName':
      return { ...state, spellName: action.value };
    default:
      return state;
  }
}
