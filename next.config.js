/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Skip ESLint during production builds (warnings are non-blocking locally
  // but Vercel CI treats them as fatal errors in some configurations)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Skip TypeScript type errors during build (tsc --noEmit passes locally)
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'veiethiopia.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'veiethiopia.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
