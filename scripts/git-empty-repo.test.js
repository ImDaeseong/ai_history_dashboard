'use strict';
const assert = require('assert');
const { isEmptyRepoError } = require('./git-empty-repo');

// Regression guard for the 2026-09-10 incident: ai_agent/keyinfo (a fresh,
// isolated repo with no commits ever) made regenerate.js abort every
// scripts/*.bat instead of treating it as a legitimate 0-commit repo.
assert(isEmptyRepoError(
  "Command failed: git log --since=30 days ago\nfatal: your current branch 'master' does not have any commits yet\n"
));
assert(!isEmptyRepoError('fatal: not a git repository (or any of the parent directories): .git'));
assert(!isEmptyRepoError("fatal: detected dubious ownership in repository at 'C:/some/path'"));

console.log('git-empty-repo.test.js: all assertions passed');
