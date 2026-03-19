import { SPRINT_EVENTS } from '../../shared/constants.js';

export function createInitialSessionRetroState() {
  const shuffled = [...SPRINT_EVENTS].sort(() => Math.random() - 0.5);
  return {
    bossStep: 0,
    retroEvents: shuffled.slice(0, 6),
    currentEvtIdx: 0,
    eventVotes: {},
    oracleEvents: [],
    oracleUsed: false,
    rootCauses: {},
    bossBattleHp: 0,
    problemEvents: [],
    rootCauseIdx: 0,
  };
}

export function sessionRetroReducer(state, action) {
  switch (action.type) {
    case 'merge':
      return { ...state, ...action.patch };
    case 'eventVote':
      return {
        ...state,
        eventVotes: { ...state.eventVotes, [action.eventId]: action.vote },
      };
    case 'problemEvent:add':
      return {
        ...state,
        problemEvents: [...state.problemEvents, action.event],
        bossBattleHp: state.bossBattleHp + action.hpGain,
      };
    case 'oracle:add':
      return {
        ...state,
        oracleEvents: [...state.oracleEvents, action.eventId],
        oracleUsed: true,
      };
    case 'oracle:reset':
      return { ...state, oracleUsed: false };
    case 'rootCause:set':
      return {
        ...state,
        rootCauses: { ...state.rootCauses, [action.eventId]: action.cause },
      };
    default:
      return state;
  }
}
