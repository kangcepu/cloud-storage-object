import type { NextConfig } from 'next'

const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:3000'

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd()
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${backendUrl}/api/:path*` },
      { source: '/media/:path*', destination: `${backendUrl}/media/:path*` }
    ]
  }
}

export default nextConfig
