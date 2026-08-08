import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export function VibezLogo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5 select-none group", className)}>
      <div className="relative h-8 w-8 rounded-lg overflow-hidden shrink-0 border border-white/10 shadow-md transition-transform group-hover:scale-105">
        <Image
          src="/logo.png"
          alt="Vibez"
          fill
          className="object-cover"
          priority
        />
      </div>
      {showText && (
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-violet-100 via-white to-violet-300 bg-clip-text text-transparent">
          Vibez<span className="text-violet-400">.</span>
        </h1>
      )}
    </Link>
  );
}
