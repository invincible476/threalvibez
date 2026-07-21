
'use client';
import { ChatList } from './chat-list';
import { ChatView } from './chat-view';
import { useAppShell } from './app-shell';
import { Sidebar, SidebarInset } from './ui/sidebar';
import { useAppearance } from './providers/appearance-provider';
import React from 'react';

export function DesktopChatLayout() {
  const { 
    selectedChat,
    isAiReplying,
    currentUser,
    handleBack,
    messages,
    loadMoreMessages,
    hasMoreMessages,
    isLoadingMore
  } = useAppShell();
  const { chatListOpacity } = useAppearance();

  const desktopSidebarStyle = {
    // By setting the background to transparent, we allow the AppBackground to show through.
    // The opacity is controlled by the --card variable for the GlassCard effect inside ChatList.
    backgroundColor: 'transparent',
  } as React.CSSProperties;
  
  return (
    <div className="h-screen w-full flex overflow-hidden">
      <Sidebar
        collapsible="icon"
        className="backdrop-blur-xl border-r border-border/20 w-[22rem] max-w-[22rem] min-w-0 flex-shrink-0 flex-grow-0 overflow-x-hidden"
        style={desktopSidebarStyle}
      >
        <ChatList />
      </Sidebar>
      <SidebarInset>
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
      </SidebarInset>
    </div>
  );
}
