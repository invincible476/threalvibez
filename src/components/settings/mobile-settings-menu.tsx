'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, User, Shield, Palette, Bell, Mail, Image as ImageIcon, CloudSun } from 'lucide-react';
import { cn } from '@/lib/utils';

const settingsItems = [
    {
        href: '/settings/profile',
        icon: User,
        title: 'Profile',
        description: 'Manage your public profile information.'
    },
    {
        href: '/settings/account',
        icon: Shield,
        title: 'Account',
        description: 'Manage your account security and data.'
    },
    {
        href: '/settings/notifications',
        icon: Bell,
        title: 'Notifications',
        description: 'Manage how you get notified.'
    },
    {
        href: '/settings/appearance',
        icon: Palette,
        title: 'Appearance',
        description: 'Customize the look and feel of the app.'
    },
    {
        href: '/settings/backgrounds',
        icon: ImageIcon,
        title: 'Backgrounds',
        description: 'Choose your app background.'
    },
    {
        href: '/settings/weather',
        icon: CloudSun,
        title: 'Weather',
        description: 'Customize the weather widget.'
    },
    {
        href: '/settings/feedback',
        icon: Mail,
        title: 'Feedback',
        description: 'Send us your thoughts and suggestions.'
    }
];

import { useAppShell } from '@/components/app-shell';

export function MobileSettingsMenu() {
    const pathname = usePathname();
    const { currentUser } = useAppShell();
    const requestCount = currentUser?.friendRequestsReceived?.length || 0;

    return (
        <div className="w-full max-w-md mx-auto px-4 py-2">
            <div className="w-full flex flex-col">
            {settingsItems.map(item => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                const showBadge = (item.href === '/settings/notifications' || item.href === '/settings/profile') && requestCount > 0;

                return (
                    <Link 
                        href={item.href} 
                        key={item.href} 
                        className={cn(
                            "w-full flex items-center justify-between py-3.5 px-2 transition-all duration-200 relative border-b border-border/40 active:scale-[0.98]",
                            isActive 
                                ? "bg-muted/80 text-foreground" 
                                : "hover:bg-muted/30 text-foreground"
                        )}
                    >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={cn(
                                "p-2 rounded-lg shrink-0 relative flex items-center justify-center",
                                isActive ? "bg-violet-950/80 text-violet-200 border border-violet-800/40" : "bg-muted/80 text-muted-foreground"
                            )}>
                                <Icon className="h-5 w-5" />
                                {showBadge && (
                                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-zinc-950 animate-pulse" />
                                )}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className={cn("font-medium text-base truncate flex items-center gap-2 text-foreground")}>
                                    {item.title}
                                    {showBadge && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                                            {requestCount} new
                                        </span>
                                    )}
                                </span>
                                <span className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</span>
                            </div>
                        </div>
                        <ChevronRight className={cn("h-5 w-5 shrink-0 ml-2", isActive ? "text-foreground/80" : "text-muted-foreground")} />
                    </Link>
                );
            })}
            </div>
        </div>
    );
}
