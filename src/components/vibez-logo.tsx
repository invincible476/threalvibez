import Link from 'next/link';
import { cn } from '@/lib/utils';

export function VibezLogo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 select-none", className)}>
      <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-violet-200 via-zinc-100 to-violet-300 bg-clip-text text-transparent">
        Vibez<span className="text-violet-500">.</span>
      </h1>
    </Link>
  );
}
