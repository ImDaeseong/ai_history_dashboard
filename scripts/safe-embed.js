'use strict';
// Escapes '<' in a JSON string so it can be spliced into a literal
// <script> block without a "</script>" sequence inside the embedded data
// (a commit subject, a Codex session title, ...) prematurely closing the
// tag and turning whatever follows into live HTML on the page. The escape
// sequence parses back to the same '<' character at JS runtime, so this
// changes only what the HTML tokenizer sees, not the resulting JS value.
function escapeForScriptEmbed(json) {
  return json.replace(/</g, '\\u003c');
}

module.exports = { escapeForScriptEmbed };
