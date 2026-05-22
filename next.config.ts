
import type { NextConfig } from 'next';

// When building for the Android APK, we need a static export.
// Set NEXT_BUILD_TARGET=export before the build command.
const isApkBuild = process.env.NEXT_BUILD_TARGET === 'export';

const nextConfig: NextConfig = {
  /* config options here */
  output: isApkBuild ? 'export' : 'standalone', // 'export' for APK, 'standalone' for Docker/Vercel
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'user-images.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'veiethiopia.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.undp.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'www.stronsmart.com',
        port: '',
        pathname: '/**',
      }
    ],
  },
  webpack: (config, { isServer }) => {
    if (isApkBuild) {
      config.resolve.alias['@/lib/actions'] = require('path').resolve(__dirname, 'src/lib/actions-mock.ts');
    }
    if (isServer) {
      config.ignoreWarnings = [
        { module: /@opentelemetry\/exporter-jaeger/ },
      ];
      config.resolve.alias = {
        ...config.resolve.alias,
        '@opentelemetry/exporter-jaeger': false,
      };
    }
    return config;
  },
};

export default nextConfig;
