import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/src/components/auth-provider'
import { ToastProvider } from '@/src/components/toast'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter'
})

export const metadata: Metadata = {
  title: 'Cloudspace',
  description: 'Private cloud storage console'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={inter.variable}>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
