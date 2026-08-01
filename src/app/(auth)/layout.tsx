import { AnimatedAuthBackground } from '@/components/animated-auth-background';
import { VibezLogo } from '@/components/vibez-logo';
import './auth-background.css';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="h-full h-[100dvh] w-full overflow-y-auto overflow-x-hidden py-6 sm:py-8 px-4 flex flex-col items-center justify-start sm:justify-center bg-background auth-bg antialiased selection:bg-primary/30 relative">
      <AnimatedAuthBackground />
      <div className="relative z-10 w-full max-w-md my-auto flex flex-col items-center py-4 pb-12">
        <div className="mb-6 flex justify-center">
          <VibezLogo />
        </div>
        <div className="w-full bg-card/75 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
          {children}
        </div>
      </div>
    </main>
  );
}
