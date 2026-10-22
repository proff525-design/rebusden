// Смоук-тест игровой логики РебусДень на заглушке DOM (можно удалить)
const fs = require('fs');

function makeEl() {
  const el = {
    _html: '', textContent: '', value: '', hidden: false, disabled: false, className: '',
    children: [], style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {},
    appendChild(c) { el.children.push(c); return c; },
    remove() {}, select() {}, blur() {}, focus() {},
    closest() { return makeEl(); },
    querySelectorAll() { return []; },
    offsetWidth: 100,
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html; },
    set(v) { el._html = v; el.children = []; },
  });
  return el;
}
const els = {};
global.document = {
  getElementById(id) { return els[id] || (els[id] = makeEl()); },
  createElement() { return makeEl(); },
  querySelectorAll() { return []; },
  addEventListener() {},
  body: makeEl(),
};
const mem = {};
global.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
};
global.window = { scrollTo() {} };
global.navigator = {};

let fail = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };

/* --- загрузка данных --- */
const data = new Function(fs.readFileSync('puzzles.js', 'utf8') +
  '; return {PUZZLES, ATTEMPTS_MAX, DAY_EPOCH, POOL_SALT};')();
Object.assign(global, data);

/* --- загрузка игры (возвращает доступ к внутренним функциям) --- */
const api = new Function(fs.readFileSync('game.js', 'utf8') +
  `; return {
      openDaily, openTrain, submitGuess, useHint, shareText, renderArchive, evaluate,
      BASE_GROUPS, challengeText, forceTrain, builderForm, signLabel, pictureHTML,
      todayKey, yesterdayKey, keyOf, dateOf, dayNumber, puzzleForDate,
      getS: () => S, getDb: () => db,
      MAX: ATTEMPTS_MAX,
   };`)();

const S = api.getS, db = api.getDb;
const type = (word) => { els.guessInput.value = word; els.trainInput.value = word; api.submitGuess(); };
const ansOf = () => api.getS().puzzle.answer.toUpperCase();
const wrongWord = (ans) => {
  for (const cand of ['Я', 'Б', 'Ы']) {
    const w = cand.repeat(ans.length);
    if (w !== ans) return w;
  }
  return 'Х'.repeat(ans.length);
};

/* 1. Ввод не той длины блокируется */
type('А');
ok(S().guesses.length === 0 && S().status === 'playing', 'слово неверной длины не принимается');

/* 2. Неверная попытка + первая подсказка */
type(wrongWord(ansOf()));
ok(S().guesses.length === 1 && S().status === 'playing', 'неверная попытка учтена, игра продолжается');
api.useHint();
ok(S().hints.base === true, 'бесплатная подсказка (базовое слово картинки) выдана');

/* 3. Победа со 2-й попытки */
const ans = ansOf();
type(ans);
ok(S().status === 'won', 'верный ответ завершает игру победой');
ok(JSON.parse(mem.rebusdaily_v1).days[api.todayKey()].status === 'won', 'победа сохранена в localStorage');
ok(db().streak === 1 && db().won === 1 && db().dist[2] === 1, 'серия=1, побед=1, распределение попыток верно');
ok(db().played === 1, 'сыграно=1');

/* 4. Текст шеринга */
const t = api.shareText();
console.log('     шеринг:\n     ' + t.replace(/\n/g, '\n     '));
ok(/РебусДень #\d+/.test(t) && /[🟩🟨⬛]/.test(t) && /2\/5/.test(t), 'сетка результата и счётчик в шеринге корректны');

/* 5. После победы ходы заблокированы */
type(ans);
ok(S().guesses.length === 2, 'после победы новые ходы не принимаются');

/* 6. Серия продолжается на следующий день */
db().lastWinDate = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return api.keyOf(d); })();
db().streak = 4;
delete db().days[api.todayKey()];
api.openDaily(api.todayKey());
type(ans);
ok(db().streak === 5, 'серия 4 -> 5 при победе на следующий день');
ok(db().best === 5, 'рекорд серии обновлён');
ok(db().played === 2, 'статистика игр не дублируется (сыграно=2)');

