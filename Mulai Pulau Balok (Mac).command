#!/bin/bash
# Pulau Balok - jalankan di WiFi rumah (macOS). Klik dua kali file ini.
# Server ini menyimpan data semua pemain (SQLite) dan membuat anak-anak bisa main bersama.
cd "$(dirname "$0")"
# server Pulau Balok sudah berjalan? jangan buat server kedua (dua server = dua dunia terpisah)
for P in 8080 8081 8082 8083; do
  if curl -s --max-time 1 "http://localhost:$P/info" 2>/dev/null | grep -q '"https"'; then
    IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
    echo ""
    echo "  Pulau Balok SUDAH berjalan. Tidak perlu dijalankan lagi."
    echo "  Buka di semua HP / tablet:  http://${IP:-localhost}:$P"
    echo ""
    open "http://localhost:$P"
    read -n 1 -s -r -t 15 -p "  (Jendela ini boleh ditutup.)"
    exit 0
  fi
done
PORT=8080
while lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT+1)); done
clear
(sleep 2; open "http://localhost:$PORT") &
if xcode-select -p >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then
  exec caffeinate -i python3 server.py "$PORT"
elif command -v ruby >/dev/null 2>&1; then
  echo ""
  echo "  Python 3 belum ada, jadi game berjalan dalam MODE SENDIRI"
  echo "  (tanpa main bersama, data hanya di masing-masing perangkat)."
  echo "  Untuk main bersama, pasang Python dengan perintah:  xcode-select --install"
  echo ""
  IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
  echo "  Buka di HP / tablet:  http://${IP:-localhost}:$PORT"
  exec caffeinate -i ruby -run -e httpd . -p "$PORT" 2>/dev/null
else
  echo "  Tidak menemukan Python atau Ruby."
  echo "  Pasang dulu dengan perintah:  xcode-select --install"
  read -n 1 -s -r -p "  Tekan tombol apa saja untuk menutup..."
fi
