'use client'

import { Camera, KeyRound, Mail, Save, ShieldCheck, UserRound } from 'lucide-react'
import { ChangeEvent, FormEvent, useRef, useState } from 'react'
import { useAuth } from '@/src/components/auth-provider'
import { useToast } from '@/src/components/toast'
import { apiFetch, apiJson } from '@/src/lib/api'
import { formatDate } from '@/src/lib/format'

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const { showToast } = useToast()
  const avatarInput = useRef<HTMLInputElement>(null)
  const [password, setPassword] = useState({ current_password: '', new_password: '', confirmation: '' })
  const [saving, setSaving] = useState('')

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setSaving('avatar')
    try {
      const form = new FormData()
      form.append('avatar', file)
      await apiFetch('/api/profile/avatar', { method: 'POST', body: form })
      await refreshUser()
      showToast('Foto profil diperbarui')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Upload avatar gagal', 'error')
    } finally {
      setSaving('')
    }
  }

  const changePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (password.new_password !== password.confirmation) {
      showToast('Konfirmasi password tidak cocok', 'error')
      return
    }
    setSaving('password')
    try {
      await apiJson('/api/auth/change-password', 'POST', { current_password: password.current_password, new_password: password.new_password })
      setPassword({ current_password: '', new_password: '', confirmation: '' })
      await refreshUser()
      showToast('Password berhasil diubah')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal mengubah password', 'error')
    } finally {
      setSaving('')
    }
  }

  if (!user) return null

  return (
    <div className="page-stack profile-page">
      <section className="page-heading"><div><h1>Profil akun</h1><p>Kelola foto profil dan keamanan akun.</p></div></section>
      {user.must_change_password ? <div className="notice warning"><strong>Password harus diganti.</strong><span>Gunakan form keamanan akun di bawah sebelum melanjutkan pekerjaan.</span></div> : null}
      <section className="profile-grid">
        <article className="panel profile-card"><div className="profile-avatar-large">{user.avatar_path ? <img src={`/media/avatar/${user.avatar_path}`} alt={user.name} /> : user.name.slice(0, 1).toUpperCase()}<button type="button" onClick={() => avatarInput.current?.click()} disabled={saving === 'avatar'} aria-label="Ganti foto profil"><Camera size={18} /></button><input className="visually-hidden" ref={avatarInput} type="file" accept=".png,.jpg,.jpeg,.webp,.gif" onChange={(event) => void uploadAvatar(event)} /></div><h2>{user.name}</h2><p>{user.email}</p><span className={`badge ${user.role === 'superadmin' ? 'purple' : 'neutral'}`}>{user.role}</span><div className="profile-details"><span><Mail size={17} /><div><small>Email</small><strong>{user.email}</strong></div></span><span><ShieldCheck size={17} /><div><small>Status</small><strong>{user.is_active ? 'Aktif' : 'Nonaktif'}</strong></div></span><span><UserRound size={17} /><div><small>Login terakhir</small><strong>{formatDate(user.last_login_at)}</strong></div></span></div></article>
        <form className="panel form-stack" onSubmit={changePassword}><div className="panel-heading"><div className="heading-with-icon"><span className="section-icon purple"><KeyRound size={20} /></span><div><h2>Keamanan akun</h2><p>Gunakan password yang kuat dan unik.</p></div></div></div><label className="field"><span>Password saat ini</span><input type="password" value={password.current_password} onChange={(event) => setPassword((current) => ({ ...current, current_password: event.target.value }))} autoComplete="current-password" required /></label><label className="field"><span>Password baru</span><input type="password" value={password.new_password} onChange={(event) => setPassword((current) => ({ ...current, new_password: event.target.value }))} autoComplete="new-password" minLength={8} required /><small>Minimal 8 karakter.</small></label><label className="field"><span>Konfirmasi password baru</span><input type="password" value={password.confirmation} onChange={(event) => setPassword((current) => ({ ...current, confirmation: event.target.value }))} autoComplete="new-password" minLength={8} required /></label><div className="form-actions"><button className="button button-primary" type="submit" disabled={saving === 'password'}><Save size={17} />{saving === 'password' ? 'Menyimpan' : 'Ubah password'}</button></div></form>
      </section>
    </div>
  )
}
