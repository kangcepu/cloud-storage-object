'use client'

import { KeyRound, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2, UserCheck, UserRound, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/src/components/auth-provider'
import { EmptyState } from '@/src/components/empty-state'
import { Loading } from '@/src/components/loading'
import { Modal } from '@/src/components/modal'
import { useToast } from '@/src/components/toast'
import { apiFetch, apiJson } from '@/src/lib/api'
import { formatDate } from '@/src/lib/format'
import type { User, UserRole } from '@/src/types'

const blankCreate = { name: '', email: '', password: '', role: 'user' as UserRole }

export default function UsersPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [resetUser, setResetUser] = useState<User | null>(null)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const [createForm, setCreateForm] = useState(blankCreate)
  const [editForm, setEditForm] = useState({ name: '', role: 'user' as UserRole, is_active: true })
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    if (user && user.role !== 'superadmin') router.replace('/home')
  }, [user, router])

  const load = useCallback(async () => {
    if (user?.role !== 'superadmin') return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (role) params.set('role', role)
      if (status) params.set('status', status)
      const response = await apiFetch<{ data: User[] }>(`/api/users?${params}`)
      setUsers(response.data)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal memuat user', 'error')
    } finally {
      setLoading(false)
    }
  }, [user?.role, role, status, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const needle = query.toLowerCase()
    return users.filter((item) => `${item.name} ${item.email}`.toLowerCase().includes(needle))
  }, [users, query])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      await apiJson('/api/users', 'POST', createForm)
      showToast('User berhasil dibuat')
      setCreateForm(blankCreate)
      setCreateOpen(false)
      await load()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal membuat user', 'error')
    } finally {
      setBusy(false)
    }
  }

  const update = async (event: FormEvent) => {
    event.preventDefault()
    if (!editUser) return
    setBusy(true)
    try {
      await apiJson(`/api/users/${editUser.id}`, 'PUT', editForm)
      showToast('User berhasil diperbarui')
      setEditUser(null)
      await load()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal memperbarui user', 'error')
    } finally {
      setBusy(false)
    }
  }

  const reset = async (event: FormEvent) => {
    event.preventDefault()
    if (!resetUser) return
    setBusy(true)
    try {
      await apiJson(`/api/users/${resetUser.id}/reset-password`, 'POST', { password: newPassword })
      showToast('Password berhasil direset')
      setResetUser(null)
      setNewPassword('')
      await load()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal mereset password', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!deleteUser) return
    setBusy(true)
    try {
      await apiJson(`/api/users/${deleteUser.id}`, 'DELETE')
      showToast('User berhasil dihapus')
      setDeleteUser(null)
      await load()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal menghapus user', 'error')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (item: User) => {
    setEditUser(item)
    setEditForm({ name: item.name, role: item.role, is_active: Boolean(item.is_active) })
  }

  return (
    <div className="page-stack">
      <section className="page-heading"><div><h1>Kendali identitas</h1><p>Kelola akun, peran, status, dan kredensial akses.</p></div><div className="heading-actions"><button className="button button-secondary" type="button" onClick={() => void load()}><RefreshCw size={17} />Muat ulang</button><button className="button button-primary" type="button" onClick={() => setCreateOpen(true)}><Plus size={17} />Pengguna baru</button></div></section>
      <section className="metric-grid compact"><Metric icon={Users} label="Total user" value={users.length} tone="purple" /><Metric icon={UserCheck} label="User aktif" value={users.filter((item) => Boolean(item.is_active)).length} tone="green" /><Metric icon={ShieldCheck} label="Superadmin" value={users.filter((item) => item.role === 'superadmin').length} tone="blue" /><Metric icon={KeyRound} label="Wajib ganti password" value={users.filter((item) => Boolean(item.must_change_password)).length} tone="orange" /></section>
      <section className="panel"><div className="list-toolbar"><div className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau email" /></div><div className="filter-row"><select className="select" value={role} onChange={(event) => setRole(event.target.value)}><option value="">Semua role</option><option value="superadmin">Superadmin</option><option value="user">User</option></select><select className="select" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Semua status</option><option value="active">Aktif</option><option value="inactive">Nonaktif</option></select></div></div>
        {loading ? <Loading label="Memuat user" /> : filtered.length ? <div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Login terakhir</th><th>Dibuat</th><th className="align-right">Aksi</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><div className="name-cell"><span className="avatar small">{item.avatar_path ? <img src={`/media/avatar/${item.avatar_path}`} alt="" /> : item.name.slice(0, 1).toUpperCase()}</span><span><strong>{item.name}</strong><small>{item.email}</small></span></div></td><td><span className={`badge ${item.role === 'superadmin' ? 'purple' : 'neutral'}`}>{item.role}</span></td><td><span className={`badge ${item.is_active ? 'success' : 'danger'}`}><span className="badge-dot" />{item.is_active ? 'Aktif' : 'Nonaktif'}</span></td><td>{formatDate(item.last_login_at)}</td><td>{formatDate(item.created_at)}</td><td><div className="row-actions"><button className="icon-button" type="button" onClick={() => startEdit(item)} title="Edit"><Pencil size={17} /></button><button className="icon-button" type="button" onClick={() => { setResetUser(item); setNewPassword('') }} title="Reset password"><KeyRound size={17} /></button>{item.id !== user?.id ? <button className="icon-button danger" type="button" onClick={() => setDeleteUser(item)} title="Hapus"><Trash2 size={17} /></button> : null}</div></td></tr>)}</tbody></table></div> : <EmptyState icon={UserRound} title="User tidak ditemukan" description="Ubah filter atau tambahkan user baru." />}
      </section>
      <Modal open={createOpen} title="Tambah user" description="User baru wajib mengganti password saat login pertama." onClose={() => setCreateOpen(false)}><form className="form-stack" onSubmit={create}><div className="form-grid"><label className="field"><span>Nama lengkap</span><input value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} required autoFocus /></label><label className="field"><span>Role</span><select value={createForm.role} onChange={(event) => setCreateForm((current) => ({ ...current, role: event.target.value as UserRole }))}><option value="user">User</option><option value="superadmin">Superadmin</option></select></label></div><label className="field"><span>Email</span><input type="email" value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} required /></label><label className="field"><span>Password awal</span><input type="password" value={createForm.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} minLength={8} required /><small>Minimal 8 karakter.</small></label><div className="form-actions"><button className="button button-secondary" type="button" onClick={() => setCreateOpen(false)}>Batal</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Membuat' : 'Buat user'}</button></div></form></Modal>
      <Modal open={Boolean(editUser)} title="Edit user" description={editUser?.email} onClose={() => setEditUser(null)}><form className="form-stack" onSubmit={update}><label className="field"><span>Nama lengkap</span><input value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} required autoFocus /></label><div className="form-grid"><label className="field"><span>Role</span><select value={editForm.role} onChange={(event) => setEditForm((current) => ({ ...current, role: event.target.value as UserRole }))}><option value="user">User</option><option value="superadmin">Superadmin</option></select></label><label className="field"><span>Status</span><select value={editForm.is_active ? '1' : '0'} onChange={(event) => setEditForm((current) => ({ ...current, is_active: event.target.value === '1' }))}><option value="1">Aktif</option><option value="0">Nonaktif</option></select></label></div><div className="form-actions"><button className="button button-secondary" type="button" onClick={() => setEditUser(null)}>Batal</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Menyimpan' : 'Simpan perubahan'}</button></div></form></Modal>
      <Modal open={Boolean(resetUser)} title="Reset password" description={resetUser?.name} size="small" onClose={() => setResetUser(null)}><form className="form-stack" onSubmit={reset}><label className="field"><span>Password baru</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required autoFocus /><small>User akan diminta mengganti password saat login berikutnya.</small></label><div className="form-actions"><button className="button button-secondary" type="button" onClick={() => setResetUser(null)}>Batal</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Menyimpan' : 'Reset password'}</button></div></form></Modal>
      <Modal open={Boolean(deleteUser)} title="Hapus user" description={deleteUser?.email} size="small" onClose={() => setDeleteUser(null)}><div className="form-stack"><div className="danger-confirm"><Trash2 size={24} /><p>Akun <strong>{deleteUser?.name}</strong> akan dihapus permanen beserta seluruh permission bucket-nya.</p></div><div className="form-actions"><button className="button button-secondary" type="button" onClick={() => setDeleteUser(null)}>Batal</button><button className="button button-danger" type="button" onClick={() => void remove()} disabled={busy}>{busy ? 'Menghapus' : 'Hapus user'}</button></div></div></Modal>
    </div>
  )
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: number; tone: string }) {
  return <article className="metric-card compact"><span className={`metric-icon ${tone}`}><Icon size={20} /></span><div><span>{label}</span><strong>{value.toLocaleString('id-ID')}</strong></div></article>
}
