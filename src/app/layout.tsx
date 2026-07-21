
import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '../components/providers/theme-provider';
import './globals.css';
import { Poppins, PT_Sans } from 'next/font/google';
import { cn } from '@/lib/utils';
import { AuthProvider } from '@/components/providers/auth-provider';
import { Toaster } from '@/components/ui/toaster';
import { AppearanceProvider } from '@/components/providers/appearance-provider';
import { MobileProvider } from '@/components/providers/mobile-provider';
import './mobile.css';
import { FriendsProvider } from '@/components/providers/friends-provider';
import { AppShell } from '@/components/app-shell';
import { validateEnvironmentOnStartup } from '@/lib/environment-validation';

const fontPoppins = Poppins({
  subsets: ['latin'],
  variable: '--font-poppins',
  weight: ['400', '500', '600', '700'],
});

const fontPtSans = PT_Sans({
  subsets: ['latin'],
  variable: '--font-pt-sans',
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: 'Vibez',
  description: 'A next-generation messaging app.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon.ico', sizes: '48x48' }
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ],
    other: [
      { url: '/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' }
    ]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Vibez'
  },
  applicationName: 'Vibez'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' }
  ]
};

// Validate environment at app startup
if (typeof window === 'undefined') {
  try {
    validateEnvironmentOnStartup();
  } catch (error) {
    console.error('Failed to start app due to environment validation errors:', error);
    // In development, we can continue, but log the error prominently
    if (process.env.NODE_ENV === 'production') {
      throw error; // This will prevent the app from starting in production
    }
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          fontPoppins.variable,
          fontPtSans.variable
        )}
      >

        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <AppearanceProvider>
              <FriendsProvider>
                <MobileProvider>
                  <AppShell>
                    <main className="relative flex-1 z-10">{children}</main>
                  </AppShell>
                  <Toaster />
                </MobileProvider>
              </FriendsProvider>
            </AppearanceProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

