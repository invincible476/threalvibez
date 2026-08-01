
'use client';
import { ChatView } from './chat-view';
import { useAppShell } from './app-shell';
import { ChatList } from './chat-list';
import { ErrorBoundary } from './error-boundary';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
      className="relative flex flex-col w-full h-full overflow-hidden z-10 mobile-adjusted"
      style={{ height: viewportHeight, maxWidth: '100vw' }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {!selectedChat ? (
          <motion.div
            key="chat-list"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 min-h-0 w-full h-full will-change-[transform,opacity] motion-layer"
          >
            <ErrorBoundary label="ChatList">
              <ChatList />
            </ErrorBoundary>
          </motion.div>
        ) : (
          <motion.div
            key={`chat-view-${selectedChat.id}`}
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 min-h-0 w-full h-full absolute inset-0 z-20 bg-background will-change-[transform,opacity] motion-layer"
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

