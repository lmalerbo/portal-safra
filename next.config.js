/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: '/portal-safra',
  assetPrefix: '/portal-safra',
}

module.exports = config
