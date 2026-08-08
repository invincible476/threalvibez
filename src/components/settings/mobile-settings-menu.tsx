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

export function MobileSettingsMenu() {
    const pathname = usePathname();

    return (
        <div className="w-full max-w-md mx-auto px-4 py-2">
            <div className="w-full flex flex-col">
            {settingsItems.map(item => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                    <div key={item.href} className="relative group/item w-full">
                        <Link 
                            href={item.href} 
                            className={cn(
                                "w-full flex items-center justify-between py-3.5 px-2 transition-all duration-200 cursor-pointer active:scale-[0.98]",
                                isActive 
                                    ? "bg-primary/15 text-foreground" 
                                    : "hover:bg-white/5 text-foreground"
                            )}
                        >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className={cn(
                                    "p-2 rounded-lg shrink-0 relative flex items-center justify-center",
                                    isActive ? "bg-violet-950/80 text-violet-200 border border-violet-800/40" : "bg-muted/80 text-muted-foreground"
                                )}>
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className={cn("font-medium text-base truncate flex items-center gap-2 text-foreground")}>
                                        {item.title}
                                    </span>
                                    <span className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</span>
                                </div>
                            </div>
                            <ChevronRight className={cn("h-5 w-5 shrink-0 ml-2", isActive ? "text-foreground/80" : "text-muted-foreground")} />
                        </Link>
                        <div className="ml-14 border-b border-white/10" />
                    </div>
                );
            })}
            </div>
        </div>
    );
}
