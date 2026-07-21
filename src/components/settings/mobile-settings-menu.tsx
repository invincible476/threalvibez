'use client';

import Link from 'next/link';
import { ChevronRight, User, Shield, Palette, Bell, Mail, Image as ImageIcon, CloudSun } from 'lucide-react';

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
    return (
        <div className="p-2 space-y-2">
            {settingsItems.map(item => (
                <Link href={item.href} key={item.href} className="flex items-center justify-between p-4 rounded-lg bg-card/50 hover:bg-card/80 transition-colors">
                    <div className="flex items-center gap-4">
                        <item.icon className="h-6 w-6 text-primary" />
                        <div className="flex flex-col">
                            <span className="font-semibold">{item.title}</span>
                            <span className="text-sm text-muted-foreground">{item.description}</span>
                        </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Link>
            ))}
        </div>
    );
}
