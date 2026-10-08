# Cloud Storage

Backend NestJS dan frontend Next.js untuk database dan MinIO Enterprise S3 Storage Manager.

## Menjalankan backend

```powershell
cmd /c npm install
cmd /c npm run build
cmd /c npm run start
```

Konfigurasi runtime dibaca dari `.env`. File `.env.example` berisi daftar variable yang dibutuhkan tanpa credential produksi.

Backend berjalan pada `http://localhost:3000`.

## Menjalankan frontend

```powershell
cd C:\web\cloud\frontend
Copy-Item .env.example .env.local
cmd /c npm install
cmd /c npm run build
cmd /c npm run dev
```

Frontend berjalan pada `http://localhost:3001`. Request `/api` dan `/media` diteruskan oleh Next.js ke backend sesuai `BACKEND_URL`.

Frontend mencakup login, home, drive, bucket dan permission, users, settings, profile, serta seluruh operasi file yang tersedia di REST API.

## Preview file RAW

Backend otomatis menggunakan ImageMagick portable pada `tools\imagemagick-portable\magick.exe`. Binary tersebut membawa LibRaw dan tidak membutuhkan instalasi `dcraw` atau perubahan PATH Windows. Variable `IMAGE_MAGICK_BIN` dapat diisi untuk memakai binary lain.

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
