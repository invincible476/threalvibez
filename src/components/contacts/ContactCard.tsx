
import React from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/cards/GlassCard';
import { UserAvatar } from '@/components/user-avatar';
import { cn } from '@/lib/utils';
import type { User, Conversation } from '@/lib/types';
import { cardAnimationVariants, hoverAnimation, tapAnimation } from '@/styles/animation-specs';

interface ContactCardProps {
  contact: User;
  conversation?: Conversation;
  onClick: () => void;
  isSelected?: boolean;
}

const ContactCard: React.FC<ContactCardProps> = ({ contact, conversation, onClick, isSelected }) => {
  const lastMessage = conversation?.lastMessage;
  const unreadCount = conversation?.unreadCount || 0;

  const hasUnreadStory = false; 
  const storyRingClass = hasUnreadStory 
    ? 'ring-2 ring-offset-2 ring-offset-transparent ring-primary'
    : '';

  return (
    <motion.div
      onClick={onClick}
      className="w-full cursor-pointer"
      variants={cardAnimationVariants}
      initial="hidden"
      animate="visible"
      whileHover={hoverAnimation}
      whileTap={tapAnimation}
      layout
    >
      <GlassCard
        className={cn(
            "flex items-center p-3 gap-4 transition-all duration-300",
            isSelected && "bg-primary/10 border-primary/50"
        )}
      >
        <div className={cn('relative', storyRingClass, 'rounded-full')}>
          <UserAvatar user={contact} className="h-12 w-12" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center">
            <p className="font-bold truncate text-sm">{contact.name}</p>
            {lastMessage?.timestamp && (
              <p className="text-xs text-muted-foreground">
                {new Date(lastMessage.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <div className="flex justify-between items-start gap-2">
            <p className="text-xs text-muted-foreground truncate mt-1">
              {lastMessage?.text || 'No messages yet'}
            </p>
            {unreadCount > 0 && (
              <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-2 py-0.5 mt-1">
                {unreadCount}
              </span>
            )}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
};

export { ContactCard };
