// Yapı sürümü: her canlı yayında değişir. v2 açık pencerede yeni sürümü fark edip
// "Yeni sürüm var — Yenile" şeridi gösterir (components/v2/SurumUyarisi).
const YAPI_SURUMU = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || String(Date.now())

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: { YAPI_SURUMU },
}

module.exports = nextConfig
