/* ==========================================================
   РебусДень — игровая логика
   ========================================================== */
'use strict';

const $ = (id) => document.getElementById(id);
const STORE_KEY = 'rebusdaily_v1';

/* ---------- хранилище ---------- */
function defaultDB() {
  return { streak: 0, best: 0, lastWinDate: null, played: 0, won: 0, dist: {}, days: {}, train: null };
}
function loadDB() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultDB();
    return Object.assign(defaultDB(), JSON.parse(raw));
  } catch (e) { return defaultDB(); }
}
function saveDB() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) {}
}
let db = loadDB();

/* ---------- даты ---------- */
function keyOf(d) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function dateOf(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
function todayKey() { return keyOf(new Date()); }
function yesterdayKey() { const d = new Date(); d.setDate(d.getDate() - 1); return keyOf(d); }
function dayNumber(d) {
  const mid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((mid - DAY_EPOCH) / 86400000);
}
function puzzleForDate(d) {
  const n = dayNumber(d);
  const idx = ((n + POOL_SALT) % PUZZLES.length + PUZZLES.length) % PUZZLES.length;
  return PUZZLES[idx];
}
function puzzleById(id) { return PUZZLES.find((p) => p.id === id) || PUZZLES[0]; }

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/* ---------- сессия ---------- */
/* S = { mode:'daily'|'date'|'train', key, puzzle, guesses, status, hints, msg } */
let S = null;

function openDaily(key) {
  if (!db.days[key]) {
    db.days[key] = { puzzleId: puzzleForDate(dateOf(key)).id, guesses: [], status: 'playing', hints: {}, counted: false };
    saveDB();
  }
  const e = db.days[key];
  S = {
    mode: key === todayKey() ? 'daily' : 'date',
    key, puzzle: puzzleById(e.puzzleId),
    guesses: e.guesses.slice(), status: e.status,
    hints: Object.assign({}, e.hints), msg: null,
  };
  render();
}
function openTrain(fresh) {
  if (fresh || !db.train) {
    let p;
    do { p = PUZZLES[Math.floor(Math.random() * PUZZLES.length)]; }
    while (PUZZLES.length > 1 && S && S.puzzle && p.id === S.puzzle.id);
    db.train = { puzzleId: p.id, guesses: [], status: 'playing', hints: {} };
    saveDB();
  }
  const t = db.train;
  S = { mode: 'train', key: null, puzzle: puzzleById(t.puzzleId),
        guesses: t.guesses.slice(), status: t.status, hints: Object.assign({}, t.hints), msg: null };
  render();
}
function persist() {
  if (S.mode === 'train') {
    db.train = { puzzleId: S.puzzle.id, guesses: S.guesses, status: S.status, hints: S.hints };
  } else {
    const e = db.days[S.key];
    e.puzzleId = S.puzzle.id; e.guesses = S.guesses; e.status = S.status; e.hints = S.hints;
  }
  saveDB();
}

/* ---------- контексты UI ---------- */
const dailyCtx = {
  board: $('board'), picture: $('rebusPicture'), caption: $('rebusCaption'),
  statusLine: $('statusLine'), input: $('guessInput'), form: $('guessForm'),
  hintBox: $('hintBox'), hintBtn: $('btnHint'), shareBtn: $('btnShare'), cardBtn: $('btnCard'),
  dots: $('attemptDots'), length: $('puzzleLength'), number: $('puzzleNumber'),
};
const trainCtx = {
  board: $('trainBoard'), picture: $('trainPicture'), caption: $('trainCaption'),
  statusLine: $('trainStatus'), input: $('trainInput'), form: $('trainForm'),
  hintBox: $('trainHintBox'), hintBtn: $('trainHintBtn'), shareBtn: $('trainShareBtn'), cardBtn: $('trainCardBtn'),
  dots: $('trainDots'), length: $('trainLength'), number: null,
};
function ctx() { return S.mode === 'train' ? trainCtx : dailyCtx; }

/* ---------- Wordle-оценка букв ---------- */
function evaluate(guess, answer) {
  const res = new Array(answer.length).fill('absent');
  const pool = {};
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) res[i] = 'correct';
    else pool[answer[i]] = (pool[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < guess.length; i++) {
    if (res[i] === 'correct') continue;
    if (pool[guess[i]] > 0) { res[i] = 'present'; pool[guess[i]]--; }
  }
  return res;
}

/* ---------- отрисовка ---------- */
function render() {
  const c = ctx();
  renderPicture(c);
  renderBoard(c);
  renderMeta(c);
  renderStatus(c);
  renderHints(c);
  $('streakVal').textContent = db.streak;
}

function pictureHTML(p) {
  let h = '<span class="emoji">' + p.emoji + '</span>';
  if (p.sign === 'del-first') h += '<span class="mod mod-comma-left">,</span>';
  if (p.sign === 'del-last')  h += '<span class="mod mod-comma-right">,</span>';
  if (p.sign === 'add-first') h += '<span class="mod mod-above">' + p.letter + '</span>';
  if (p.sign === 'add-last')  h += '<span class="mod mod-below">' + p.letter + '</span>';
  if (p.sign === 'reverse')   h += '<span class="mod mod-reverse">↻</span>';
  return h;
}
function renderPicture(c) {
  c.picture.innerHTML = pictureHTML(S.puzzle);
  c.caption.textContent = S.mode === 'train' ? 'слово на картинке + знаки = ответ'
    : 'нарисовано слово — знаки говорят, что с ним делать';
}

function renderBoard(c) {
  c.board.innerHTML = '';
  const ans = S.puzzle.answer.toUpperCase();
  S.guesses.forEach((g) => {
    const row = document.createElement('div'); row.className = 'row';
    evaluate(g, ans).forEach((st, i) => {
      const t = document.createElement('div');
      t.className = 'tile ' + st;
      t.textContent = g[i] || '';
      row.appendChild(t);
    });
    c.board.appendChild(row);
  });
}

function renderMeta(c) {
  const n = S.puzzle.answer.length;
  if (c.number) {
    if (S.mode === 'daily') c.number.textContent = 'Ребус #' + dayNumber(dateOf(S.key)) + ' · сегодня';
    else c.number.textContent = 'Ребус #' + dayNumber(dateOf(S.key)) + ' · ' +
      dateOf(S.key).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  }
  c.length.textContent = n + ' ' + plural(n, 'буква', 'буквы', 'букв');
  c.dots.innerHTML = '';
  for (let i = 0; i < ATTEMPTS_MAX; i++) {
    const d = document.createElement('span');
    d.className = 'dot';
    if (i < S.guesses.length) {
      d.classList.add('used');
      if (i === S.guesses.length - 1 && S.status === 'won') d.classList.add('ok');
    }
    c.dots.appendChild(d);
  }
}

function setStatus(c, type, text) {
  c.statusLine.className = 'status-line ' + (type || '');
  c.statusLine.textContent = text || '';
}
function renderStatus(c) {
  if (S.msg) { setStatus(c, S.msg.type, S.msg.text); return; }
  if (S.status === 'won') setStatus(c, 'good', '🎉 Верно! Это «' + S.puzzle.answer + '»');
  else if (S.status === 'lost') setStatus(c, 'bad', '😞 Было слово: ' + S.puzzle.answer);
  else setStatus(c, 'info', 'осталось попыток: ' + (ATTEMPTS_MAX - S.guesses.length));
}

function renderHints(c) {
  const h = [];
  if (S.hints.base) h.push('💡 ' + S.puzzle.hint);
  if (S.hints.letter) h.push('🔑 Первая буква ответа: <b>' + S.puzzle.answer[0] + '</b>');
  c.hintBox.hidden = h.length === 0;
  c.hintBox.innerHTML = h.join('<br>');
  c.hintBtn.disabled = S.hints.base && S.hints.letter;
  c.hintBtn.textContent = S.hints.base ? '💡 Ещё подсказка' : '💡 Подсказка';
  const playing = S.status === 'playing';
  c.input.disabled = !playing;
  c.shareBtn.disabled = S.status === 'playing';
  c.cardBtn.disabled = S.status === 'playing';
  if (playing) c.input.placeholder = 'Слово из ' + S.puzzle.answer.length + ' букв';
}

/* ---------- ход ---------- */
function shake(c) {
  c.form.classList.remove('shake');
  void c.form.offsetWidth;
  c.form.classList.add('shake');
}
function submitGuess(e) {
  if (e) e.preventDefault();
  const c = ctx();
  if (S.status !== 'playing') return;
  const val = c.input.value.trim().toUpperCase().replace(/[^А-ЯЁ]/g, '');
  if (!val) { shake(c); return; }
  if (val.length !== S.puzzle.answer.length) {
    shake(c);
    const n = S.puzzle.answer.length;
    S.msg = { type: 'bad', text: 'Нужно ' + n + ' ' + plural(n, 'буква', 'буквы', 'букв') };
    renderStatus(c);
    return;
  }
  S.guesses.push(val);
  S.msg = null;
  const ans = S.puzzle.answer.toUpperCase();
  if (val === ans) {
    S.status = 'won';
    S.msg = { type: 'good', text: '🎉 Верно! Это «' + S.puzzle.answer + '»' };
    recordResult(true);
    confetti();
    toast('Отлично! Серия: ' + db.streak + ' 🔥');
  } else if (S.guesses.length >= ATTEMPTS_MAX) {
    S.status = 'lost';
    S.msg = { type: 'bad', text: '😞 Было слово: ' + S.puzzle.answer };
    recordResult(false);
  } else {
    const left = ATTEMPTS_MAX - S.guesses.length;
    S.msg = { type: 'info', text: 'Не то… осталось ' + left + ' ' + plural(left, 'попытка', 'попытки', 'попыток') };
  }
  persist();
  c.input.value = '';
  render();
}

function recordResult(win) {
  if (S.mode === 'train') return;
  const entry = db.days[S.key];
  if (entry.counted) return;
  entry.counted = true;
  db.played++;
  if (win) {
    db.won++;
    db.dist[S.guesses.length] = (db.dist[S.guesses.length] || 0) + 1;
  }
  if (S.key === todayKey()) {
    if (win) {
      if (db.lastWinDate === yesterdayKey()) db.streak++;
      else if (db.lastWinDate !== todayKey()) db.streak = 1;
      db.lastWinDate = todayKey();
      if (db.streak > db.best) db.best = db.streak;
    } else {
      db.streak = 0;
    }
  }
  saveDB();
}

/* ---------- подсказки ---------- */
function useHint() {
  if (S.status !== 'playing') { toast('Загадка уже решена 😉'); return; }
  if (!S.hints.base) {
    S.hints.base = true; persist(); render();
    return;
  }
  if (!S.hints.letter) { openAd(); return; }
}
function grantLetterHint() {
  S.hints.letter = true; persist(); render();
}

/* ---------- «реклама» (демо rewarded-видео) ---------- */
let adTimer = null;
function openAd() {
  $('modalAd').classList.add('open');
  const btn = $('adCloseBtn');
  btn.disabled = true;
  let t = 3;
  btn.textContent = 'Подождите… ' + t;
  clearInterval(adTimer);
  adTimer = setInterval(() => {
    t--;
    if (t <= 0) {
      clearInterval(adTimer);
      btn.disabled = false;
      btn.textContent = 'Забрать подсказку 🎁';
    } else btn.textContent = 'Подождите… ' + t;
  }, 1000);
}
$('adCloseBtn').addEventListener('click', () => {
  $('modalAd').classList.remove('open');
  clearInterval(adTimer);
  grantLetterHint();
  toast('Подсказка получена: первая буква ⬆️');
});

/* ---------- шеринг ---------- */
function shareText() {
  const ans = S.puzzle.answer.toUpperCase();
  const rows = S.guesses.map((g) => evaluate(g, ans)
    .map((s) => s === 'correct' ? '🟩' : s === 'present' ? '🟨' : '⬛').join('')).join('\n');
  const head = S.mode === 'train'
    ? '🧠 РебусДень · тренировка'
    : '🧠 РебусДень #' + dayNumber(dateOf(S.key)) +
      (S.key === todayKey() ? '' : ' (' + dateOf(S.key).toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' }) + ')');
  const tail = (S.status === 'won' ? S.guesses.length : 'X') + '/' + ATTEMPTS_MAX +
    (S.mode === 'train' ? '' : '   🔥 серия ' + db.streak);
  return head + '\n' + rows + '\n' + tail;
}
async function doShare(btn) {
  const text = shareText();
  if (S.status === 'playing') return;
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { /* отменено — пробуем буфер */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Результат скопирован — вставь друзьям! 📋');
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Результат скопирован! 📋'); }
    catch (e2) { toast('Не удалось скопировать'); }
    document.body.removeChild(ta);
  }
  if (btn) btn.blur();
}

/* ---------- конструктор: свой ребус и челлендж другу ---------- */
/* Группы «картинка + слово» строятся из проверенного пула: комбинации
   в конструкторе нельзя собрать нерешаемые. */
const BASE_GROUPS = (() => {
  const map = new Map();
  PUZZLES.forEach((p) => {
    const key = p.emoji + '|' + p.base;
    if (!map.has(key)) map.set(key, { emoji: p.emoji, base: p.base, forms: [] });
    map.get(key).forms.push(p);
  });
  return Array.from(map.values());
})();
let builder = { group: 0, form: 0 };

function signLabel(p) {
  switch (p.sign) {
    case 'reverse':   return '⟲ наоборот';
    case 'del-first': return '«,» слева';
    case 'del-last':  return '«,» справа';
    case 'add-first': return '↑ «' + p.letter + '»';
    case 'add-last':  return '↓ «' + p.letter + '»';
  }
  return '?';
}
function builderForm() {
  const g = BASE_GROUPS[builder.group];
  return g.forms[Math.min(builder.form, g.forms.length - 1)];
}
function renderBuilder() {
  const picker = $('emojiPicker');
  picker.innerHTML = '';
  BASE_GROUPS.forEach((g, i) => {
    const b = document.createElement('button');
    b.className = 'chip-emoji' + (i === builder.group ? ' on' : '');
    b.innerHTML = '<span>' + g.emoji + '</span><small>' + g.base + '</small>';
    b.addEventListener('click', () => { builder = { group: i, form: 0 }; renderBuilder(); });
    picker.appendChild(b);
  });

  const signs = $('signPicker');
  signs.innerHTML = '';
  BASE_GROUPS[builder.group].forms.forEach((f, i) => {
    const b = document.createElement('button');
    b.className = 'chip-sign' + (i === builder.form ? ' on' : '');
    b.textContent = signLabel(f);
    b.addEventListener('click', () => { builder.form = i; renderBuilder(); });
    signs.appendChild(b);
  });

  const form = builderForm();
  $('builderPicture').innerHTML = pictureHTML(form);
  $('builderAnswer').innerHTML =
    'Ответ для тебя: <b>' + form.answer + '</b>' +
    '<span class="ahint">💡 ' + form.hint + '</span>';
  $('builderCount').textContent = PUZZLES.length + ' комбинаций · ' + BASE_GROUPS.length + ' картинок';
}

function challengeText(p) {
  let line;
  if (p.sign === 'reverse') line = p.emoji + ' ⟲';
  else if (p.sign === 'del-first') line = p.emoji + ' «,» слева';
  else if (p.sign === 'del-last') line = p.emoji + ' «,» справа';
  else if (p.sign === 'add-first') line = p.emoji + ' + буква «' + p.letter + '» сверху';
  else line = p.emoji + ' + буква «' + p.letter + '» снизу';
  return '🧩 Ребус от меня:\n' + line + ' — слово из ' + p.answer.length + ' букв.\n' +
    'Правила: «,» убирает букву, буква сверху/снизу добавляет её, ⟲ — читай справа налево.\n' +
    'Угадаешь? 😉';
}
async function doShareChallenge() {
  const text = challengeText(builderForm());
  if (navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { /* отменено */ }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Челлендж скопирован — вставь другу! 📋');
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Челлендж скопирован! 📋'); } catch (e2) { toast('Не удалось скопировать'); }
    document.body.removeChild(ta);
  }
}
function forceTrain(p) {
  db.train = { puzzleId: p.id, guesses: [], status: 'playing', hints: {} };
  saveDB();
  openTrain(false);
}

/* ---------- архив ---------- */
function renderArchive() {
  const list = $('archiveList');
  list.innerHTML = '';
  const now = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = keyOf(d);
    const p = puzzleForDate(d);
    const e = db.days[key];
    const done = e && e.status !== 'playing';
    const item = document.createElement('div');
    item.className = 'arch-item';
    let badge;
    if (!e || e.status === 'playing') {
      const tries = e ? e.guesses.length : 0;
      badge = '<div class="arch-badge open">' + (tries ? tries + '/5 ⏳' : 'открыт') + '</div>';
    } else if (e.status === 'won') {
      badge = '<div class="arch-badge won">✅ ' + e.guesses.length + '/5</div>';
    } else {
      badge = '<div class="arch-badge">❌ X/5</div>';
    }
    item.innerHTML =
      '<div class="arch-emoji">' + p.emoji + '</div>' +
      '<div class="arch-main"><b>#' + dayNumber(d) + ' · ' + p.answer.length + ' букв</b>' +
      '<span>' + d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' }) + '</span></div>' +
      badge;
    item.addEventListener('click', () => {
      activateTab('daily');
      openDaily(key);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    list.appendChild(item);
  }
  if (!list.children.length) list.innerHTML = '<p class="muted">Архив появится завтра — сегодня первый день. 🗓</p>';
}

/* ---------- статистика ---------- */
function renderStats() {
  $('stPlayed').textContent = db.played;
  $('stWon').textContent = db.won;
  $('stStreak').textContent = db.streak;
  $('stBest').textContent = db.best;
  const dist = $('dist');
  dist.innerHTML = '';
  const max = Math.max(1, ...Object.values(db.dist));
  for (let i = 1; i <= ATTEMPTS_MAX; i++) {
    const v = db.dist[i] || 0;
    const row = document.createElement('div');
    row.className = 'dist-row';
    row.innerHTML = '<span>' + i + '</span><div class="dist-bar"><div class="dist-fill" style="width:' +
      (v / max * 100) + '%"></div></div><b>' + v + '</b>';
    dist.appendChild(row);
  }
}

/* ---------- эффекты ---------- */
let toastTimer = null;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function confetti() {
  const layer = $('confetti');
  const colors = ['#7c5cff', '#ffb648', '#3ecf7a', '#ff5f74', '#6fd8ff', '#ff8ab5'];
  for (let i = 0; i < 70; i++) {
    const el = document.createElement('div');
    el.className = 'confetti';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.background = colors[i % colors.length];
    el.style.animationDuration = (2.2 + Math.random() * 1.8) + 's';
    el.style.animationDelay = (Math.random() * .5) + 's';
    el.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
    if (Math.random() > .5) el.style.borderRadius = '50%';
    layer.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }
}

/* ---------- вкладки и модалки ---------- */
function activateTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
  if (name === 'archive') renderArchive();
  if (name === 'train') openTrain(false);
  if (name === 'builder') renderBuilder();
  if (name === 'daily' && (!S || S.mode === 'train' || S.key !== todayKey())) openDaily(todayKey());
}

/* ---------- события ---------- */
document.querySelectorAll('.tab').forEach((t) =>
  t.addEventListener('click', () => activateTab(t.dataset.tab)));

dailyCtx.form.addEventListener('submit', submitGuess);
trainCtx.form.addEventListener('submit', submitGuess);
[dailyCtx.input, trainCtx.input].forEach((inp) => {
  inp.addEventListener('input', () => {
    inp.value = inp.value.replace(/[^а-яёА-ЯЁ]/g, '').toUpperCase();
    S.msg = null; renderStatus(ctx());
  });
  inp.addEventListener('focus', () => inp.select());
});

$('btnHint').addEventListener('click', useHint);
$('trainHintBtn').addEventListener('click', useHint);
$('btnShare').addEventListener('click', (e) => doShare(e.currentTarget));
$('trainShareBtn').addEventListener('click', (e) => doShare(e.currentTarget));

/* карточка-результат (PNG) */
function makeCard() {
  const dayNo = S.mode === 'train' ? 0 : dayNumber(dateOf(S.key));
  return {
    puzzle: S.puzzle, guesses: S.guesses, status: S.status,
    dayNo: S.mode === 'train' ? 'тренировка' : dayNo,
    streak: db.streak, max: ATTEMPTS_MAX,
  };
}
function cardDone(kind) {
  if (kind === 'save') toast('Карточка сохранена — отправь её друзьям! 🖼');
  else if (kind === 'error') toast('Не удалось создать карточку 😔');
}
$('btnCard').addEventListener('click', () => shareCard(makeCard(), cardDone));
$('trainCardBtn').addEventListener('click', () => shareCard(makeCard(), cardDone));
$('trainNewBtn').addEventListener('click', () => { openTrain(true); toast('Новый ребус! 🎯'); });

/* конструктор */
$('builderRandom').addEventListener('click', () => {
  let g = builder.group;
  if (BASE_GROUPS.length > 1) while (g === builder.group) g = Math.floor(Math.random() * BASE_GROUPS.length);
  builder = { group: g, form: Math.floor(Math.random() * BASE_GROUPS[g].forms.length) };
  renderBuilder();
  toast('Случайный ребус готов 🎲');
});
$('builderPlay').addEventListener('click', () => {
  forceTrain(builderForm());
  activateTab('train');
  toast('Играй — а другу потом бросишь вызов!');
});
$('builderText').addEventListener('click', () => doShareChallenge());
$('builderCard').addEventListener('click', () =>
  shareCard({
    puzzle: builderForm(), guesses: [], status: 'playing',
    dayNo: 'личный', streak: db.streak, max: ATTEMPTS_MAX,
  }, (kind) => {
    if (kind === 'save') toast('Карточка-челлендж сохранена — отправь другу! 🖼');
    else if (kind === 'error') toast('Не удалось создать карточку 😔');
  }));

$('btnHelp').addEventListener('click', () => $('modalRules').classList.add('open'));
$('linkRules').addEventListener('click', () => $('modalRules').classList.add('open'));
$('btnStats').addEventListener('click', () => { renderStats(); $('modalStats').classList.add('open'); });
document.querySelectorAll('[data-close]').forEach((b) =>
  b.addEventListener('click', () => b.closest('.modal').classList.remove('open')));
document.querySelectorAll('.modal').forEach((m) =>
  m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('open'); }));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal.open').forEach((m) => m.classList.remove('open'));
});

/* ---------- старт ---------- */
openDaily(todayKey());

/* ---------- офлайн-режим (PWA) ---------- */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
