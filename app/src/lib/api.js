// lib/api.js — facade (backwards compatible)
// All existing imports like `import { getMembership } from '../lib/api.js'` still work unchanged.

export { edgeFn } from './api/shared';
export * from './api/sessionApi';
export * from './api/projectApi';
export * from './api/gameApi';
export * from './api/orgApi';
export * from './api/integrationApi';
