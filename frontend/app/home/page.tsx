'use client'

import { ArrowUpRight, Boxes, CircleDot, FileArchive, FileAudio, FileImage, FileText, FileVideo, Files, HardDrive, RefreshCw, Users } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageSkeleton } from '@/src/components/loading'
import { useToast } from '@/src/components/toast'
import { apiFetch } from '@/src/lib/api'
import { basename, formatBytes, formatDate } from '@/src/lib/format'
import type { DashboardData } from '@/src/types'

const typeMeta = {
  image: { label: 'Gambar', icon: FileImage, color: '#6d5efc' },
  video: { label: 'Video', icon: FileVideo, color: '#ec6e8c' },
  audio: { label: 'Audio', icon: FileAudio, color: '#f4a340' },
  pdf: { label: 'PDF', icon: FileText, color: '#ef5a5a' },
  document: { label: 'Dokumen', icon: FileText, color: '#3ca4e8' },
  archive: { label: 'Arsip', icon: FileArchive, color: '#2ab79b' },
  other: { label: 'Lainnya', icon: Files, color: '#8e98a8' }
}

export default function HomePage() {
  const { showToast } = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async (manual = false, silent = false) => {
    if (manual) setRefreshing(true)
    try {
      const response = await apiFetch<{ data: DashboardData }>('/api/dashboard/summary')
      setData(response.data)
      setLastUpdated(new Date())
      if (manual) showToast('Dashboard diperbarui')
    } catch (error) {
      if (!silent) showToast(error instanceof Error ? error.message : 'Gagal memuat dashboard', 'error')
    } finally {
      setRefreshing(false)
    }
  }, [showToast])

  useEffect(() => {
    void load()
    const interval = window.setInterval(() => void load(false, true), 60_000)
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') void load(false, true)
    }
    window.addEventListener('focus', refreshVisible)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshVisible)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [load])

  const maxBucketSize = useMemo(() => Math.max(...(data?.storage_per_bucket.map((item) => Number(item.total_size)) || [0]), 1), [data])

  if (!data) return <PageSkeleton />

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div><h1>Ringkasan penyimpanan</h1><p>Posisi kapasitas, sebaran objek, dan aktivitas terbaru dalam satu register.</p></div>
        <div className="dashboard-actions"><span className="live-status"><CircleDot size={14} />Live · {lastUpdated ? lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Menyambungkan'}</span><button className="button button-secondary" type="button" onClick={() => void load(true)} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'spin' : ''} />Perbarui</button></div>
      </section>
      {data.minio_error ? <div className="notice warning"><strong>Storage tidak dapat dijangkau.</strong><span>{data.minio_error}</span></div> : null}
      <section className="overview-ledger">
        <div className="capacity-primary"><span className="metric-icon"><HardDrive size={20} /></span><div><small>Penyimpanan terpakai</small><strong>{formatBytes(data.total_size)}</strong><p>Akumulasi objek pada seluruh bucket yang dapat diakses.</p></div></div>
        <div className="ledger-stat"><span><Boxes size={16} />Bucket aktif</span><strong>{data.bucket_count.toLocaleString('id-ID')}</strong></div>
        <div className="ledger-stat"><span><Files size={16} />Objek tercatat</span><strong>{data.total_files.toLocaleString('id-ID')}</strong></div>
        <div className="ledger-stat"><span><Users size={16} />Identitas</span><strong>{data.user_count === null ? '—' : data.user_count.toLocaleString('id-ID')}</strong></div>
      </section>
      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading"><div><h2>Penyimpanan per bucket</h2><p>Distribusi kapasitas paling besar.</p></div><Link className="text-link" href="/buckets">Lihat semua <ArrowUpRight size={15} /></Link></div>
          <div className="bar-list">
            {data.storage_per_bucket.length ? data.storage_per_bucket.map((item) => (
              <div className="bar-row" key={item.bucket_name}>
                <div className="bar-copy"><strong>{item.display_name || item.bucket_name}</strong><span>{formatBytes(item.total_size)} · {Number(item.total_files).toLocaleString('id-ID')} file</span></div>
                <div className="bar-track"><span style={{ width: `${Math.max((Number(item.total_size) / maxBucketSize) * 100, 3)}%` }} /></div>
              </div>
            )) : <div className="compact-empty">Belum ada data bucket.</div>}
          </div>
        </article>
        <article className="panel">
          <div className="panel-heading"><div><h2>Jenis file</h2><p>Komposisi objek tersimpan.</p></div></div>
          <div className="type-list">
            {Object.entries(typeMeta).map(([key, meta]) => {
              const Icon = meta.icon
              return <div className="type-row" key={key}><span className="type-icon" style={{ color: meta.color, background: `${meta.color}16` }}><Icon size={18} /></span><span><strong>{meta.label}</strong><small>{formatBytes(data.type_sizes[key])}</small></span><b>{Number(data.type_counts[key] || 0).toLocaleString('id-ID')}</b></div>
            })}
          </div>
        </article>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h2>Unggahan terbaru</h2><p>Sepuluh aktivitas file paling baru.</p></div><Link className="text-link" href="/drive">Buka register <ArrowUpRight size={15} /></Link></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nama file</th><th>Bucket</th><th>Ukuran</th><th>Uploader</th><th>Waktu</th></tr></thead>
            <tbody>
              {data.recent_uploads.length ? data.recent_uploads.map((item, index) => <tr key={`${item.bucket_name}-${item.object_key}-${index}`}><td><div className="name-cell"><span className="file-glyph"><FileText size={17} /></span><span><strong>{basename(item.object_key)}</strong><small>{item.object_key}</small></span></div></td><td><span className="badge neutral">{item.bucket_name}</span></td><td>{formatBytes(item.size)}</td><td>{item.uploaded_by_name || '—'}</td><td>{formatDate(item.created_at)}</td></tr>) : <tr><td colSpan={5}><div className="compact-empty">Belum ada upload.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
