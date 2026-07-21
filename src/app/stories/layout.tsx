
'use client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function StoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-dvh w-full bg-background">
      <header className="flex items-center justify-between border-b border-border/50 bg-card/80 backdrop-blur-xl p-2 sm:p-4 shrink-0 z-10">
        <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-10 w-10" asChild>
                <Link href="/">
                    <ArrowLeft className="h-6 w-6" />
                </Link>
            </Button>
            <h1 className="text-xl font-bold font-heading">Stories</h1>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
