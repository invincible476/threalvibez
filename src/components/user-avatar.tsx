
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/types';
import type { User as FirebaseUser } from 'firebase/auth';

type UserLike = Partial<User> | (FirebaseUser | null) | {
  name?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  avatarUrl?: string | null;
  avatar?: string | null;
  isGroup?: boolean;
  type?: string;
};

type UserAvatarProps = {
  user?: UserLike;
  className?: string;
  isFriend?: boolean;
  hasStory?: boolean;
  storyViewed?: boolean;
  isGroup?: boolean;
};

export function UserAvatar({ user, className, isFriend, hasStory, storyViewed, isGroup }: UserAvatarProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);

  const isGroupChat = isGroup ?? (user && typeof user === 'object' && (
    ('isGroup' in user && Boolean((user as any).isGroup)) ||
    ('type' in user && (user as any).type === 'group')
  ));

  const effectiveHasStory = !isGroupChat && (hasStory ?? (user && typeof user === 'object' && 'hasActiveStory' in user ? (user as any).hasActiveStory : (user && typeof user === 'object' && 'hasStory' in user ? (user as any).hasStory : undefined)));
  const effectiveStoryViewed = !isGroupChat && (storyViewed ?? (user && typeof user === 'object' && 'storyViewed' in user ? (user as any).storyViewed : undefined));

  if (!user) {
    return (
      <Avatar
        hasStory={effectiveHasStory}
        storyViewed={effectiveStoryViewed}
        className={cn('animate-pulse bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 rounded-full overflow-hidden', className)}
      />
    );
  }

  const getInitials = (nameStr: string) => {
    const names = nameStr.trim().split(' ');
    const initials = names.map(n => n[0]).join('');
    return initials.slice(0, 2).toUpperCase();
  };

  const name = user && typeof user === 'object' ? (
    ('name' in user && (user as any).name) ||
    ('displayName' in user && (user as any).displayName) ||
    null
  ) : null;

  const photoURL = user && typeof user === 'object' ? (
    ('photoURL' in user && (user as any).photoURL) ||
    ('avatarUrl' in user && (user as any).avatarUrl) ||
    ('avatar' in user && (user as any).avatar) ||
    null
  ) : null;

  const status = user && typeof user === 'object' && 'status' in user ? (user as any).status : undefined;
  
  const groupLetter = isGroupChat ? ((name || 'Group').trim().charAt(0).toUpperCase() || 'G') : null;
  const fallback = isGroupChat ? groupLetter! : (name ? getInitials(name) : 'U');
  
  const canDisplayImage = photoURL && (photoURL.startsWith('data:image') || photoURL.startsWith('http')) && !hasImageError;

  const handleImageError = () => {
    console.log('Avatar image failed to load:', photoURL);
    setHasImageError(true);
    setIsImageLoading(false);
  };

  const handleImageLoad = () => {
    setIsImageLoading(false);
    setHasImageError(false);
  };

  return (
    <div className="relative shrink-0 flex-shrink-0 select-none">
      <Avatar
        hasStory={effectiveHasStory}
        storyViewed={effectiveStoryViewed}
        className={cn(
          'rounded-full overflow-hidden shrink-0 flex-shrink-0 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950', 
          className
        )}
      >
        {canDisplayImage ? (
          <>
            <AvatarImage
              src={photoURL}
              alt={name || (isGroupChat ? 'Group avatar' : 'User avatar')}
              className={cn(
                "aspect-square w-full h-full object-cover rounded-full transition-opacity duration-200",
                isImageLoading ? 'opacity-0' : 'opacity-100'
              )}
              style={{ 
                objectPosition: 'center',
                imageRendering: '-webkit-optimize-contrast'
              }}
              onError={handleImageError}
              onLoad={handleImageLoad}
            />
            {isImageLoading && (
              <AvatarFallback className={cn(
                "rounded-full animate-pulse bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 text-zinc-300",
                isGroupChat && "bg-gradient-to-br from-violet-700 via-purple-800 to-indigo-900 text-white font-bold"
              )}>
                {fallback}
              </AvatarFallback>
            )}
          </>
        ) : (
          <AvatarFallback className={cn(
            "rounded-full bg-zinc-800 text-zinc-200 font-medium",
            isGroupChat && "bg-gradient-to-br from-violet-700 via-purple-800 to-indigo-900 text-white font-bold"
          )}>
            {fallback}
          </AvatarFallback>
        )}
      </Avatar>
      {!isGroupChat && status === 'online' && (
        <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
      )}
    </div>
  );
}
