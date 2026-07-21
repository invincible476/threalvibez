
'use client';
import React from 'react';

const isReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function GridBackground() {
    const shouldAnimate = !isReducedMotion();

    return (
        <>
            <div 
                className="fixed inset-0 z-[-1] bg-[#050505]"
                style={{
                    backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.07) 1px, transparent 1px)',
                    backgroundSize: '2rem 2rem',
                    animation: shouldAnimate ? 'grid-pan 30s linear infinite' : 'none',
                }}
            />
             <style jsx global>{`
                @keyframes grid-pan {
                    0% { background-position: 0% 0%; }
                    100% { background-position: 2rem 2rem; }
                }
            `}</style>
        </>
    );
}
