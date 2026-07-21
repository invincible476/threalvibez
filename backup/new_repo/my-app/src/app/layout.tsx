
import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/components/providers/theme-provider';
import './globals.css';
import { Poppins, PT_Sans } from 'next/font/google';
import { cn } from '@/lib/utils';
import { AuthProvider } from '@/components/providers/auth-provider';
import { Toaster } from '@/components/ui/toaster';
import { AppearanceProvider } from '@/components/providers/appearance-provider';
import { MobileProvider } from '@/components/providers/mobile-provider';
import './mobile.css';
import { FriendsProvider } from '@/components/providers/friends-provider';

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
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

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
                  <main className="relative flex-1 z-10">{children}</main>
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
