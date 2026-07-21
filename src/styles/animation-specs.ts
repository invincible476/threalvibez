
import { Variants } from 'framer-motion';

export const cardAnimationVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 6,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      damping: 18,
      stiffness: 120,
      duration: 0.42,
    },
  },
};

export const hoverAnimation = {
  scale: 1.01,
  transition: {
    type: 'spring',
    duration: 0.2,
  },
};

export const tapAnimation = {
  scale: 0.995,
};
