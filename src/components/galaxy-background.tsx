
'use client';
import React, { useRef, useEffect } from 'react';
import './galaxy-background.css';
import { useIsMobile } from '@/hooks/use-mobile';

// Star properties type
type Star = {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  opacityDirection: number;
};

// Component props
interface GalaxyBackgroundProps {
  starCount?: number;
  twinkle?: boolean;
}

export function GalaxyBackground({ starCount = 500, twinkle = true }: GalaxyBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const isMobile = useIsMobile();
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let stars: Star[] = [];

    const setup = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      stars = [];
      const effectiveStarCount = reducedMotion ? starCount / 2 : starCount;
      for (let i = 0; i < effectiveStarCount; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.5 + 0.5,
          speed: Math.random() * 0.2 + 0.1,
          opacity: Math.random() * 0.5 + 0.2,
          opacityDirection: Math.random() > 0.5 ? 1 : -1,
        });
      }
    };

    const draw = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- Enhanced Nebula Effect ---
      const nebulaOpacity1 = isMobile ? 0.6 : 0.4;
      const nebulaOpacity2 = isMobile ? 0.5 : 0.3;
      const radiusMultiplier1 = isMobile ? 0.8 : 0.5;
      const radiusMultiplier2 = isMobile ? 0.7 : 0.4;

      // Nebula 1
      const centerX1 = canvas.width * 0.25;
      const centerY1 = canvas.height * 0.25;
      const radius1 = Math.max(canvas.width, canvas.height) * radiusMultiplier1;
      const grad1 = ctx.createRadialGradient(centerX1, centerY1, 0, centerX1, centerY1, radius1);
      grad1.addColorStop(0, `hsla(260, 45%, 15%, ${nebulaOpacity1})`);
      grad1.addColorStop(1, 'transparent');
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Nebula 2
      const centerX2 = canvas.width * 0.75;
      const centerY2 = canvas.height * 0.75;
      const radius2 = Math.max(canvas.width, canvas.height) * radiusMultiplier2;
      const grad2 = ctx.createRadialGradient(centerX2, centerY2, 0, centerX2, centerY2, radius2);
      grad2.addColorStop(0, `hsla(220, 50%, 20%, ${nebulaOpacity2})`);
      grad2.addColorStop(1, 'transparent');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);


      for (const star of stars) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(200, 80%, 90%, ${star.opacity})`;
        ctx.fill();
      }
    };

    const update = () => {
      if(!canvas) return;
      for (const star of stars) {
        // Star movement
        star.y -= star.speed;
        if (star.y < 0) {
          star.y = canvas.height;
          star.x = Math.random() * canvas.width;
        }

        // Twinkle effect
        if (twinkle && !reducedMotion) {
          star.opacity += 0.005 * star.opacityDirection;
          if (star.opacity > 0.8 || star.opacity < 0.1) {
            star.opacityDirection *= -1;
          }
        }
      }
    };

    const animate = () => {
      if (!reducedMotion) {
        update();
      }
      draw();
      animationFrameId.current = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      setup();
      draw(); // Redraw immediately on resize
    };

    setup();
    draw(); // Draw the initial frame immediately
    animate();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [reducedMotion, starCount, twinkle, isMobile]);

  return <canvas ref={canvasRef} id="galaxy-canvas" aria-hidden="true"></canvas>;
}
