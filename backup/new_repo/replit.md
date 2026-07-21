# Vibez - Social Messaging App

## Overview
This is a Next.js social messaging application with Firebase authentication, AI chat features, stories, and real-time messaging capabilities. The app has been successfully imported and configured to run in the Replit environment.

## Project Architecture
- **Frontend**: Next.js 15.5.3 with React 18
- **Authentication**: Firebase Auth with Google provider support
- **Database**: Firebase Firestore for data storage
- **Storage**: Firebase Storage for media files
- **AI Features**: Google Genkit for AI chat functionality
- **UI**: Radix UI components with Tailwind CSS
- **PWA**: Progressive Web App capabilities with next-pwa

## Current Status
✅ **FULLY CONFIGURED AND RUNNING**
- Dependencies installed successfully (npm install completed)
- Next.js configured for Replit environment (port 5000, host 0.0.0.0)
- Development workflow set up and running
- Firebase configuration updated with fallback demo values
- Async/await syntax errors fixed in auth provider
- Deployment configuration completed (autoscale with Next.js build)
- Application tested and working properly

## Key Features
- Real-time chat messaging
- AI-powered chat with Google Gemini
- Stories functionality (like Instagram/WhatsApp status)
- User authentication and profiles
- Friends system
- Weather widget integration
- Image/video upload with Cloudinary
- Mobile-responsive design
- Glass morphism UI design

## Environment Configuration
The application requires Firebase configuration for full functionality. Currently using fallback demo values to allow basic operation.

**Required Firebase Environment Variables:**
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID` 
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_MEASUREMENT_ID`

**Additional API Keys:**
- `GEMINI_API_KEY` - For AI chat functionality
- `TENOR_API_KEY` - For GIF search
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` - For media upload
- `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` - For media upload

## Development
- **Start command**: `npm run dev` (configured for port 5000)
- **Build command**: `npm run build:next`
- **Production start**: `npm start`

## Deployment
Configured for Replit autoscale deployment with build step included.

## Recent Changes (2025-09-21)
- Successfully imported GitHub project and configured for Replit environment
- Installed all npm dependencies (1536 packages) - npm install completed successfully
- Next.js application properly configured and running on port 5000 with host 0.0.0.0
- Firebase configuration working with fallback demo values for development
- Development workflow "Frontend" successfully running and serving pages
- Deployment configuration set up for autoscale with proper build and start commands
- Application tested and verified working - compiles successfully and serves pages
- Cross-origin requests handled properly for Replit environment

## Next Steps
To fully utilize all features, configure proper Firebase project credentials and API keys through the Replit secrets manager.