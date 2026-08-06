// Firebase Cloud Messaging Service Worker for background push notifications
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialize Firebase app inside the Service Worker environment
firebase.initializeApp({
  apiKey: "AIzaSyDf-sEGHlZH2MX6d1dRYwmVljqIHtRE2b4",
  authDomain: "blackvienna-ea6c7.firebaseapp.com",
  projectId: "blackvienna-ea6c7",
  storageBucket: "blackvienna-ea6c7.firebasestorage.app",
  messagingSenderId: "1003230563610",
  appId: "1:1003230563610:web:7d079d45682b5cc27730a3"
});

const messaging = firebase.messaging();

// Service worker lifecycle: activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle background push messages received when tabs/browsers are closed
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message: ', payload);

  // If payload already contains a webpush/notification payload, Firebase FCM compat SDK automatically handles display.
  // Otherwise display notification manually for data-only push messages.
  if (!payload.notification) {
    const notificationTitle = payload.data?.title || 'New Message on Vibez';
    const notificationOptions = {
      body: payload.data?.body || 'You have a new message.',
      icon: payload.data?.icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: payload.data?.chatId ? `vibez-chat-${payload.data.chatId}` : 'vibez-notification',
      renotify: true,
      data: payload.data || {}
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  }
});

// Handle notification click event: focus or navigate to the chat page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const chatId = event.notification.data?.chatId;
  const urlToOpen = chatId ? `/?chatId=${chatId}` : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (chatId && client.navigate) {
            client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
