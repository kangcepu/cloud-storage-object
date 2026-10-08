'use client'

import { Boxes, Database, HardDrive, KeyRound, Pencil, Plus, RefreshCw, Search, Trash2, Users as UsersIcon } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/src/components/auth-provider'
import { EmptyState } from '@/src/components/empty-state'
import { Loading } from '@/src/components/loading'
import { Modal } from '@/src/components/modal'
import { useToast } from '@/src/components/toast'
import { apiFetch, apiJson } from '@/src/lib/api'
import { formatBytes, formatDate } from '@/src/lib/format'
import type { Bucket, BucketPermission, User } from '@/src/types'

const blankBucket = { bucket_name: '', display_name: '', description: '' }
const blankPermission: BucketPermission = { view: true, upload: false, rename: false, delete: false, download: true }

export default function BucketsPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [buckets, setBuckets] = useState<Bucket[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editBucket, setEditBucket] = useState<Bucket | null>(null)
  const [deleteBucket, setDeleteBucket] = useState<Bucket | null>(null)
  const [assignBucket, setAssignBucket] = useState<Bucket | null>(null)
  const [form, setForm] = useState(blankBucket)
  const [confirmation, setConfirmation] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [permission, setPermission] = useState(blankPermission)
  const [assignedPermissions, setAssignedPermissions] = useState<Record<number, BucketPermission>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiFetch<{ data: Bucket[] }>('/api/buckets')
      setBuckets(response.data)
      if (user?.role === 'superadmin') {
        const usersResponse = await apiFetch<{ data: User[] }>('/api/users?status=active')
        setUsers(usersResponse.data.filter((item) => item.role !== 'superadmin'))
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal memuat bucket', 'error')
    } finally {
      setLoading(false)
    }
  }, [user?.role, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const needle = query.toLowerCase()
    return buckets.filter((item) => `${item.bucket_name} ${item.display_name || ''} ${item.description || ''}`.toLowerCase().includes(needle))
  }, [buckets, query])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      await apiJson('/api/buckets', 'POST', form)
      showToast('Bucket berhasil dibuat')
      setCreateOpen(false)
      setForm(blankBucket)
      await load()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal membuat bucket', 'error')
    } finally {
      setBusy(false)
    }
  }

  const update = async (event: FormEvent) => {
    event.preventDefault()
    if (!editBucket) return
    setBusy(true)
    try {
      await apiJson(`/api/buckets/${encodeURIComponent(editBucket.bucket_name)}`, 'PUT', { display_name: form.display_name, description: form.description })
      showToast('Informasi bucket diperbarui')
      setEditBucket(null)
      await load()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal memperbarui bucket', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (event: FormEvent) => {
    event.preventDefault()
    if (!deleteBucket) return
    setBusy(true)
    try {
      await apiJson(`/api/buckets/${encodeURIComponent(deleteBucket.bucket_name)}`, 'DELETE', { confirm: confirmation })
      showToast('Bucket berhasil dihapus')
      setDeleteBucket(null)
      setConfirmation('')
      await load()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal menghapus bucket', 'error')
    } finally {
      setBusy(false)
    }
  }

  const assign = async (event: FormEvent) => {
    event.preventDefault()
    if (!assignBucket || !selectedUser) return
    setBusy(true)
    try {
      await apiJson(`/api/buckets/${encodeURIComponent(assignBucket.bucket_name)}/assign-user`, 'POST', { user_id: Number(selectedUser), permissions: permission })
      showToast('Permission user berhasil disimpan')
      setAssignBucket(null)
      setSelectedUser('')
      setPermission(blankPermission)
      await load()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal menyimpan permission', 'error')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (item: Bucket) => {
    setEditBucket(item)
    setForm({ bucket_name: item.bucket_name, display_name: item.display_name || '', description: item.description || '' })
  }

  const startAssign = async (item: Bucket) => {
    setAssignBucket(item)
    setSelectedUser('')
    setPermission(blankPermission)
    try {
      const response = await apiFetch<{ assigned_users: Array<{ user_id: number; can_view: number; can_upload: number; can_rename: number; can_delete: number; can_download: number }> }>(`/api/buckets/${encodeURIComponent(item.bucket_name)}`)
      setAssignedPermissions(Object.fromEntries(response.assigned_users.map((assigned) => [assigned.user_id, { view: Boolean(assigned.can_view), upload: Boolean(assigned.can_upload), rename: Boolean(assigned.can_rename), delete: Boolean(assigned.can_delete), download: Boolean(assigned.can_download) }])))
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal memuat permission', 'error')
    }
  }

  const chooseUser = (value: string) => {
    setSelectedUser(value)
    setPermission(assignedPermissions[Number(value)] || blankPermission)
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div><h1>Ruang penyimpanan</h1><p>Atur bucket, kapasitas tercatat, dan hak akses setiap pengguna.</p></div>
        <div className="heading-actions"><button className="button button-secondary" type="button" onClick={() => void load()}><RefreshCw size={17} />Refresh</button>{user?.role === 'superadmin' ? <button className="button button-primary" type="button" onClick={() => { setForm(blankBucket); setCreateOpen(true) }}><Plus size={17} />Bucket baru</button> : null}</div>
      </section>
      <section className="panel">
        <div className="list-toolbar"><div className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari bucket" /></div><span className="result-count">{filtered.length} bucket</span></div>
        {loading ? <Loading label="Memuat bucket" /> : filtered.length ? <div className="bucket-grid">{filtered.map((item) => <article className="bucket-card" key={item.bucket_name}><div className="bucket-card-head"><span className="bucket-icon"><Database size={23} /></span>{user?.role === 'superadmin' ? <div className="row-actions"><button className="icon-button" type="button" onClick={() => startEdit(item)} title="Edit"><Pencil size={17} /></button><button className="icon-button danger" type="button" onClick={() => { setDeleteBucket(item); setConfirmation('') }} title="Hapus"><Trash2 size={17} /></button></div> : null}</div><h3>{item.display_name || item.bucket_name}</h3><code>{item.bucket_name}</code><p>{item.description || 'Belum ada deskripsi untuk bucket ini.'}</p><div className="bucket-stats"><span><HardDrive size={16} /><b>{formatBytes(item.total_size)}</b><small>Storage</small></span><span><Boxes size={16} /><b>{Number(item.total_files || 0).toLocaleString('id-ID')}</b><small>File</small></span><span><UsersIcon size={16} /><b>{Number(item.assigned_users || 0).toLocaleString('id-ID')}</b><small>User</small></span></div><div className="bucket-card-foot"><span>Diperbarui {formatDate(item.last_modified || item.updated_at)}</span>{user?.role === 'superadmin' ? <button className="text-link" type="button" onClick={() => void startAssign(item)}><KeyRound size={15} />Atur akses</button> : null}</div></article>)}</div> : <EmptyState icon={Boxes} title="Bucket tidak ditemukan" description={query ? 'Coba kata kunci pencarian yang lain.' : 'Belum ada bucket yang tersedia.'} />}
      </section>
      <Modal open={createOpen} title="Bucket baru" description="Nama internal bucket tidak dapat diubah setelah dibuat." onClose={() => setCreateOpen(false)}><BucketForm form={form} setForm={setForm} onSubmit={create} busy={busy} submitLabel="Buat bucket" showName onCancel={() => setCreateOpen(false)} /></Modal>
      <Modal open={Boolean(editBucket)} title="Edit bucket" description={editBucket?.bucket_name} onClose={() => setEditBucket(null)}><BucketForm form={form} setForm={setForm} onSubmit={update} busy={busy} submitLabel="Simpan perubahan" onCancel={() => setEditBucket(null)} /></Modal>
      <Modal open={Boolean(deleteBucket)} title="Hapus bucket" description="Bucket harus kosong sebelum dapat dihapus." size="small" onClose={() => setDeleteBucket(null)}><form className="form-stack" onSubmit={remove}><div className="danger-confirm"><Trash2 size={24} /><p>Ketik <strong>{deleteBucket?.bucket_name}</strong> untuk mengonfirmasi penghapusan permanen.</p></div><label className="field"><span>Konfirmasi nama bucket</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required autoFocus /></label><div className="form-actions"><button className="button button-secondary" type="button" onClick={() => setDeleteBucket(null)}>Batal</button><button className="button button-danger" type="submit" disabled={busy || confirmation !== deleteBucket?.bucket_name}>{busy ? 'Menghapus' : 'Hapus bucket'}</button></div></form></Modal>
      <Modal open={Boolean(assignBucket)} title="Atur akses user" description={assignBucket?.display_name || assignBucket?.bucket_name} onClose={() => setAssignBucket(null)}><form className="form-stack" onSubmit={assign}><label className="field"><span>User</span><select value={selectedUser} onChange={(event) => chooseUser(event.target.value)} required><option value="">Pilih user</option>{users.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.email}</option>)}</select></label><div className="permission-grid">{(Object.keys(permission) as Array<keyof BucketPermission>).map((key) => <label className="check-card" key={key}><input type="checkbox" checked={permission[key]} onChange={(event) => setPermission((current) => ({ ...current, [key]: event.target.checked }))} /><span><strong>{permissionLabel(key)}</strong><small>{permissionDescription(key)}</small></span></label>)}</div><div className="form-actions"><button className="button button-secondary" type="button" onClick={() => setAssignBucket(null)}>Batal</button><button className="button button-primary" type="submit" disabled={busy || !selectedUser}>{busy ? 'Menyimpan' : 'Simpan akses'}</button></div></form></Modal>
    </div>
  )
}

