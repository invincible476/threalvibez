
'use client';
import { ChatView } from './chat-view';
import { useAppShell } from './app-shell';
import { ChatList } from './chat-list';
import React from 'react';
import { useMobileKeyboardHeight } from '@/hooks/use-mobile-keyboard-height';

export function MobileChatLayout() {
  const {
    selectedChat,
    isAiReplying,
    currentUser,
    handleBack,
    messages,
    loadMoreMessages,
    hasMoreMessages,
    isLoadingMore,
  } = useAppShell();

  // Dynamically set height to visible viewport (accounts for keyboard)
  const { viewportHeight } = useMobileKeyboardHeight();

  return (
    <div
      className="flex flex-col w-full h-full overflow-hidden z-10 mobile-adjusted"
      style={{ height: viewportHeight, maxWidth: '100vw' }}
    >
      {/* Only render one main view at a time */}
      {!selectedChat ? (
        <div className="flex-1 min-h-0">
          <ChatList />
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <ChatView
            chat={selectedChat}
            isAiReplying={isAiReplying}
            currentUser={currentUser}
            onBack={handleBack}
            messages={messages}
            loadMoreMessages={loadMoreMessages}
            hasMoreMessages={hasMoreMessages}
            isLoadingMore={isLoadingMore}
          />
        </div>
      )}
    </div>
  );
}
