
import Link from 'next/link';
import { MessagesSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export function VibezLogo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2", className)}>
      <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gradient-from to-gradient-to animated-gradient">
        Vibez
      </h1>
    </Link>
  );
}