/* 7. Проигрыш обнуляет серию */
delete db().days[api.todayKey()];
api.openDaily(api.todayKey());
const a7 = ansOf();
for (let i = 0; i < api.MAX; i++) type(wrongWord(a7));
ok(S().status === 'lost', 'после 5 неверных попыток — проигрыш');
ok(db().streak === 0, 'проигрыш обнуляет серию');
ok(db().played === 3, 'сыграно=3');

/* 8. Детерминированность пазла дня + архив */
const same1 = api.puzzleForDate(api.dateOf(api.todayKey())).id;
const same2 = api.puzzleForDate(api.dateOf(api.todayKey())).id;
ok(same1 === same2, 'пазл дня детерминирован');
api.renderArchive();
ok(els.archiveList.children.length === 7, 'архив показывает 7 прошлых дней: ' + els.archiveList.children.length);

/* 9. Тренировка не портит общую статистику */
const before = db().played;
api.openTrain(true);
ok(S().mode === 'train' && S().status === 'playing', 'тренировка стартует со свежей загадкой');
type(S().puzzle.answer.toUpperCase());
ok(S().status === 'won', 'тренировочный ребус решается');
ok(db().played === before, 'тренировка не влияет на статистику и серию');
ok(/тренировка/.test(api.shareText()), 'шеринг тренировки помечен');

/* 11. Оценка букв в карточке-шеринге совпадает с игровой */
const cardApi = new Function(fs.readFileSync('sharecard.js', 'utf8') + '; return {evalGuess};')();
const pairs = [['КОТ', 'СОН'], ['ДАЧА', 'ЛОЧА'], ['ПОЛЕТ', 'ПОЛЕ'], ['РАБ', 'БАР'], ['ЧАСЫ', 'ЧАСЫ']];
let same = true;
for (const [g, a] of pairs) {
  const inGame = api.evaluate(g, a);
  const inCard = cardApi.evalGuess(g, a);
  if (JSON.stringify(inGame) !== JSON.stringify(inCard)) same = false;
}
ok(same, 'сетка в PNG-карточке считается так же, как в игре');

/* 12. Конструктор: группы полные, формы уникальны */
const allForms = api.BASE_GROUPS.flatMap((g) => g.forms);
ok(allForms.length === data.PUZZLES.length, 'все формы разложены по группам картинок: ' + allForms.length + '/' + data.PUZZLES.length);
ok(new Set(allForms.map((f) => f.id)).size === data.PUZZLES.length, 'без потерь и дублей в группах');
ok(api.BASE_GROUPS.every((g) => g.forms.length >= 1 && g.emoji && g.base), 'у каждой группы есть картинка и формы');
ok(api.BASE_GROUPS.length >= 10, 'картинок в конструкторе минимум 10: ' + api.BASE_GROUPS.length);

/* 13. Челлендж не сливает ответ и содержит длину слова */
let leak = null, noLen = null;
for (const p of api.BASE_GROUPS.flatMap((g) => g.forms)) {
  const t = api.challengeText(p);
  if (t.toUpperCase().includes(p.answer.toUpperCase())) leak = p.id + ' ' + p.answer;
  if (!new RegExp('\\d+\\s*букв', 'i').test(t)) noLen = p.id;
}
ok(leak === null, 'текст челленджа не содержит ответа' + (leak ? ' — утечка: ' + leak : ''));
ok(noLen === null, 'текст челленджа всегда сообщает длину слова');

/* 14. Конструктор → игра */
const pick = api.BASE_GROUPS[2].forms[0];
api.forceTrain(pick);
ok(S().mode === 'train' && S().puzzle.id === pick.id && S().status === 'playing',
   '«Играть» из конструктора запускает выбранный ребус в тренировке');

console.log(`\nОшибок: ${fail}`);
process.exit(fail ? 1 : 0);
