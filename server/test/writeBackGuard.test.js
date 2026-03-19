const test = require('node:test');
const assert = require('node:assert/strict');

const { assertWriteBackAllowed } = require('../domain/writeBackGuard');

test('write-back guard: blocks unauthorized direct game -> PM mutation', () => {
  assert.throws(
    () => assertWriteBackAllowed({ actor: 'game', sourceLayer: 'game', hasApprovedRequest: true }),
    /Unauthorized direct game->PM mutation blocked/
  );
});

test('write-back guard: blocks writes without approval', () => {
  assert.throws(
    () => assertWriteBackAllowed({ actor: 'pm', sourceLayer: 'game', hasApprovedRequest: false }),
    /requires PM approval/
  );
});

test('write-back guard: allows approved PM/system mediated write', () => {
  assert.equal(assertWriteBackAllowed({ actor: 'pm', sourceLayer: 'game', hasApprovedRequest: true }), true);
  assert.equal(assertWriteBackAllowed({ actor: 'system', sourceLayer: 'game', hasApprovedRequest: true }), true);
});
