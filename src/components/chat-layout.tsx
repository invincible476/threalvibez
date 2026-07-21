
'use client';

import { useMobileDesign } from './providers/mobile-provider';
import { DesktopChatLayout } from './desktop-chat-layout';
import { MobileChatLayout } from './mobile-chat-layout';
import { SidebarProvider } from './ui/sidebar';

export function ChatLayout() {
  const { isMobileView } = useMobileDesign();

  return (
    <SidebarProvider>
      {isMobileView ? <MobileChatLayout /> : <DesktopChatLayout />}
    </SidebarProvider>
  );
}
