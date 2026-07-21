
'use client';
import { useAppearance } from './providers/appearance-provider';

export function RightPaneBackground() {
    const { chatBackground } = useAppearance();
    
    if (chatBackground) return null;

    return (
        <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/50 to-background" />
    )
}