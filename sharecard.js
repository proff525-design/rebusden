/* ==========================================================
   РебусДень — карточка результата (PNG) для шеринга
   Рисует на canvas: ребус дня, сетку попыток, серию.
   ========================================================== */
'use strict';

const CARD = {
  size: 1000,
  fontUI: '"Segoe UI", -apple-system, Roboto, Arial, sans-serif',
  fontEmoji: '"Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", sans-serif',
};

function rr(x, px, py, w, h, r) {  // roundRect с фолбэком
  x.beginPath();
  if (x.roundRect) { x.roundRect(px, py, w, h, r); return; }
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}

function drawShareCard(opts) {
  const { puzzle, guesses, status, dayNo, streak, max } = opts;
  const S = CARD.size;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const x = cv.getContext('2d');

  /* фон */
  const bg = x.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, '#0d1026');
  bg.addColorStop(.55, '#1b1447');
  bg.addColorStop(1, '#33207a');
  x.fillStyle = bg;
  x.fillRect(0, 0, S, S);
  const glow = x.createRadialGradient(S * .8, S * .12, 10, S * .8, S * .12, 460);
  glow.addColorStop(0, 'rgba(124,92,255,.45)');
  glow.addColorStop(1, 'rgba(124,92,255,0)');
  x.fillStyle = glow;
  x.fillRect(0, 0, S, S);

  x.textAlign = 'center';

  /* заголовок */
  x.fillStyle = '#eef0ff';
  x.font = '800 58px ' + CARD.fontUI;
  x.fillText('🧠 РебусДень', S / 2, 105);
  const isNum = /^\d+$/.test(String(dayNo));
  x.fillStyle = '#ffb648';
  x.font = '700 34px ' + CARD.fontUI;
  x.fillText(isNum ? 'ребус #' + dayNo
    : (String(dayNo) === 'тренировка' ? 'тренировочный ребус' : 'личный ребус — угадай'), S / 2, 155);

  /* карточка ребуса */
  const cx = 150, cy = 200, cw = 700, ch = 290;
  rr(x, cx, cy, cw, ch, 36);
  x.fillStyle = 'rgba(255,255,255,.06)';
  x.fill();
  x.strokeStyle = 'rgba(255,255,255,.14)';
  x.lineWidth = 2;
  x.stroke();

  const ex = S / 2, ey = cy + ch / 2 + 25;
  x.font = '150px ' + CARD.fontEmoji;
  x.fillStyle = '#ffffff';
  x.fillText(puzzle.emoji, ex, ey);

  x.fillStyle = '#ffb648';
  x.textAlign = 'left';
  if (puzzle.sign === 'del-first') { x.font = '700 96px ' + CARD.fontUI; x.fillText(',', cx + 78, ey - 12); }
  if (puzzle.sign === 'del-last')  { x.font = '700 96px ' + CARD.fontUI; x.fillText(',', cx + cw - 108, ey - 12); }
  if (puzzle.sign === 'add-first') { x.font = '800 64px ' + CARD.fontUI; x.fillText(puzzle.letter, ex - 24, cy + 68); }
  x.textAlign = 'center';
  if (puzzle.sign === 'add-last') { x.font = '800 64px ' + CARD.fontUI; x.fillStyle = '#6fd8ff'; x.fillText(puzzle.letter, ex, cy + ch - 34); }
  if (puzzle.sign === 'reverse') {
    x.fillStyle = '#6fd8ff';
    x.font = '700 54px ' + CARD.fontUI;
    x.fillText('↻', cx + cw - 78, cy + 78);
    x.strokeStyle = '#6fd8ff99';
    x.lineWidth = 3;
    x.setLineDash([8, 7]);
    x.beginPath(); x.arc(cx + cw - 78, cy + 56, 38, 0, Math.PI * 2); x.stroke();
    x.setLineDash([]);
  }

  /* сетка попыток */
  const ans = puzzle.answer.toUpperCase();
  const rows = guesses.length;
  const tileSize = 96, gap = 12;
  const gridW = puzzle.answer.length * tileSize + (puzzle.answer.length - 1) * gap;
  const startX = (S - gridW) / 2;
  let gy = cy + ch + 60;

  for (let r = 0; r < rows; r++) {
    const g = guesses[r];
    const states = evalGuess(g, ans);
    for (let i = 0; i < puzzle.answer.length; i++) {
      const px = startX + i * (tileSize + gap);
      rr(x, px, gy, tileSize, tileSize, 14);
      if (states[i] === 'correct')      { x.fillStyle = '#3ecf7a'; }
      else if (states[i] === 'present') { x.fillStyle = '#ffc94a'; }
      else                              { x.fillStyle = 'rgba(255,255,255,.09)'; }
      x.fill();
      x.fillStyle = states[i] === 'correct' ? '#052b16'
                  : states[i] === 'present' ? '#3b2a00' : '#8b90b8';
      x.font = '800 46px ' + CARD.fontUI;
      x.fillText(g[i] || '', px + tileSize / 2, gy + 64);
    }
    gy += tileSize + gap;
  }

  /* итог */
  gy += 34;
  const challenge = status === 'playing';   // карточка-челлендж: ответ не показываем!
  const solved = status === 'won';
  if (challenge) {
    x.fillStyle = '#ffd79a';
    x.font = '700 40px ' + CARD.fontUI;
    x.fillText(puzzle.answer.length + ' букв — угадаешь?', S / 2, gy);
  } else {
    x.fillStyle = solved ? '#3ecf7a' : '#ff5f74';
    x.font = '800 46px ' + CARD.fontUI;
    x.fillText(solved ? '✅ ' + guesses.length + '/' + max + ' попыток' : '❌ было: ' + ans, S / 2, gy);
    x.fillStyle = '#ffd79a';
    x.font = '700 34px ' + CARD.fontUI;
    x.fillText('🔥 серия ' + streak, S / 2, gy + 56);
  }

  x.fillStyle = '#9aa0c7';
  x.font = '600 30px ' + CARD.fontUI;
  x.fillText('один ребус в день — на всю планету. Угадаешь быстрее?', S / 2, S - 55);

  return cv;
}

/* та же оценка букв, что и в игре (дубль, чтобы файл был самодостаточным) */
function evalGuess(guess, answer) {
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

/* сохранить / отправить карточку */
async function shareCard(opts, onDone) {
  try {
    const cv = drawShareCard(opts);
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    const file = new File([blob], 'rebusden-' + opts.dayNo + '.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: 'РебусДень #' + opts.dayNo });
      if (onDone) onDone('share');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rebusden-' + opts.dayNo + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    if (onDone) onDone('save');
  } catch (e) {
    if (onDone) onDone('error');
  }
}
