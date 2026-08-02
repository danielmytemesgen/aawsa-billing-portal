import '@/lib/polyfills';
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import Providers from './providers';
import { PwaRegistry } from '@/components/layout/pwa-registry';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#1d4ed8',
};

export const metadata: Metadata = {
  title: 'AAWSA Billing Portal',
  description: 'Bulk meter bill calculation and water usage management for AAWSA.',
  manifest: '/manifest.json',
  icons: {
    icon: {
      url: 'https://veiethiopia.com/photo/partner/par2.png',
      type: 'image/png',
    },
    shortcut: { url: 'https://veiethiopia.com/photo/partner/par2.png', type: 'image/png' },
    apple: { url: 'https://veiethiopia.com/photo/partner/par2.png', type: 'image/png' },
  },
  openGraph: {
    images: ['https://veiethiopia.com/photo/partner/par2.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          {children}
          <Toaster />
          <PwaRegistry />
        </Providers>
      </body>
    </html>
  );
}
