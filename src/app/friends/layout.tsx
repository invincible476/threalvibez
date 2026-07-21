
'use client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function FriendsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col h-dvh w-full">
      <header className="flex items-center gap-3 border-b border-border/50 bg-card/80 backdrop-blur-xl p-2 sm:p-4 shrink-0 z-10">
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => router.back()}>
            <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-xl font-bold font-heading">Friends</h1>
      </header>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
