'use client'

import {
  ArrowLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  File,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  FolderInput,
  FolderPlus,
  MoreHorizontal,
  Move,
  Pencil,
  RefreshCw,
  Trash2,
  Upload
} from 'lucide-react'
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState } from '@/src/components/empty-state'
import { Loading } from '@/src/components/loading'
import { Modal } from '@/src/components/modal'
import { useToast } from '@/src/components/toast'
import { apiFetch, apiJson } from '@/src/lib/api'
import { basename, extension, formatBytes, formatDate, joinObjectPath } from '@/src/lib/format'
import type { Bucket, BucketPermission, StorageFile, StorageFolder } from '@/src/types'

type ObjectItem = { key: string; folder: boolean; size: number; lastModified: string | null }
type ActionKind = 'rename' | 'copy' | 'move' | 'delete' | null
type PreviewState = {
  item: ObjectItem
  url: string
  status: 'loading' | 'ready' | 'error'
  retryCount: number
  message?: string
}
type DirectorySnapshot = {
  items: ObjectItem[]
  permissions: BucketPermission
  nextToken: string | null
}

const defaultPermissions: BucketPermission = { view: false, upload: false, rename: false, delete: false, download: false }
const SIGNED_URL_CACHE_MS = 240_000

export default function DrivePage() {
  const { showToast } = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const listRequest = useRef<AbortController | null>(null)
  const previewRequest = useRef(0)
  const previewCache = useRef(new Map<string, string>())
  const downloadCache = useRef(new Map<string, string>())
  const directoryCache = useRef(new Map<string, { expires: number; value: DirectorySnapshot }>())
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [bucket, setBucket] = useState('')
  const [prefix, setPrefix] = useState('')
  const [items, setItems] = useState<ObjectItem[]>([])
  const [permissions, setPermissions] = useState(defaultPermissions)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [nextToken, setNextToken] = useState<string | null>(null)
  const [folderModal, setFolderModal] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [action, setAction] = useState<ActionKind>(null)
  const [selected, setSelected] = useState<ObjectItem | null>(null)
  const [target, setTarget] = useState('')
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [busy, setBusy] = useState(false)

  const loadBuckets = useCallback(async () => {
    try {
      const response = await apiFetch<{ data: Bucket[] }>('/api/buckets')
      setBuckets(response.data)
      setBucket((current) => current || response.data[0]?.bucket_name || '')
      if (!response.data.length) setLoading(false)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal memuat bucket', 'error')
      setLoading(false)
    }
  }, [showToast])

  const loadFiles = useCallback(async (append = false, token?: string | null) => {
    if (!bucket) return
    const cacheKey = `${bucket}:${prefix}:${token || ''}`
    const cached = !append ? directoryCache.current.get(cacheKey) : null
    if (cached && cached.expires > Date.now()) {
      setItems(cached.value.items)
      setPermissions(cached.value.permissions)
      setNextToken(cached.value.nextToken)
    }
    listRequest.current?.abort()
    const controller = new AbortController()
    listRequest.current = controller
    setLoading(!cached)
    try {
      const query = new URLSearchParams({ prefix, max_keys: '250' })
      if (token) query.set('continuation_token', token)
      const response = await apiFetch<{
        folders: StorageFolder[]
        files: StorageFile[]
        permissions: BucketPermission
        next_continuation_token: string | null
      }>(`/api/buckets/${encodeURIComponent(bucket)}/files?${query}`, { signal: controller.signal })
      const incoming: ObjectItem[] = [
        ...response.folders.map((item) => ({ key: item.prefix, folder: true, size: 0, lastModified: null })),
        ...response.files.map((item) => ({ key: item.key, folder: false, size: Number(item.size), lastModified: item.last_modified }))
      ]
      setItems((current) => append ? [...current, ...incoming] : incoming)
      setPermissions(response.permissions)
      setNextToken(response.next_continuation_token || null)
      if (!append) {
        directoryCache.current.set(cacheKey, {
          expires: Date.now() + 30_000,
          value: {
            items: incoming,
            permissions: response.permissions,
            nextToken: response.next_continuation_token || null
          }
        })
      }
    } catch (error) {
      if (controller.signal.aborted) return
      showToast(error instanceof Error ? error.message : 'Gagal memuat file', 'error')
    } finally {
      if (listRequest.current === controller) {
        listRequest.current = null
        setLoading(false)
      }
    }
  }, [bucket, prefix, showToast])

  useEffect(() => () => listRequest.current?.abort(), [])

  const invalidateDirectoryCache = () => {
    const bucketPrefix = `${bucket}:`
    for (const key of directoryCache.current.keys()) {
      if (key.startsWith(bucketPrefix)) directoryCache.current.delete(key)
    }
    for (const key of previewCache.current.keys()) {
      if (key.startsWith(bucketPrefix)) previewCache.current.delete(key)
    }
    for (const key of downloadCache.current.keys()) {
      if (key.startsWith(bucketPrefix)) downloadCache.current.delete(key)
    }
  }

  useEffect(() => {
    void loadBuckets()
  }, [loadBuckets])

  useEffect(() => {
    if (bucket) void loadFiles()
  }, [bucket, prefix, loadFiles])

  const breadcrumbs = useMemo(() => {
    const segments = prefix.replace(/\/$/, '').split('/').filter(Boolean)
    return segments.map((label, index) => ({ label, prefix: `${segments.slice(0, index + 1).join('/')}/` }))
  }, [prefix])

  const uploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('prefix', prefix)
      for (const file of files) {
        form.append('files', file)
        form.append('paths', file.webkitRelativePath || file.name)
      }
      const response = await apiFetch<{ results: Array<{ ok: boolean; name: string; message?: string }> }>(`/api/buckets/${encodeURIComponent(bucket)}/upload`, { method: 'POST', body: form })
      const failed = response.results.filter((item) => !item.ok)
      showToast(failed.length ? `${files.length - failed.length} berhasil, ${failed.length} gagal` : `${files.length} file berhasil diupload`, failed.length ? 'info' : 'success')
      invalidateDirectoryCache()
      await loadFiles()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Upload gagal', 'error')
    } finally {
      setUploading(false)
    }
  }

  const createFolder = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      await apiJson(`/api/buckets/${encodeURIComponent(bucket)}/folders`, 'POST', { parent: prefix, name: folderName })
      showToast('Folder berhasil dibuat')
      setFolderModal(false)
      setFolderName('')
      invalidateDirectoryCache()
      await loadFiles()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal membuat folder', 'error')
    } finally {
      setBusy(false)
    }
  }

  const openAction = (kind: Exclude<ActionKind, null>, item: ObjectItem) => {
    setSelected(item)
    setAction(kind)
    const name = basename(item.key)
    setTarget(kind === 'rename' ? name : `${prefix}${kind === 'copy' ? `Copy of ${name}` : name}`)
  }

  const runAction = async (event: FormEvent) => {
    event.preventDefault()
    if (!action || !selected) return
    setBusy(true)
    try {
      if (action === 'delete') {
        await apiJson(`/api/buckets/${encodeURIComponent(bucket)}/files/delete`, 'DELETE', { key: selected.key })
      } else {
        const destination = action === 'rename'
          ? joinObjectPath(prefix, target, selected.folder)
          : selected.folder ? `${target.replace(/\/$/, '')}/` : target.replace(/\/$/, '')
        await apiJson(`/api/buckets/${encodeURIComponent(bucket)}/files/${action}`, action === 'rename' ? 'PUT' : 'POST', { from: selected.key, to: destination })
      }
      showToast(`${actionLabel(action)} berhasil`)
      setAction(null)
      setSelected(null)
      invalidateDirectoryCache()
      await loadFiles()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Operasi gagal', 'error')
    } finally {
      setBusy(false)
    }
  }

  const openPreview = async (item: ObjectItem, force = false, retryCount = 0) => {
    const cacheKey = `${bucket}:${item.key}`
    const cached = previewCache.current.get(cacheKey)
    const cachedUrl = !force && cached ? cached : ''
    if (force) previewCache.current.delete(cacheKey)
    const requestId = ++previewRequest.current
    setPreview({ item, url: cachedUrl, status: cachedUrl ? 'ready' : 'loading', retryCount })
    if (cachedUrl) return
    try {
      const response = await apiFetch<{ url: string }>(`/api/buckets/${encodeURIComponent(bucket)}/files/preview?key=${encodeURIComponent(item.key)}`)
      previewCache.current.set(cacheKey, response.url)
      window.setTimeout(() => {
        if (previewCache.current.get(cacheKey) === response.url) previewCache.current.delete(cacheKey)
      }, SIGNED_URL_CACHE_MS)
      if (previewRequest.current === requestId) {
        setPreview({ item, url: response.url, status: 'ready', retryCount })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Preview tidak tersedia'
      if (previewRequest.current === requestId) {
        setPreview({ item, url: '', status: 'error', retryCount, message })
      }
    }
  }

  const handlePreviewMediaError = (failedPreview: PreviewState) => {
    const cacheKey = `${bucket}:${failedPreview.item.key}`
    previewCache.current.delete(cacheKey)
    if (failedPreview.retryCount < 1) {
      void openPreview(failedPreview.item, true, failedPreview.retryCount + 1)
      return
    }
    setPreview({
      ...failedPreview,
      url: '',
      status: 'error',
      message: 'Preview gagal dimuat. Periksa koneksi lalu coba lagi.'
    })
  }

  const download = async (item: ObjectItem) => {
    try {
      const cacheKey = `${bucket}:${item.key}`
      let url = downloadCache.current.get(cacheKey)
      if (!url) {
        const response = await apiFetch<{ url: string }>(`/api/buckets/${encodeURIComponent(bucket)}/files/download?key=${encodeURIComponent(item.key)}`)
        url = response.url
        downloadCache.current.set(cacheKey, url)
        window.setTimeout(() => downloadCache.current.delete(cacheKey), 240_000)
      }
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Download gagal', 'error')
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading drive-heading">
        <div><h1>Register objek</h1><p>Telusuri, pratinjau, dan kelola objek pada seluruh bucket yang dapat diakses.</p></div>
        <div className="heading-actions">
          <select className="select bucket-select" value={bucket} onChange={(event) => { setBucket(event.target.value); setPrefix('') }} aria-label="Pilih bucket">
            {buckets.map((item) => <option value={item.bucket_name} key={item.bucket_name}>{item.display_name || item.bucket_name}</option>)}
          </select>
          {permissions.upload ? <button className="button button-secondary" type="button" onClick={() => setFolderModal(true)}><FolderPlus size={17} />Folder</button> : null}
          {permissions.upload ? <button className="button button-primary" type="button" onClick={() => fileInput.current?.click()} disabled={uploading}><Upload size={17} />{uploading ? 'Mengunggah' : 'Unggah'}</button> : null}
          <input className="visually-hidden" ref={fileInput} type="file" multiple onChange={uploadFiles} />
          <input className="visually-hidden" ref={(node) => { if (node) { folderInput.current = node; node.setAttribute('webkitdirectory', ''); node.setAttribute('directory', '') } }} type="file" multiple onChange={uploadFiles} />
        </div>
      </section>
      {!buckets.length && !loading ? <section className="panel"><EmptyState icon={Folder} title="Belum ada bucket" description="Hubungi administrator atau buat bucket baru sebelum mengelola file." /></section> : null}
      {buckets.length ? <section className="panel drive-panel">
        <div className="drive-toolbar">
          <div className="breadcrumbs">
            {prefix ? <button type="button" className="icon-button" onClick={() => setPrefix(breadcrumbs.at(-2)?.prefix || '')}><ArrowLeft size={19} /></button> : null}
            <button type="button" onClick={() => setPrefix('')}>{bucket}</button>
            {breadcrumbs.map((crumb) => <span key={crumb.prefix}><ChevronRight size={15} /><button type="button" onClick={() => setPrefix(crumb.prefix)}>{crumb.label}</button></span>)}
          </div>
          <div className="toolbar-actions">
            {permissions.upload ? <button className="button button-quiet" type="button" onClick={() => folderInput.current?.click()}><FolderInput size={16} />Unggah folder</button> : null}
            <button className="icon-button" type="button" onClick={() => void loadFiles()} aria-label="Muat ulang"><RefreshCw size={18} /></button>
          </div>
        </div>
        {items.length ? <p className="mobile-scroll-hint">Geser tabel untuk melihat seluruh aksi.</p> : null}
        {loading && !items.length ? <Loading label="Memuat isi drive" /> : items.length ? <div className="table-wrap drive-table"><table><thead><tr><th>Nama</th><th>Ukuran</th><th>Terakhir diubah</th><th className="align-right">Aksi</th></tr></thead><tbody>{items.map((item) => <tr key={`${item.folder}-${item.key}`}><td><button className="object-name" type="button" onClick={() => item.folder ? setPrefix(item.key) : void openPreview(item)}><span className={item.folder ? 'object-icon folder' : 'object-icon'}>{item.folder ? <Folder size={20} /> : <FileIcon name={item.key} />}</span><span><strong>{basename(item.key)}</strong><small>{item.key}</small></span></button></td><td>{item.folder ? '—' : formatBytes(item.size)}</td><td>{formatDate(item.lastModified)}</td><td><div className="row-actions">{!item.folder ? <button className="icon-button" type="button" onClick={() => void openPreview(item)} title="Pratinjau" aria-label={`Pratinjau ${basename(item.key)}`}><Eye size={17} /></button> : null}{!item.folder && permissions.download ? <button className="icon-button" type="button" onClick={() => void download(item)} title="Unduh" aria-label={`Unduh ${basename(item.key)}`}><Download size={17} /></button> : null}{permissions.rename ? <button className="icon-button" type="button" onClick={() => openAction('rename', item)} title="Ubah nama" aria-label={`Ubah nama ${basename(item.key)}`}><Pencil size={17} /></button> : null}{permissions.upload ? <button className="icon-button" type="button" onClick={() => openAction('copy', item)} title="Salin" aria-label={`Salin ${basename(item.key)}`}><Copy size={17} /></button> : null}{permissions.rename ? <button className="icon-button" type="button" onClick={() => openAction('move', item)} title="Pindahkan" aria-label={`Pindahkan ${basename(item.key)}`}><Move size={17} /></button> : null}{permissions.delete ? <button className="icon-button danger" type="button" onClick={() => openAction('delete', item)} title="Hapus" aria-label={`Hapus ${basename(item.key)}`}><Trash2 size={17} /></button> : null}{!permissions.rename && !permissions.upload && !permissions.delete && item.folder ? <MoreHorizontal size={18} /> : null}</div></td></tr>)}</tbody></table></div> : !loading ? <EmptyState icon={Folder} title="Folder ini masih kosong" description="Unggah file atau buat folder baru untuk mulai mengisi drive." action={permissions.upload ? <button className="button button-primary" type="button" onClick={() => fileInput.current?.click()}><Upload size={17} />Unggah file</button> : undefined} /> : null}
        {nextToken ? <div className="load-more"><button className="button button-secondary" type="button" onClick={() => void loadFiles(true, nextToken)} disabled={loading}>{loading ? 'Memuat' : 'Tampilkan lebih banyak'}</button></div> : null}
      </section> : null}
      <Modal open={folderModal} title="Buat folder baru" description={`Lokasi: ${bucket}/${prefix}`} size="small" onClose={() => setFolderModal(false)}><form className="form-stack" onSubmit={createFolder}><label className="field"><span>Nama folder</span><input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="Contoh: Dokumen proyek" required autoFocus /></label><div className="form-actions"><button className="button button-secondary" type="button" onClick={() => setFolderModal(false)}>Batal</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Membuat' : 'Buat folder'}</button></div></form></Modal>
      <Modal open={Boolean(action && selected)} title={action ? actionTitle(action) : ''} description={selected ? basename(selected.key) : ''} size="small" onClose={() => setAction(null)}><form className="form-stack" onSubmit={runAction}>{action === 'delete' ? <div className="danger-confirm"><Trash2 size={24} /><p>Objek ini akan dihapus permanen dari storage. Tindakan ini tidak dapat dibatalkan.</p></div> : <label className="field"><span>{action === 'rename' ? 'Nama baru' : 'Path tujuan lengkap'}</span><input value={target} onChange={(event) => setTarget(event.target.value)} required autoFocus /><small>{action === 'rename' ? `Tetap berada di ${prefix || 'root'}` : 'Gunakan path relatif di dalam bucket yang sama.'}</small></label>}<div className="form-actions"><button className="button button-secondary" type="button" onClick={() => setAction(null)}>Batal</button><button className={`button ${action === 'delete' ? 'button-danger' : 'button-primary'}`} type="submit" disabled={busy}>{busy ? 'Memproses' : action ? actionLabel(action) : 'Simpan'}</button></div></form></Modal>
      <Modal open={Boolean(preview)} title={preview ? basename(preview.item.key) : 'Pratinjau'} size="large" onClose={() => { previewRequest.current += 1; setPreview(null) }}>{preview ? <PreviewContent preview={preview} onMediaError={() => handlePreviewMediaError(preview)} onRetry={() => void openPreview(preview.item, true)} /> : null}</Modal>
    </div>
  )
}

function FileIcon({ name }: { name: string }) {
  const ext = extension(name)
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext)) return <FileImage size={20} />
  if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) return <FileVideo size={20} />
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return <FileAudio size={20} />
  if (['pdf', 'txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'php', 'sql', 'log'].includes(ext)) return <FileText size={20} />
  return <File size={20} />
}

function PreviewContent({ preview, onMediaError, onRetry }: { preview: PreviewState; onMediaError: () => void; onRetry: () => void }) {
  const [mediaReady, setMediaReady] = useState(false)
  const { item, url, status, message } = preview
  const ext = extension(item.key)
  useEffect(() => setMediaReady(false), [url])
  if (status === 'loading') return <div className="preview-loading"><span className="preview-pulse" /><Loading label="Menyiapkan pratinjau optimal" /></div>
  if (status === 'error') return <div className="empty-state" role="alert"><File size={32} /><h3>Pratinjau tidak tersedia</h3><p>{message || 'File ini tidak dapat dipratinjau.'}</p><button className="button button-secondary" type="button" onClick={onRetry}>Coba lagi</button></div>
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif', 'dng', 'nef', 'cr2', 'cr3', 'arw', 'raw', 'raf', 'rw2', 'orf'].includes(ext)) return <div className={`preview-stage ${mediaReady ? 'ready' : ''}`}>{!mediaReady ? <span className="preview-pulse" /> : null}<img className="preview-image" src={url} alt={basename(item.key)} decoding="async" fetchPriority="high" onLoad={() => setMediaReady(true)} onError={onMediaError} /></div>
  if (['mp4', 'webm', 'mov'].includes(ext)) return <div className={`preview-stage ${mediaReady ? 'ready' : ''}`}>{!mediaReady ? <span className="preview-pulse" /> : null}<video className="preview-media" src={url} controls preload="metadata" onLoadedMetadata={() => setMediaReady(true)} onError={onMediaError} /></div>
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return <div className="audio-preview"><FileAudio size={52} /><audio src={url} controls preload="metadata" onError={onMediaError} /></div>
  if (['pdf', 'txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'php', 'sql', 'log'].includes(ext)) return <iframe className="preview-frame" src={url} title={basename(item.key)} loading="eager" />
  return <div className="empty-state"><File size={32} /><h3>Pratinjau tidak tersedia</h3><p>Gunakan tombol unduh untuk membuka file ini di perangkat.</p></div>
}

function actionLabel(action: Exclude<ActionKind, null>): string {
  return { rename: 'Ubah nama', copy: 'Salin', move: 'Pindahkan', delete: 'Hapus' }[action]
}

function actionTitle(action: Exclude<ActionKind, null>): string {
  return { rename: 'Ubah nama', copy: 'Salin objek', move: 'Pindahkan objek', delete: 'Hapus objek' }[action]
}
