'use client'

import {
  Boxes,
  ChevronDown,
  Cloud,
  Files,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UserCircle,
  Users,
  X,
  ShieldCheck
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/src/components/auth-provider'
import { Loading } from '@/src/components/loading'
import { useToast } from '@/src/components/toast'

const navigation = [
  { href: '/home', label: 'Ringkasan', detail: 'Ikhtisar operasional', icon: LayoutDashboard },
  { href: '/drive', label: 'Register objek', detail: 'File dan folder', icon: Files },
  { href: '/buckets', label: 'Ruang penyimpanan', detail: 'Bucket dan akses', icon: Boxes },
  { href: '/users', label: 'Kendali identitas', detail: 'Pengguna dan peran', icon: Users, admin: true },
  { href: '/settings', label: 'Pengaturan sistem', detail: 'Konfigurasi penyimpanan', icon: Settings, admin: true }
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const { showToast } = useToast()
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    if (ready && !user) router.replace('/login')
  }, [ready, user, router])

  useEffect(() => {
    setMenuOpen(false)
    setProfileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const sidebar = sidebarRef.current
    window.requestAnimationFrame(() => sidebar?.querySelector<HTMLElement>('button, a')?.focus())
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      window.requestAnimationFrame(() => menuButtonRef.current?.focus())
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [menuOpen])

  if (!ready || !user) {
    return <div className="full-loader"><Loading label="Menyiapkan workspace" /></div>
  }

  const visibleNavigation = navigation.filter((item) => !item.admin || user.role === 'superadmin')

  const closeMobileMenu = () => {
    setMenuOpen(false)
    window.requestAnimationFrame(() => menuButtonRef.current?.focus())
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal keluar', 'error')
    }
  }

  return (
    <div className="app-layout">
      <button ref={menuButtonRef} className="mobile-menu-button" type="button" onClick={() => setMenuOpen(true)} aria-label="Buka menu" aria-expanded={menuOpen} aria-controls="primary-navigation">
        <Menu size={21} />
      </button>
      {menuOpen ? <button className="sidebar-scrim" type="button" onClick={closeMobileMenu} aria-label="Tutup menu" /> : null}
      <aside ref={sidebarRef} id="primary-navigation" className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark"><Cloud size={23} /></div>
          <div><strong>Cloudspace</strong><span>Pusat kendali penyimpanan</span></div>
          <button className="sidebar-close" type="button" onClick={closeMobileMenu} aria-label="Tutup menu"><X size={20} /></button>
        </div>
        <nav className="sidebar-nav">
          <span className="nav-caption">Operasional</span>
          {visibleNavigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            return <Link className={active ? 'nav-link active' : 'nav-link'} href={item.href} key={item.href}><Icon size={18} /><span><strong>{item.label}</strong><small>{item.detail}</small></span></Link>
          })}
        </nav>
        <div className="sidebar-status">
          <span className="status-dot"><ShieldCheck size={14} /></span>
          <div><span>Lapisan penyimpanan</span><strong>Operasional</strong></div>
        </div>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div className="topbar-title">
            <strong>{navigation.find((item) => pathname.startsWith(item.href))?.label || 'Ruang kerja'}</strong>
            <span>Cloudspace / Ruang kerja terlindungi</span>
          </div>
          <div className="profile-menu">
            <button type="button" className="profile-trigger" onClick={() => setProfileOpen((value) => !value)} aria-label={`Buka menu akun ${user.name}`} aria-expanded={profileOpen} aria-haspopup="true">
              <span className="avatar">{user.avatar_path ? <img src={`/media/avatar/${user.avatar_path}`} alt="" /> : user.name.slice(0, 1).toUpperCase()}</span>
              <span className="profile-copy"><strong>{user.name}</strong><small>{user.role}</small></span>
              <ChevronDown size={16} />
            </button>
            {profileOpen ? (
              <div className="profile-dropdown">
                <Link href="/profile"><UserCircle size={18} />Profil</Link>
                <button type="button" onClick={handleLogout}><LogOut size={18} />Keluar</button>
              </div>
            ) : null}
          </div>
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  )
}
