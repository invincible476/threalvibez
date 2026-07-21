
'use client';
import React from 'react';

const isReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function GradientGlowBackground() {
  if (isReducedMotion()) {
    return <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1, background: '#0f0c29' }} />;
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: -1,
          background: 'linear-gradient(270deg, #0f0c29, #302b63, #24243e)',
          backgroundSize: '600% 600%',
          animation: 'gradient-pan 16s ease infinite',
        }}
      />
      <style jsx global>{`
        @keyframes gradient-pan {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </>
  );
}
