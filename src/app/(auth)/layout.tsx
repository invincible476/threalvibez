import { AnimatedAuthBackground } from '@/components/animated-auth-background';
import { VibezLogo } from '@/components/vibez-logo';
import './auth-background.css';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-center p-4 sm:p-6 auth-bg antialiased selection:bg-primary/30">
      <AnimatedAuthBackground />
      <div className="relative z-10 w-full max-w-md my-auto">
        <div className="mb-6 sm:mb-8 flex justify-center">
          <VibezLogo />
        </div>
        <div className="bg-card/75 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
          {children}
        </div>
      </div>
    </main>
  );
}
