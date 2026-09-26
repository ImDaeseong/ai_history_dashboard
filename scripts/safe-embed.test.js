'use strict';
const assert = require('assert');
const { escapeForScriptEmbed } = require('./safe-embed');

// 2026-09-26 독립 리뷰 발견: regenerate.js가 JSON.stringify() 결과를 그대로
// <script> 블록에 붙여넣어서, 커밋 메시지나 Codex 세션 제목에 "</script>"가
// 그대로 들어 있으면 그 지점에서 <script> 태그가 닫히고 이후 내용이
// 이스케이프되지 않은 실제 HTML로 취급될 수 있었다(퍼블릭 GitHub Pages).
const malicious = JSON.stringify({ subject: 'a</script><script>alert(1)</script>b' });
// Control: confirm the underlying vulnerability is real before asserting the
// fix -- plain JSON.stringify (what regenerate.js used before this fix) does
// NOT escape "</script>", so this must contain it.
assert(malicious.includes('</script>'), 'test setup is invalid: JSON.stringify unexpectedly escaped </script> already');

const escaped = escapeForScriptEmbed(malicious);
assert(!escaped.includes('</script>'), `escaped output still contains a literal </script>: ${escaped}`);
assert.strictEqual(
  JSON.parse(escaped.replace(/\\u003c/g, '<')).subject,
  'a</script><script>alert(1)</script>b',
  'escaping must be reversible back to the exact original string',
);

// Ordinary data with no '<' at all must round-trip unchanged.
const plain = JSON.stringify({ subject: 'ordinary commit message' });
assert.strictEqual(escapeForScriptEmbed(plain), plain);

console.log('OK safe-embed.test.js');
