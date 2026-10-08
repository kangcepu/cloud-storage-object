'use client'

import { ArrowRight, Boxes, Cloud, Eye, EyeOff, FileCheck2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import { useAuth } from '@/src/components/auth-provider'
import { useToast } from '@/src/components/toast'

export default function LoginPage() {
  const router = useRouter()
  const { user, ready, login } = useAuth()
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (ready && user) router.replace(user.must_change_password ? '/profile' : '/home')
  }, [ready, user, router])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      const loggedIn = await login(email.trim(), password)
      showToast(`Selamat datang, ${loggedIn.name}`)
      router.replace(loggedIn.must_change_password ? '/profile' : '/home')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Login gagal', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-showcase">
        <div className="login-brand"><span><Cloud size={22} /></span>Cloudspace</div>
        <div className="showcase-copy">
          <span className="showcase-label">PUSAT KENDALI PENYIMPANAN PRIVAT</span>
          <h1>Kendali penuh atas setiap objek.</h1>
          <p>Operasikan bucket, akses tim, dan file organisasi melalui satu ruang kerja yang terukur dan dapat diaudit.</p>
          <div className="showcase-points">
            <div><Boxes size={18} /><span><strong>Penyimpanan terstruktur</strong><small>Bucket dan objek tetap terorganisir.</small></span></div>
            <div><ShieldCheck size={18} /><span><strong>Akses terkendali</strong><small>Hak akses terukur untuk setiap pengguna.</small></span></div>
            <div><FileCheck2 size={18} /><span><strong>Operasi terlacak</strong><small>Aktivitas penting tercatat dengan jelas.</small></span></div>
          </div>
        </div>
        <span className="showcase-foot"><span /> Cloud internal aman</span>
      </section>
      <section className="login-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="mobile-login-brand"><Cloud size={21} />Cloudspace</div>
          <span className="form-kicker">Ruang kerja terlindungi</span>
          <h2>Masuk ke ruang kerja</h2>
          <p className="form-intro">Gunakan akun yang terdaftar untuk melanjutkan.</p>
          <label className="field-label" htmlFor="email">Email</label>
          <div className="input-with-icon">
            <Mail size={18} />
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@perusahaan.com" autoComplete="email" required autoFocus />
          </div>
          <label className="field-label" htmlFor="password">Password</label>
          <div className="input-with-icon">
            <LockKeyhole size={18} />
            <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Masukkan password" autoComplete="current-password" required />
            <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          <button className="button button-primary login-button" type="submit" disabled={submitting}>
            {submitting ? <span className="spinner small" /> : null}
            {submitting ? 'Memproses' : 'Masuk'}
            {!submitting ? <ArrowRight size={18} /> : null}
          </button>
          <p className="login-help">Hubungi administrator jika akses akun bermasalah.</p>
        </form>
      </section>
    </main>
  )
}
