'use client'

import { CloudCog, ImageIcon, Palette, RefreshCw, Save, Server, ShieldCheck, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/src/components/auth-provider'
import { Loading } from '@/src/components/loading'
import { useToast } from '@/src/components/toast'
import { apiFetch, apiJson } from '@/src/lib/api'
import { formatDate } from '@/src/lib/format'

interface SettingsResponse {
  app: Record<string, string | null>
  security: Record<string, string | null>
  minio_configured: boolean
  minio: {
    endpoint: string
    public_endpoint: string
    access_key: string
    region: string
    use_ssl: string
    path_style_endpoint: string
    delivery_mode: 'proxy' | 'direct'
    default_bucket: string
    last_test_at: string | null
    last_test_ok: string | null
    last_test_message: string | null
    secret_key_configured: boolean
  }
}

const emptyApp = { title: '', description: '', login_title: '', footer_text: '' }
const emptyMinio = { endpoint: '', public_endpoint: '', access_key: '', secret_key: '', region: 'us-east-1', use_ssl: false, path_style_endpoint: true, delivery_mode: 'proxy' as 'proxy' | 'direct', default_bucket: '' }

export default function SettingsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const logoInput = useRef<HTMLInputElement>(null)
  const faviconInput = useRef<HTMLInputElement>(null)
  const [settings, setSettings] = useState<SettingsResponse | null>(null)
  const [app, setApp] = useState(emptyApp)
  const [minio, setMinio] = useState(emptyMinio)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')

  useEffect(() => {
    if (user && user.role !== 'superadmin') router.replace('/home')
  }, [user, router])

  const load = useCallback(async () => {
    if (user?.role !== 'superadmin') return
    setLoading(true)
    try {
      const response = await apiFetch<SettingsResponse>('/api/settings')
      setSettings(response)
      setApp({ title: response.app.title || '', description: response.app.description || '', login_title: response.app.login_title || '', footer_text: response.app.footer_text || '' })
      setMinio({ endpoint: response.minio.endpoint, public_endpoint: response.minio.public_endpoint, access_key: response.minio.access_key, secret_key: '', region: response.minio.region, use_ssl: response.minio.use_ssl === '1', path_style_endpoint: response.minio.path_style_endpoint !== '0', delivery_mode: response.minio.delivery_mode, default_bucket: response.minio.default_bucket })
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal memuat settings', 'error')
    } finally {
      setLoading(false)
    }
  }, [user?.role, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const saveApp = async (event: FormEvent) => {
    event.preventDefault()
    setSaving('app')
    try {
      await apiJson('/api/settings/app', 'PUT', app)
      showToast('Identitas aplikasi disimpan')
      await load()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal menyimpan settings', 'error')
    } finally {
      setSaving('')
    }
  }

  const saveMinio = async (event: FormEvent) => {
    event.preventDefault()
    setSaving('minio')
    try {
      await apiJson('/api/settings/minio', 'PUT', minio)
      showToast('Konfigurasi storage disimpan')
      await load()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal menyimpan storage', 'error')
    } finally {
      setSaving('')
    }
  }

  const testConnection = async () => {
    setSaving('test')
    try {
      await apiJson('/api/settings/minio/test', 'POST')
      showToast('Koneksi storage berhasil')
      await load()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Koneksi storage gagal', 'error')
      await load()
    } finally {
      setSaving('')
    }
  }

  const uploadBranding = async (event: ChangeEvent<HTMLInputElement>, type: 'logo' | 'favicon') => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setSaving(type)
    try {
      const form = new FormData()
      form.append(type, file)
      await apiFetch(`/api/settings/app/${type}`, { method: 'POST', body: form })
      showToast(`${type === 'logo' ? 'Logo' : 'Favicon'} berhasil diupload`)
      await load()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Upload gagal', 'error')
    } finally {
      setSaving('')
    }
  }

  if (loading && !settings) return <Loading label="Memuat pengaturan" />
  if (!settings) return null

  return (
    <div className="page-stack">
      <section className="page-heading"><div><h1>Pengaturan sistem</h1><p>Atur identitas aplikasi, branding, dan koneksi penyimpanan objek.</p></div><button className="button button-secondary" type="button" onClick={() => void load()}><RefreshCw size={17} />Muat ulang</button></section>
      <section className="settings-grid">
        <form className="panel form-stack" onSubmit={saveApp}><div className="panel-heading"><div className="heading-with-icon"><span className="section-icon purple"><Palette size={20} /></span><div><h2>Identitas aplikasi</h2><p>Teks utama yang tampil pada aplikasi.</p></div></div></div><label className="field"><span>Nama aplikasi</span><input value={app.title} onChange={(event) => setApp((current) => ({ ...current, title: event.target.value }))} required /></label><label className="field"><span>Deskripsi</span><textarea rows={3} value={app.description} onChange={(event) => setApp((current) => ({ ...current, description: event.target.value }))} /></label><div className="form-grid"><label className="field"><span>Judul login</span><input value={app.login_title} onChange={(event) => setApp((current) => ({ ...current, login_title: event.target.value }))} /></label><label className="field"><span>Teks footer</span><input value={app.footer_text} onChange={(event) => setApp((current) => ({ ...current, footer_text: event.target.value }))} /></label></div><div className="form-actions"><button className="button button-primary" type="submit" disabled={saving === 'app'}><Save size={17} />{saving === 'app' ? 'Menyimpan' : 'Simpan identitas'}</button></div></form>
        <section className="panel form-stack"><div className="panel-heading"><div className="heading-with-icon"><span className="section-icon orange"><ImageIcon size={20} /></span><div><h2>Branding</h2><p>Logo dan favicon aplikasi.</p></div></div></div><div className="branding-row"><div className="branding-preview">{settings.app.logo_path ? <img src={`/media/branding/${settings.app.logo_path}`} alt="Logo aplikasi" /> : <CloudCog size={34} />}</div><div><strong>Logo aplikasi</strong><p>PNG, JPG, SVG, atau WebP.</p><button className="button button-secondary" type="button" onClick={() => logoInput.current?.click()} disabled={saving === 'logo'}><Upload size={16} />{saving === 'logo' ? 'Uploading' : 'Ganti logo'}</button><input className="visually-hidden" ref={logoInput} type="file" accept=".png,.jpg,.jpeg,.svg,.webp" onChange={(event) => void uploadBranding(event, 'logo')} /></div></div><div className="branding-row"><div className="branding-preview small">{settings.app.favicon_path ? <img src={`/media/branding/${settings.app.favicon_path}`} alt="Favicon aplikasi" /> : <ImageIcon size={25} />}</div><div><strong>Favicon</strong><p>ICO, PNG, atau SVG.</p><button className="button button-secondary" type="button" onClick={() => faviconInput.current?.click()} disabled={saving === 'favicon'}><Upload size={16} />{saving === 'favicon' ? 'Uploading' : 'Ganti favicon'}</button><input className="visually-hidden" ref={faviconInput} type="file" accept=".ico,.png,.svg" onChange={(event) => void uploadBranding(event, 'favicon')} /></div></div></section>
      </section>
      <form className="panel form-stack" onSubmit={saveMinio}><div className="panel-heading"><div className="heading-with-icon"><span className="section-icon green"><Server size={20} /></span><div><h2>Object storage</h2><p>Konfigurasi koneksi MinIO atau S3-compatible storage.</p></div></div><span className={`badge ${settings.minio_configured ? 'success' : 'danger'}`}><span className="badge-dot" />{settings.minio_configured ? 'Configured' : 'Belum lengkap'}</span></div><div className="form-grid"><label className="field"><span>Endpoint</span><input value={minio.endpoint} onChange={(event) => setMinio((current) => ({ ...current, endpoint: event.target.value }))} placeholder="http://minio.internal:9000" required /></label><label className="field"><span>Public endpoint</span><input value={minio.public_endpoint} onChange={(event) => setMinio((current) => ({ ...current, public_endpoint: event.target.value }))} placeholder="https://storage.example.com" /></label><label className="field"><span>Access key</span><input value={minio.access_key} onChange={(event) => setMinio((current) => ({ ...current, access_key: event.target.value }))} required /></label><label className="field"><span>Secret key</span><input type="password" value={minio.secret_key} onChange={(event) => setMinio((current) => ({ ...current, secret_key: event.target.value }))} placeholder={settings.minio.secret_key_configured ? 'Kosongkan untuk mempertahankan secret' : 'Masukkan secret key'} required={!settings.minio.secret_key_configured} /></label><label className="field"><span>Region</span><input value={minio.region} onChange={(event) => setMinio((current) => ({ ...current, region: event.target.value }))} /></label><label className="field"><span>Default bucket</span><input value={minio.default_bucket} onChange={(event) => setMinio((current) => ({ ...current, default_bucket: event.target.value }))} /></label><label className="field"><span>Delivery mode</span><select value={minio.delivery_mode} onChange={(event) => setMinio((current) => ({ ...current, delivery_mode: event.target.value as 'proxy' | 'direct' }))}><option value="proxy">Proxy melalui aplikasi</option><option value="direct">Signed URL langsung</option></select></label><div className="toggle-group"><label className="toggle-row"><input type="checkbox" checked={minio.use_ssl} onChange={(event) => setMinio((current) => ({ ...current, use_ssl: event.target.checked }))} /><span><strong>Gunakan SSL</strong><small>Paksa koneksi HTTPS</small></span></label><label className="toggle-row"><input type="checkbox" checked={minio.path_style_endpoint} onChange={(event) => setMinio((current) => ({ ...current, path_style_endpoint: event.target.checked }))} /><span><strong>Path-style endpoint</strong><small>Bucket berada pada path URL</small></span></label></div></div>{settings.minio.last_test_at ? <div className={`connection-result ${settings.minio.last_test_ok === '1' ? 'success' : 'danger'}`}><ShieldCheck size={19} /><span><strong>Test terakhir {formatDate(settings.minio.last_test_at)}</strong><small>{settings.minio.last_test_message || 'Tidak ada pesan'}</small></span></div> : null}<div className="form-actions split"><button className="button button-secondary" type="button" onClick={() => void testConnection()} disabled={Boolean(saving)}><RefreshCw size={17} className={saving === 'test' ? 'spin' : ''} />Test koneksi</button><button className="button button-primary" type="submit" disabled={Boolean(saving)}><Save size={17} />{saving === 'minio' ? 'Menyimpan' : 'Simpan storage'}</button></div></form>
    </div>
  )
}
