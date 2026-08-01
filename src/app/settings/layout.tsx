
'use client';
import { Sidebar, SidebarProvider, SidebarInset, SidebarHeader, SidebarTrigger, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Home, User, Shield, Palette, ArrowLeft, Bell, Mail, Image as ImageIcon, CloudSun } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';
import { useMobileDesign } from '@/components/providers/mobile-provider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

function SettingsSkeleton() {
    return (
        <div className="flex min-h-screen">
            <div className="w-16 md:w-64 p-4 border-r bg-background/70 backdrop-blur-xl">
                <div className="space-y-4">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>
            <main className="p-4 sm:p-6 lg:p-8 w-full">
                <Skeleton className="h-96 w-full" />
            </main>
        </div>
    )
}

const getTitleFromPath = (path: string) => {
    if (path.includes('appearance')) return 'Appearance';
    if (path.includes('account')) return 'Account';
    if (path.includes('profile')) return 'Profile';
    if (path.includes('notifications')) return 'Notifications';
    if (path.includes('feedback')) return 'Feedback';
    if (path.includes('backgrounds')) return 'Backgrounds';
    if (path.includes('weather')) return 'Weather';
    return 'Settings';
}

function MobileSettingsLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const title = getTitleFromPath(pathname);
    const isRootSettings = pathname === '/settings';

    return (
        <div className="flex flex-col h-full h-[100dvh] w-full overflow-hidden min-h-0">
            <header className="sticky top-0 z-10 w-full bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/40 px-4 py-3 flex items-center gap-2 shrink-0">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 active:bg-zinc-800/50 hover:bg-zinc-800/50 text-zinc-300 hover:text-zinc-100 border-none outline-none select-none"
                    onClick={() => isRootSettings ? router.push('/') : router.push('/settings')}
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-base font-semibold text-zinc-100">{title}</h1>
            </header>
            <main className="flex-1 overflow-y-auto min-h-0 w-full pb-20" style={{ WebkitOverflowScrolling: 'touch' }}>
                {children}
            </main>
        </div>
    )
}


export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { isMobileView } = useMobileDesign();


  if (loading || !user) {
      return <SettingsSkeleton />
  }
  
  if (isMobileView) {
    return (
      <MobileSettingsLayout>
        {children}
      </MobileSettingsLayout>
    )
  }

  return (
    <SidebarProvider>
        <div className="flex h-screen h-[100dvh] w-full overflow-hidden min-h-0">
            <Sidebar collapsible="icon" className="bg-background/70 backdrop-blur-xl border-r-white/5">
                <SidebarHeader>
                    <SidebarTrigger />
                </SidebarHeader>
                 <div className="p-2">
                    <div className="bg-card/50 rounded-lg p-2">
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname.startsWith('/settings/profile')}>
                                    <Link href="/settings/profile">
                                        <User />
                                        <span>Profile</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname.startsWith('/settings/account')}>
                                    <Link href="/settings/account">
                                        <Shield />
                                        <span>Account</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                             <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname.startsWith('/settings/notifications')}>
                                    <Link href="/settings/notifications">
                                        <Bell />
                                        <span>Notifications</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname.startsWith('/settings/appearance')}>
                                    <Link href="/settings/appearance">
                                        <Palette />
                                        <span>Appearance</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                             <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname.startsWith('/settings/backgrounds')}>
                                    <Link href="/settings/backgrounds">
                                        <ImageIcon />
                                        <span>Backgrounds</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname.startsWith('/settings/weather')}>
                                    <Link href="/settings/weather">
                                        <CloudSun />
                                        <span>Weather</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                             <SidebarMenuItem>
                                <SidebarMenuButton asChild isActive={pathname.startsWith('/settings/feedback')}>
                                    <Link href="/settings/feedback">
                                        <Mail />
                                        <span>Feedback</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </div>
                </div>
                <div className="mt-auto p-2">
                     <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                                <Link href="/">
                                    <Home />
                                    <span>Back to Chat</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </div>
            </Sidebar>
            <SidebarInset className="flex-1 h-full max-h-screen min-h-0 flex flex-col overflow-y-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
                <main className="p-4 sm:p-6 lg:p-8 w-full max-w-5xl mx-auto flex-1 min-h-0 pb-20">
                    {children}
                </main>
            </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
