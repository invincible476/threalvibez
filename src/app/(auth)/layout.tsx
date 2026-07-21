import { AnimatedAuthBackground } from '@/components/animated-auth-background';
import { VibezLogo } from '@/components/vibez-logo';
import './auth-background.css';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center p-4 auth-bg">
      <AnimatedAuthBackground />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <VibezLogo />
        </div>
        <div className="bg-background/60 backdrop-blur-sm border border-border/50 rounded-lg">
          {children}
        </div>
      </div>
    </main>
  );
}
