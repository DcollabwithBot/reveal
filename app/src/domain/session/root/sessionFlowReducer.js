export function createInitialSessionFlowState(maxHp) {
  return {
    step: 0,
    pv: null,
    votes: [],
    rdy: false,
    rev: false,
    cd: -1,
    cv: null,
    ac: [],
    bossHp: maxHp,
    combo: 0,
    achieves: [],
    loot: [],
    rc: [],
    ll: null,
    llr: null,
    activeChallenge: null,
    initialVote: null,
    revoting: false,
  };
}

export function sessionFlowReducer(state, action) {
  switch (action.type) {
    case 'merge':
      return { ...state, ...action.patch };
    case 'setVotesReady':
      return { ...state, votes: action.votes, rdy: true };
    case 'addAchieveId':
      return state.achieves.includes(action.value)
        ? state
        : { ...state, achieves: [...state.achieves, action.value] };
    case 'addRiskCard':
      return state.rc.includes(action.value)
        ? state
        : { ...state, rc: [...state.rc, action.value] };
    default:
      return state;
  }
}
