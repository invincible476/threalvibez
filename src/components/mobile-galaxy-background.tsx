
'use client';
import React, { useRef, useEffect } from 'react';

const isReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Star = {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  opacityDirection: number;
};

type ShootingStar = {
  x: number;
  y: number;
  len: number;
  speed: number;
  size: number;
  active: boolean;
};

type Nebula = {
  x: number;
  y: number;
  radius: number;
  color: string;
  opacity: number;
  opacityDirection: number;
};

export function MobileGalaxyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isReducedMotion()) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let stars: Star[] = [];
    let shootingStars: ShootingStar[] = [];
    let nebulas: Nebula[] = [];

    const setup = () => {
      const dpr = window.devicePixelRatio || 1;
      const vw = window.visualViewport ? window.visualViewport.width : window.innerWidth;
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;

      canvas.width = vw * dpr;
      canvas.height = vh * dpr;
      canvas.style.width = `${vw}px`;
      canvas.style.height = `${vh}px`;
      ctx.scale(dpr, dpr);

      stars = [];
      shootingStars = [];
      nebulas = [];

      // Create stars
      for (let i = 0; i < 300; i++) {
        stars.push({
          x: Math.random() * vw,
          y: Math.random() * vh,
          size: Math.random() * 1.2 + 0.3,
          speedX: (Math.random() - 0.5) * 0.1,
          speedY: (Math.random() * 0.15 + 0.1) * -1, // Move upwards
          opacity: Math.random() * 0.5 + 0.3,
          opacityDirection: Math.random() > 0.5 ? 1 : -1,
        });
      }
      
      // Create shooting stars
      for (let i = 0; i < 2; i++) {
        shootingStars.push({
            x: Math.random() * vw,
            y: Math.random() * vh,
            len: Math.random() * 80 + 10,
            speed: Math.random() * 8 + 4,
            size: Math.random() * 1 + 0.5,
            active: false
        });
      }

      // Create nebulas
      nebulas.push({ x: vw * 0.2, y: vh * 0.3, radius: vw * 0.8, color: 'hsla(260, 65%, 30%, 0.4)', opacity: 0.4, opacityDirection: 1 });
      nebulas.push({ x: vw * 0.8, y: vh * 0.8, radius: vw * 0.7, color: 'hsla(220, 70%, 40%, 0.3)', opacity: 0.3, opacityDirection: -1 });
      nebulas.push({ x: vw * 0.1, y: vh * 0.9, radius: vw * 0.6, color: 'hsla(320, 70%, 40%, 0.25)', opacity: 0.25, opacityDirection: 1 });

    };

    const draw = () => {
        if (!ctx || !canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const vw = window.visualViewport ? window.visualViewport.width : window.innerWidth;
        const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;

        canvas.width = vw * dpr;
        canvas.height = vh * dpr;
        canvas.style.width = `${vw}px`;
        canvas.style.height = `${vh}px`;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, vw, vh);
        ctx.fillStyle = '#000005';
        ctx.fillRect(0, 0, vw, vh);

        // Draw nebulas first
        nebulas.forEach(n => {
            const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius);
            const color = n.color.replace(/, ([\d.]+)\)/, `, ${n.opacity})`);
            grad.addColorStop(0, color);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, vw, vh);
        });

        // Draw stars on top
        stars.forEach(star => {
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(200, 100%, 95%, ${star.opacity})`;
            ctx.fill();
        });

        // Draw shooting stars on top
        shootingStars.forEach(s => {
            if (s.active) {
                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(s.x - s.len, s.y + s.len);
                ctx.strokeStyle = 'white';
                ctx.lineWidth = s.size;
                ctx.stroke();
            }
        });
    };

    const update = () => {
      if(!canvas) return;
      const vw = window.visualViewport ? window.visualViewport.width : window.innerWidth;
      const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      // Update stars
      stars.forEach(star => {
        star.x += star.speedX;
        star.y += star.speedY;

        // Twinkle effect
        star.opacity += 0.003 * star.opacityDirection;
        if (star.opacity <= 0.2 || star.opacity >= 0.8) {
          star.opacityDirection *= -1;
        }

        if (star.y < 0) {
            star.y = vh;
            star.x = Math.random() * vw;
        }
        if (star.x < 0) star.x = vw;
        if (star.x > vw) star.x = 0;
      });

      // Update shooting stars
       shootingStars.forEach(s => {
            if (s.active) {
                s.x -= s.speed;
                s.y += s.speed;
                if (s.x < 0 || s.y > vh) {
                    s.active = false;
                }
            } else if (Math.random() < 0.001) {
                s.active = true;
                s.x = Math.random() * vw / 2 + vw / 2;
                s.y = Math.random() * vh / 2;
                s.len = Math.random() * 80 + 10;
                s.speed = Math.random() * 8 + 4;
                s.size = Math.random() * 1 + 0.5;
            }
        });

        // Update nebulas
        nebulas.forEach(n => {
            n.opacity += 0.001 * n.opacityDirection;
            if(n.opacity > 0.6 || n.opacity < 0.2) n.opacityDirection *= -1;
        });

    };

    const animate = () => {
      update();
      draw();
      animationFrameId.current = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      setup();
      draw(); // Redraw immediately on resize
    };

    setup();
    animate();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  if (isReducedMotion()) {
      return <div className="fixed inset-0 bg-black -z-10" />;
  }

  return <canvas ref={canvasRef} id="mobile-galaxy-canvas" className="fixed inset-0 -z-10" aria-hidden="true"></canvas>;
}
