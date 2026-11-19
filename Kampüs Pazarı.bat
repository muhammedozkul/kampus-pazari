@echo off
chcp 65001 >nul
rem Kampüs Pazarı - Windows açılış dosyası.
rem Çift tıkla: gerekirse paketleri kurar, arayüzü derler, sunucuyu başlatır ve tarayıcıda açar.
rem Kapatmak için bu pencereyi kapat ya da Ctrl+C'ye bas.

cd /d "%~dp0"
set "PORT=8776"
set "ADRES=http://127.0.0.1:%PORT%/"

rem Port doluysa sunucu büyük olasılıkla zaten çalışıyordur: yalnız tarayıcıyı aç.
netstat -ano | findstr /r /c:":%PORT% .*LISTENING" >nul
if not errorlevel 1 (
  echo Kampüs Pazarı zaten çalışıyor: %ADRES%
  start "" "%ADRES%"
  exit /b 0
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadı.
  echo https://nodejs.org adresinden Node.js 24 ya da daha yenisini kur, sonra bu dosyaya yeniden çift tıkla.
  pause
  exit /b 1
)

rem Node 24 ve üstü gerekir: TypeScript'i doğrudan çalıştırma ve yerleşik SQLite bu sürümlerde var.
for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set "NODE_ANA=%%v"
if %NODE_ANA% LSS 24 (
  echo Node.js sürümün eski: v%NODE_ANA%. Kampüs Pazarı için Node.js 24 ya da daha yenisi gerekir.
  echo https://nodejs.org adresinden güncel sürümü kur ve yeniden dene.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Paketler kuruluyor, ilk seferde birkaç dakika sürebilir...
  call npm install
  if errorlevel 1 (
    echo Paketler kurulamadı. İnternet bağlantını kontrol et.
    pause
    exit /b 1
  )
)

rem Arayüz hiç derlenmemişse ya da kaynak dosyalar derlenmiş halinden yeniyse yeniden derle.
node -e "const fs=require('fs'),p=require('path');const d='dist/index.html';if(!fs.existsSync(d))process.exit(1);const t=fs.statSync(d).mtimeMs;const yeni=(k)=>fs.readdirSync(k,{withFileTypes:true}).some((e)=>{const y=p.join(k,e.name);return e.isDirectory()?yeni(y):fs.statSync(y).mtimeMs>t;});process.exit(yeni('istemci')||yeni('ortak')?1:0);"
if errorlevel 1 (
  call npm run build
  if errorlevel 1 (
    pause
    exit /b 1
  )
)

if not exist veri\pazar.db call npm run demo

echo.
echo Kampüs Pazarı başlatılıyor: %ADRES%
echo Siteyi kullandığın sürece bu pencere açık kalmalı.
echo.
call npm start -- --tarayici
if errorlevel 1 pause
