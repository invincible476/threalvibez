
'use client';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface EmojiReactionAnimationProps {
  emoji: string;
}

const numParticles = 40; // Increased for a fuller burst

export function EmojiReactionAnimation({ emoji }: EmojiReactionAnimationProps) {
  
  const particles = useMemo(() => Array.from({ length: numParticles }), []);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        overflow: 'hidden'
      }}
    >
      {particles.map((_, i) => {
        const angle = Math.random() * 360; // Random angle for burst direction
        const radius = Math.random() * 250 + 150; // Distance to travel from center
        const duration = Math.random() * 1.5 + 1; // 1s to 2.5s duration
        const delay = Math.random() * 0.2; // Staggered start for a more natural burst

        const x = Math.cos(angle * (Math.PI / 180)) * radius;
        const y = Math.sin(angle * (Math.PI / 180)) * radius;

        return (
          <motion.div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              fontSize: `${Math.random() * 1.5 + 1}rem`, // 1rem to 2.5rem
            }}
            initial={{ x: 0, y: 0, scale: 0.5, opacity: 1 }}
            animate={{
              x: x,
              y: y,
              scale: [1, 1.2, 0.8],
              opacity: [1, 1, 0],
              rotate: Math.random() * 720 - 360,
            }}
            transition={{
              duration,
              delay,
              ease: 'easeOut',
              opacity: { times: [0, 0.8, 1], duration }
            }}
          >
            {emoji}
          </motion.div>
        );
      })}
    </div>
  );
}
