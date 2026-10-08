# Cloud Storage

Backend NestJS dan frontend Next.js untuk database dan MinIO Enterprise S3 Storage Manager.

## Menjalankan backend

```powershell
npm ci
npm run build
npm run start
```

Konfigurasi runtime dibaca dari `.env`. File `.env.example` berisi daftar variable yang dibutuhkan tanpa credential produksi.

Backend berjalan pada `http://localhost:6000`.

## Menjalankan frontend

```powershell
cd frontend
Copy-Item .env.example .env.local # PowerShell di Windows
npm ci
npm run build
npm run dev
```

Frontend berjalan pada `http://localhost:6001`. Request `/api` dan `/media` diteruskan oleh Next.js ke backend sesuai `BACKEND_URL`.

Frontend mencakup login, home, drive, bucket dan permission, users, settings, profile, serta seluruh operasi file yang tersedia di REST API.

## Preview file RAW

Preview RAW (CR2, CR3, NEF, ARW, DNG, RAF, RW2, ORF, SRW, PEF, 3FR, SR2, dan MRW) memakai ImageMagick dengan dukungan RAW/LibRaw.

- **Windows:** aplikasi otomatis memakai `tools\imagemagick-portable\magick.exe` yang disertakan dalam repository. Binary ini membawa LibRaw, sehingga tidak perlu memasang `dcraw` atau mengubah `PATH`.
- **Linux:** aplikasi memakai perintah `magick` dari `PATH`, sehingga instal ImageMagick yang memiliki delegate `raw`/LibRaw. Konfigurasi ImageMagick bawaan sistem tidak lagi ditimpa oleh konfigurasi portable Windows.
- **Override:** isi `IMAGE_MAGICK_BIN` dengan path executable ImageMagick. Bila binary membutuhkan folder konfigurasi sendiri, isi juga `IMAGE_MAGICK_CONFIG_PATH`.

Lihat [panduan deployment Windows dan Linux](docs/deployment.md) untuk service production, variabel environment, serta pemeriksaan dukungan RAW.

## Endpoint utama

- `GET /api/health`
- `GET /api/auth/csrf`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/change-password`
- `POST /api/profile/avatar`
- `GET|POST /api/users`
- `GET|PUT|DELETE /api/users/:id`
- `POST /api/users/:id/reset-password`
- `GET|POST /api/buckets`
- `GET|PUT|DELETE /api/buckets/:bucket`
- `POST /api/buckets/:bucket/assign-user`
- `GET /api/buckets/:bucket/files`
- `POST /api/buckets/:bucket/upload`
- `POST /api/buckets/:bucket/folders`
- `GET /api/buckets/:bucket/files/preview`
- `GET /api/buckets/:bucket/files/download`
- `GET /api/buckets/:bucket/files/proxy`
- `PUT /api/buckets/:bucket/files/rename`
- `DELETE /api/buckets/:bucket/files/delete`
- `POST /api/buckets/:bucket/files/copy`
- `POST /api/buckets/:bucket/files/move`
- `GET /api/dashboard/summary`
- `GET|PUT /api/settings`
- `PUT /api/settings/app`
- `PUT /api/settings/minio`
- `POST /api/settings/minio/test`
- `POST /api/settings/app/logo`
- `POST /api/settings/app/favicon`

Endpoint kompatibilitas mobile tetap tersedia pada `/api/login`, `/api/logout`, `/api/overview`, `/api/drive`, `/api/folder`, `/api/upload`, `/api/download-zip`, `/api/proxy`, `/api/raw/prepare`, dan `/api/public/settings`.

Endpoint web memakai session cookie dan CSRF token. Ambil token melalui `GET /api/auth/csrf`, lalu kirim sebagai header `X-CSRF-Token` pada request mutasi. Endpoint mobile memakai bearer token.
