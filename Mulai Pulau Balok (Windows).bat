@echo off
cd /d "%~dp0"
set PORT=8080
rem server sudah berjalan? jangan buat server kedua
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://localhost:8080/info; if ($r.Content -match 'https') { exit 0 } else { exit 1 } } catch { exit 1 }" && (echo  Pulau Balok SUDAH berjalan. & start "" http://localhost:%PORT% & goto :eof)
echo.
echo  Jika Windows bertanya soal Firewall, pilih "Private networks" lalu Allow.
echo.
start "" http://localhost:%PORT%
where py >nul 2>nul && (py server.py %PORT% & goto :eof)
where python >nul 2>nul && (python server.py %PORT% & goto :eof)
echo  Python belum terpasang. Pasang dari Microsoft Store (cari "Python 3"), lalu jalankan lagi.
pause
