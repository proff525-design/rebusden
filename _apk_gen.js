/* Генерация Android TWA-проекта из живого web-манифеста (обход интерактивного `bubblewrap init`) */
const NPM = 'C:/Users/ASD/AppData/Roaming/npm/node_modules/@bubblewrap/cli';
const core = require(NPM + '/node_modules/@bubblewrap/core');
const shared = require(NPM + '/dist/lib/cmds/shared.js');

const MANIFEST_URL = 'https://proff525-design.github.io/rebusden/manifest.webmanifest';
const TARGET = __dirname.replace(/\\/g, '/') + '/apk';

const prompt = { printMessage: (m) => console.log(String(m)) };

(async () => {
  console.log('Читаю веб-манифест:', MANIFEST_URL);
  const twa = await core.TwaManifest.fromWebManifest(MANIFEST_URL);

  twa.packageId = 'com.proff525design.rebusden';
  twa.launcherName = 'РебусДень';
  twa.appVersionName = '1.0.0';
  twa.appVersionCode = 1;
  twa.minSdkVersion = 24;
  twa.enableNotifications = false;
  twa.generatorApp = 'bubblewrap-cli';
  twa.signingKey = { path: TARGET + '/android.keystore', alias: 'android' };

  const err = twa.validate();
  if (err) throw new Error('Манифест невалиден: ' + err);

  console.log('host:', twa.host, '| startUrl:', twa.startUrl);
  console.log('icon:', twa.iconUrl);
  console.log('maskable:', twa.maskableIconUrl);
  console.log('name:', twa.name, '| launcher:', twa.launcherName, '| packageId:', twa.packageId);

  await twa.saveToFile(TARGET + '/twa-manifest.json');
  console.log('twa-manifest.json записан');

  const gen = new core.TwaGenerator();
  await shared.generateTwaProject(prompt, gen, TARGET, twa);
  await shared.generateManifestChecksumFile(TARGET + '/twa-manifest.json', TARGET);
  console.log('Android-проект сгенерирован в apk/, checksum записан');
})().catch((e) => { console.error('ОШИБКА:', e.message || e); process.exit(1); });
