
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MobileSettingsMenu } from '@/components/settings/mobile-settings-menu';
import { useMobileDesign } from '@/components/providers/mobile-provider';

export default function SettingsPage() {
    const router = useRouter();
    const { isMobileView } = useMobileDesign();

    useEffect(() => {
        if (!isMobileView) {
            router.replace('/settings/profile');
        }
    }, [isMobileView, router]);

    if (!isMobileView) {
        // Render nothing on desktop while redirecting
        return null;
    }

    return <MobileSettingsMenu />;
}
