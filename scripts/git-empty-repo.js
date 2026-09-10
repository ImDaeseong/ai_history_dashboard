'use strict';
// Classifies a `git log` failure message: is this the specific, stable git
// error for a repo that exists but has zero commits ever, or some other
// failure (bad path, ownership mismatch, corrupt repo)? Only the former is
// safe to treat as "0 commits" instead of aborting the whole regeneration --
// see the comment in regenerate.js's collectRepoCommits for the incident
// this fixes (ai_agent/keyinfo, a fresh isolated repo with no commits).
function isEmptyRepoError(message) {
  return /does not have any commits yet/.test(message);
}

module.exports = { isEmptyRepoError };
