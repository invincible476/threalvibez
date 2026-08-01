
'use client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { SlideIn } from '@/components/transitions';

export default function FriendsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col h-full h-[100dvh] w-full overflow-hidden min-h-0">
      <header className="flex items-center gap-3 border-b border-zinc-800/40 bg-zinc-950/80 backdrop-blur-md px-4 py-3 shrink-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 p-2 rounded-full text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-100 border-none outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 shrink-0 select-none"
          onClick={() => router.push('/')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold text-zinc-100 font-heading">Friends</h1>
      </header>
      <main className="flex-1 overflow-y-auto min-h-0 w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
        <SlideIn>
          {children}
        </SlideIn>
      </main>
    </div>
  );
}

