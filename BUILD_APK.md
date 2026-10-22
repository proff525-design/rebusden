# Сборка Android APK (TWA) для РебусДень

APK собирается из **живого PWA** (https://proff525-design.github.io/rebusden/) как
Trusted Web Activity через Bubblewrap (Google). Android-проект и `android.keystore`
в репозиторий не коммитятся (см. `.gitignore`), а сам APK хранится через Git LFS.

## Что нужно для сборки
- JDK 17 (`JAVA_HOME` указывает на него)
- Android SDK: `platform-tools`, `platforms;android-36`, `build-tools;36.1.0`
- `npm i -g @bubblewrap/cli`
- Конфиг `~/.bubblewrap/config.json`:
  `{"jdkPath":"...","androidSdkPath":".../Android/Sdk"}`

## Пошагово
1. `node _icons.js` — PNG-иконки из `icon.svg` (512 / 192 / maskable 512).
   Затем закоммитить и запушить, дождаться сборки GitHub Pages (иконки должны
   отдаваться по URL — Bubblewrap и TWA их скачивают).
2. Создать keystore (один раз):
   `keytool -genkeypair -keystore apk/android.keystore -alias android -keyalg RSA -keysize 2048 -validity 10000 -storepass <пароль> -keypass <пароль> -dname "CN=RebusDen, O=RebusDen, C=RU"`
3. `node _apk_gen.js` — читает живой `manifest.webmanifest` и генерирует
   Android-проект в `apk/` (обходит интерактивный `bubblewrap init`).
4. В `apk/gradle.properties` дописать `android.overridePathCheck=true`
   (путь проекта содержит не-ASCII символы), а в `apk/local.properties` —
   `sdk.dir=<путь к SDK>`.
5. Собрать, выровнять и подписать:
   - `cd apk && gradlew.bat --no-daemon assembleRelease`
   - `zipalign -p -f 4 in.apk aligned.apk`
   - `apksigner sign --ks apk/android.keystore --ks-key-alias android --out rebusden-1.0.0.apk aligned.apk`
6. Поднять `assetlinks.json` в **корне** хоста
   (`proff525-design.github.io/.well-known/assetlinks.json`) с SHA-256 подписи —
   это скрывает адресную строку (полноэкранная TWA). Репозиторий корня:
   `proff525-design.github.io`.

Скрипт для шага 5: `./build_apk.ps1 <пароль keystore> [версия]`.
