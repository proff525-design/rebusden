param(
  [Parameter(Mandatory = $true)][string]$KeystorePassword,
  [string]$Version = "1.0.0",
  [string]$Alias = "android"
)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$apkDir = Join-Path $root "apk"
$bt = Join-Path $env:LOCALAPPDATA "Android\Sdk\build-tools\36.1.0"
$env:BUBBLEWRAP_KEYSTORE_PASSWORD = $KeystorePassword
$env:BUBBLEWRAP_KEY_PASSWORD = $KeystorePassword

Write-Host "== gradle assembleRelease =="
Push-Location $apkDir
& ".\gradlew.bat" --no-daemon assembleRelease
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "gradle failed: $LASTEXITCODE" }
Pop-Location

$rel = Join-Path $apkDir "app\build\outputs\apk\release"
$unsigned = Join-Path $rel "app-release-unsigned.apk"
$aligned = Join-Path $rel "aligned.apk"
$out = Join-Path $root "РебусДень-$Version.apk"

Write-Host "== zipalign =="
& (Join-Path $bt "zipalign.exe") -p -f 4 $unsigned $aligned
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

Write-Host "== apksigner =="
& (Join-Path $bt "apksigner.bat") sign --ks (Join-Path $apkDir "android.keystore") `
  --ks-key-alias $Alias --ks-pass "pass:$KeystorePassword" --key-pass "pass:$KeystorePassword" `
  --out $out $aligned
if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }

Write-Host "== verify =="
& (Join-Path $bt "apksigner.bat") verify --print-certs $out | Select-String "SHA-256|Verified using v2|Verified using v3"
Write-Host "ГОТОВО: $out ($([math]::Round((Get-Item $out).Length/1MB,2)) МБ)"