function BucketForm({ form, setForm, onSubmit, busy, submitLabel, showName = false, onCancel }: { form: typeof blankBucket; setForm: React.Dispatch<React.SetStateAction<typeof blankBucket>>; onSubmit: (event: FormEvent) => void; busy: boolean; submitLabel: string; showName?: boolean; onCancel: () => void }) {
  return <form className="form-stack" onSubmit={onSubmit}>{showName ? <label className="field"><span>Nama bucket</span><input value={form.bucket_name} onChange={(event) => setForm((current) => ({ ...current, bucket_name: event.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, '-') }))} placeholder="project-assets" minLength={3} maxLength={63} required autoFocus /><small>Gunakan huruf kecil, angka, titik, atau tanda hubung.</small></label> : null}<label className="field"><span>Nama tampilan</span><input value={form.display_name} onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))} placeholder="Project Assets" autoFocus={!showName} /></label><label className="field"><span>Deskripsi</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={4} placeholder="Kegunaan bucket ini" /></label><div className="form-actions"><button className="button button-secondary" type="button" onClick={onCancel}>Batal</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Menyimpan' : submitLabel}</button></div></form>
}

function permissionLabel(key: keyof BucketPermission): string {
  return { view: 'Lihat', upload: 'Unggah', rename: 'Ubah nama', delete: 'Hapus', download: 'Unduh' }[key]
}

function permissionDescription(key: keyof BucketPermission): string {
  return { view: 'Buka isi bucket', upload: 'Tambah file dan folder', rename: 'Ubah nama dan pindah', delete: 'Hapus objek', download: 'Unduh file' }[key]
}
