// Временный скрипт проверки данных игры (можно удалить)
const fs = require('fs');
const load = (f) => new Function(fs.readFileSync(f, 'utf8') + '; return {PUZZLES, ATTEMPTS_MAX};')();
const { PUZZLES } = load('puzzles.js');

let fail = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };

for (const p of PUZZLES) {
  let r;
  switch (p.sign) {
    case 'reverse':   r = [...p.base].reverse().join(''); break;
    case 'del-first': r = p.base.slice(1); break;
    case 'del-last':  r = p.base.slice(0, -1); break;
    case 'add-first': r = p.letter + p.base; break;
    case 'add-last':  r = p.base + p.letter; break;
  }
  ok(r === p.answer, `${p.id} ${p.emoji} ${p.sign} "${p.base}" -> "${p.answer}"` + (r === p.answer ? '' : ` (вычислилось "${r}")`));
}
ok(new Set(PUZZLES.map(p => p.answer)).size === PUZZLES.length, 'ответы уникальны');
ok(PUZZLES.every(p => p.answer.length >= 3 && p.answer.length <= 6), 'длины ответов 3-6 букв');
ok(PUZZLES.every(p => /^[А-ЯЁ]+$/.test(p.answer)), 'ответы только кириллица, без пробелов');
console.log(`\nВсего загадок: ${PUZZLES.length}, ошибок: ${fail}`);
process.exit(fail ? 1 : 0);
