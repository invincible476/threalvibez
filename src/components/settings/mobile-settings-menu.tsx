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
        <div className="p-3 space-y-2.5 max-w-2xl mx-auto">
            {settingsItems.map(item => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                    <Link 
                        href={item.href} 
                        key={item.href} 
                        className={cn(
                            "flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all duration-200",
                            isActive 
                                ? "bg-purple-500/15 border-purple-500/30 text-purple-300 font-semibold shadow-lg shadow-purple-500/10" 
                                : "bg-card/75 border-border/50 hover:bg-card hover:border-border/80 text-foreground"
                        )}
                    >
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className={cn(
                                "p-2.5 rounded-lg shrink-0",
                                isActive ? "bg-purple-500/20 text-purple-300" : "bg-muted/50 text-muted-foreground"
                            )}>
                                <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col min-w-0 truncate">
                                <span className="font-semibold text-base truncate">{item.title}</span>
                                <span className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</span>
                            </div>
                        </div>
                        <ChevronRight className={cn("h-5 w-5 shrink-0 ml-2", isActive ? "text-purple-300" : "text-muted-foreground")} />
                    </Link>
                );
            })}
        </div>
    );
}
