
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/types';
import type { User as FirebaseUser } from 'firebase/auth';

type UserLike = Partial<User> | (FirebaseUser | null);

type UserAvatarProps = {
  user?: UserLike;
  className?: string;
  isFriend?: boolean;
  hasStory?: boolean;
  storyViewed?: boolean;
};

export function UserAvatar({ user, className, isFriend, hasStory, storyViewed }: UserAvatarProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(true);

  const effectiveHasStory = hasStory ?? (user && typeof user === 'object' && 'hasActiveStory' in user ? (user as any).hasActiveStory : (user && typeof user === 'object' && 'hasStory' in user ? (user as any).hasStory : undefined));
  const effectiveStoryViewed = storyViewed ?? (user && typeof user === 'object' && 'storyViewed' in user ? (user as any).storyViewed : undefined);

  if (!user) {
    return (
      <Avatar
        hasStory={effectiveHasStory}
        storyViewed={effectiveStoryViewed}
        className={cn('animate-pulse bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 rounded-full overflow-hidden', className)}
      />
    );
  }

  const getInitials = (name: string) => {
    const names = name.split(' ');
    const initials = names.map(n => n[0]).join('');
    return initials.slice(0, 2).toUpperCase();
  }

  const name = 'name' in user ? user.name : ('displayName' in user ? user.displayName : null);
  const photoURL = 'photoURL' in user ? user.photoURL : user.photoURL;
  const status = 'status' in user ? user.status : undefined;
  
  const fallback = name ? getInitials(name) : 'U';
  
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
              alt={name || 'User avatar'}
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
              <AvatarFallback className="rounded-full animate-pulse bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-950 text-zinc-300">
                {fallback}
              </AvatarFallback>
            )}
          </>
        ) : (
          <AvatarFallback className="rounded-full bg-zinc-800 text-zinc-200">{fallback}</AvatarFallback>
        )}
      </Avatar>
      {status === 'online' && (
        <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
      )}
    </div>
  );
}
