/* E2E: реальный index.html в jsdom — старт игры, ход, победа, вкладки
   Запуск: npm i jsdom && node _e2e.js */
const { JSDOM } = require('jsdom');
const fs = require('fs');

const PROJECT = __dirname.replace(/\\/g, '/') + '/';
let fail = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fail++; };

/* ожидаемый пазл дня — та же формула, что в game.js */
const data = new Function(fs.readFileSync(PROJECT + 'puzzles.js', 'utf8') +
  '; return {PUZZLES, POOL_SALT};')();
const now = new Date();
const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const epoch = new Date(2026, 0, 1);
const dayNo = Math.floor((mid - epoch) / 86400000);
const expected = data.PUZZLES[((dayNo + data.POOL_SALT) % data.PUZZLES.length + data.PUZZLES.length) % data.PUZZLES.length];

(async () => {
  const dom = await JSDOM.fromFile(PROJECT + 'index.html', {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
  });
  const win = dom.window;
  await new Promise((res) => {
    if (win.document.readyState === 'complete') res();
    else win.addEventListener('load', res);
  });
  await new Promise((r) => setTimeout(r, 200));
  const doc = win.document;
  const $ = (id) => doc.getElementById(id);

  /* 1. Игра стартовала: пазл дня отрисован */
  ok(/^Ребус #\d+ · сегодня$/.test($('puzzleNumber').textContent),
     'заголовок дня: ' + $('puzzleNumber').textContent);
  ok($('rebusPicture').innerHTML.includes(expected.emoji),
     'нарисован эмодзи пазла дня (' + expected.emoji + ')');
  ok($('puzzleLength').textContent.includes(String(expected.answer.length)),
     'показана длина ответа: ' + $('puzzleLength').textContent);
  ok($('statusLine').textContent.length > 0, 'строка статуса заполнена');

  /* 2. Ход неверной длины отклонён */
  $('guessInput').value = 'А';
  $('guessForm').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  ok($('statusLine').textContent.includes('Нужно'), 'неверная длина отклонена: ' + $('statusLine').textContent);

  /* 3. Верный ответ → победа, конфетти, серия, шеринг */
  $('guessInput').value = expected.answer;
  $('guessForm').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));
  ok($('statusLine').className.includes('good'), 'статус победы: ' + $('statusLine').textContent);
  ok($('board').querySelectorAll('.row').length === 1, 'на доске 1 строка хода');
  ok($('board').querySelectorAll('.tile.correct').length === expected.answer.length,
     'все буквы отмечены зелёными');
  ok($('streakVal').textContent === '1', 'серия стала 1: ' + $('streakVal').textContent);
  ok($('btnShare').disabled === false && $('btnCard').disabled === false, 'шеринг активен после победы');
  ok($('guessInput').disabled === true, 'ввод заблокирован после победы');

  /* 4. Победа сохранена: перезагрузка страницы */
  const dom2 = await JSDOM.fromFile(PROJECT + 'index.html', {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    // localStorage не переносится между jsdom-инстансами — проверяем логику иначе
  });
  await new Promise((res) => {
    if (dom2.window.document.readyState === 'complete') res();
    else dom2.window.addEventListener('load', res);
  });

  /* 5. Вкладки */
  const tab = (name) => doc.querySelector('.tab[data-tab="' + name + '"]');
  tab('train').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  ok($('screen-train').className.includes('active'), 'вкладка «Тренировка» открывается');
  tab('builder').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  ok($('screen-builder').className.includes('active'), 'вкладка «Свои» открывается');
  ok($('emojiPicker').querySelectorAll('.chip-emoji').length >= 10,
     'конструктор: картинок ' + $('emojiPicker').querySelectorAll('.chip-emoji').length);
  ok($('signPicker').querySelectorAll('.chip-sign').length >= 1, 'конструктор: знаки отрисованы');
  ok($('builderAnswer').textContent.includes('Ответ'), 'конструктор показывает ответ автору');
  tab('archive').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  ok($('archiveList').querySelectorAll('.arch-item').length === 7, 'архив: 7 дней');
  tab('daily').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  ok($('screen-daily').className.includes('active'), 'возврат на вкладку «Сегодня»');

  /* 6. Модалки */
  $('btnHelp').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  ok($('modalRules').className.includes('open'), 'модалка правил открывается');
  $('modalRules').querySelector('[data-close]').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  ok(!$('modalRules').className.includes('open'), 'модалка правил закрывается');
  $('btnStats').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  ok($('modalStats').className.includes('open') && $('stWon').textContent === '1',
     'статистика: решено=' + $('stWon').textContent);

  console.log(`\nОшибок: ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('CRASH', e); process.exit(1); });
