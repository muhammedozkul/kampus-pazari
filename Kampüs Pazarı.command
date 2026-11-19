#!/bin/bash
# Çift tıkla: gerekirse paketleri kurar, arayüzü derler, sunucuyu başlatır ve tarayıcıda açar.
# Kapatmak için bu pencereyi kapat ya da Ctrl+C.
cd "$(dirname "$0")"
PORT=8776
if lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  open "http://127.0.0.1:$PORT/"
  exit 0
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js bulunamadı. https://nodejs.org adresinden Node 24 ya da üstünü kur."
  read -r -p "Kapatmak için Enter'a bas..."
  exit 1
fi
[ -d node_modules ] || npm install || exit 1
# Kaynak dosyalar derlenmiş arayüzden yeniyse yeniden derle.
if [ ! -f dist/index.html ] || [ -n "$(find istemci ortak -newer dist/index.html -type f 2>/dev/null | head -1)" ]; then
  npm run build || exit 1
fi
[ -f veri/pazar.db ] || npm run demo
npm start -- --tarayici
