/** @type {import('next').NextConfig} */
const nextConfig = {
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
