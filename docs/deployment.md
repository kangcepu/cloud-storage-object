# Deployment Windows dan Linux

Dokumen ini menjelaskan deployment native untuk API NestJS dan frontend Next.js. Gunakan Node.js 22 LTS (minimum Node.js 20 untuk Next.js 16), database MySQL/MariaDB, dan server MinIO/S3 yang dapat dijangkau dari server aplikasi.

## Konfigurasi bersama

1. Salin repository ke server dan buat `.env` dari `.env.example`.
2. Isi semua secret produksi (`DB_PASSWORD`, `APP_ENCRYPTION_KEY_BASE64`, dan `SESSION_SECRET`), endpoint CORS, serta `STORAGE_PATH` yang dapat ditulis oleh user service.
3. Jalankan `npm ci && npm run build` pada root untuk API. Pada `frontend`, salin `.env.example` menjadi `.env.local`, lalu jalankan `npm ci && npm run build`.
4. Konfigurasikan MinIO dari halaman Settings setelah API berjalan.

Jangan commit `.env`, `.env.local`, maupun direktori `storage/`.

## Dukungan RAW

Server harus dapat menjalankan ImageMagick dengan delegate `raw`/LibRaw. Periksa dengan:

```sh
magick -version
```

Output `Delegates` harus mencantumkan `raw`. Pada Linux, pasang ImageMagick dari repositori distribusi atau paket vendor yang dibangun dengan LibRaw. Bila executable tidak berada di `PATH`, set `IMAGE_MAGICK_BIN=/path/to/magick` di `.env`. Jangan set `IMAGE_MAGICK_CONFIG_PATH` untuk ImageMagick paket Linux kecuali vendor binary mengharuskannya.

Pada Windows, binary portable di `tools\imagemagick-portable\magick.exe` dipakai otomatis. Jika memasang ImageMagick sendiri, set `IMAGE_MAGICK_BIN=C:\Program Files\ImageMagick-7.1.2-Q16-HDRI\magick.exe`. Set `IMAGE_MAGICK_CONFIG_PATH` hanya bila binary tersebut memerlukan direktori konfigurasi nonstandar.

## Linux dengan systemd

Contoh ini menggunakan `/opt/cloud-storage` sebagai root aplikasi dan `/var/lib/cloud-storage` sebagai `STORAGE_PATH`.

```sh
sudo useradd --system --create-home --home-dir /var/lib/cloud-storage --shell /usr/sbin/nologin cloudstorage
sudo install -d -o cloudstorage -g cloudstorage /opt/cloud-storage /var/lib/cloud-storage
sudo cp deploy/linux/cloud-storage-api.service /etc/systemd/system/
sudo cp deploy/linux/cloud-storage-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cloud-storage-api cloud-storage-web
```

Sesuaikan `WorkingDirectory`, `ExecStart`, dan `EnvironmentFile` pada kedua unit bila lokasi aplikasi berbeda. Pastikan `.env` hanya dapat dibaca user `cloudstorage`. Letakkan reverse proxy TLS (misalnya Nginx atau Caddy) di depan port API `3000` dan frontend `3001`, lalu set `SESSION_SECURE=true`, `PUBLIC_BASE_URL`, dan `CORS_ORIGINS` ke URL HTTPS final.

Gunakan `journalctl -u cloud-storage-api -f` untuk memantau API. Jika preview RAW gagal, periksa `magick -version` dari user `cloudstorage`.

## Windows Server sebagai Windows Service

Jalankan PowerShell sebagai Administrator setelah build API dan frontend selesai. Contoh root aplikasi adalah `C:\cloud-storage`.

```powershell
Set-Location C:\cloud-storage
.\deploy\windows\install-services.ps1 -ApplicationRoot C:\cloud-storage
```

Script membuat dua layanan otomatis: `CloudStorageApi` dan `CloudStorageWeb`. Keduanya menjalankan Node dari instalasi yang tersedia di `PATH`, memulai dari root aplikasi yang benar, dan otomatis restart jika gagal. Masukkan `.env` API dan `frontend\.env.local` sebelum menjalankan script. Gunakan Windows service account dengan akses tulis ke `STORAGE_PATH`; untuk lokasi Windows gunakan path, misalnya `C:\cloud-storage\storage`.

Untuk menghapus layanan:

```powershell
.\deploy\windows\uninstall-services.ps1
```

Tempatkan IIS, Caddy, atau reverse proxy TLS lain di depan port 3000 dan 3001; aktifkan `SESSION_SECURE=true` setelah HTTPS digunakan.

## PM2 (Windows atau Linux)

PM2 menjalankan hasil build; proses build tetap menggunakan npm. Setelah `.env` API dan `frontend/.env.local` sudah dikonfigurasi, jalankan dari root project:

```sh
npm ci && npm run build
cd frontend && npm ci && npm run build && cd ..
npm install --global pm2
pm2 start ecosystem.config.cjs --env production
pm2 save
```

Konfigurasi [ecosystem.config.cjs](../ecosystem.config.cjs) menjalankan API pada port `3000` dan frontend pada port `3001`, serta melakukan restart otomatis saat proses gagal. Pada Linux, aktifkan pemulihan otomatis setelah reboot dengan `pm2 startup` lalu jalankan perintah yang dicetak PM2. Pada Windows, gunakan Windows Service yang telah disediakan di atas untuk pemulihan setelah reboot, atau buat Scheduled Task yang menjalankan `pm2 resurrect` saat startup.

Gunakan `pm2 logs`, `pm2 status`, dan `pm2 reload ecosystem.config.cjs --env production` untuk monitoring dan rollout ulang.

## Docker Compose (Linux atau Windows dengan Linux containers)

Docker build mencakup ImageMagick untuk preview RAW dan menyimpan cache/temporary preview ke named volume `cloud-storage-data`. Siapkan `.env` dari `.env.example`, lalu untuk Docker set setidaknya `STORAGE_PATH=/var/lib/cloud-storage`, URL CORS production, dan semua secret yang diperlukan.

```sh
cp .env.example .env
# Edit .env: DB_*, APP_ENCRYPTION_KEY_BASE64, SESSION_SECRET, CORS_ORIGINS, dan PUBLIC_BASE_URL
docker compose up --build -d
docker compose ps
docker compose logs -f api
```

Frontend container meneruskan `/api` dan `/media` ke service `api` internal; akses host tersedia pada `http://localhost:3001`, sedangkan API tersedia pada port `3000`. Untuk deploy ulang gunakan `docker compose up --build -d`; untuk menghentikan service gunakan `docker compose down`. Named volume tidak dihapus oleh `down`, tetapi akan dihapus oleh `docker compose down --volumes`.

Pada Windows gunakan Docker yang berjalan dalam mode Linux containers. Untuk PowerShell, buat konfigurasi awal dengan `Copy-Item .env.example .env` sebelum menjalankan `docker compose up --build -d`.
