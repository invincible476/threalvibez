
import type {NextConfig} from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: true, // Disable PWA for now
  register: false
});

const nextConfig: NextConfig = {
  /* config options here */
  // Set correct workspace root
  outputFileTracingRoot: __dirname,
  // Enable development optimizations
  reactStrictMode: true,
  crossOrigin: 'anonymous',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Optimize compilation
  compiler: {
    // Enables the styled-components SWC transform
    styledComponents: true,
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Optimize for development
  webpack: (config, { dev, isServer }) => {
    // Development optimizations
    if (dev) {
      // Optimize development build speed
      config.optimization = {
        ...config.optimization,
        runtimeChunk: false,
        minimize: false,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Combine all node_modules into a single chunk
            commons: {
              name: 'commons',
              chunks: 'all',
              minChunks: 2,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    return config;
  },
  // Configure allowed dev origins for cross-origin requests (Next.js 15 requires exact origins)
  allowedDevOrigins: process.env.NODE_ENV === 'development' 
    ? [
        // Current Replit domain (dynamically determined)
        process.env.REPLIT_DOMAINS || '2b711deb-9881-4c8e-9864-f2078ec28923-00-1z7caopfvm8sp.picard.replit.dev',
        // Additional common Replit subdomains for compatibility
        'localhost:9000',
        '0.0.0.0:9000'
      ]
    : [],
  // Optimize for Vercel deployment
  output: process.env.VERCEL ? 'standalone' : undefined,
  // Replit environment configuration
  async headers() {
    // Get the Firebase auth domain from env
    const firebaseAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '';
    
    return [
      {
        source: '/(.*)',
        headers: [
          // Security headers
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // Set CSP to allow Firebase auth and other necessary domains
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseio.com",
              `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebase.com ${firebaseAuthDomain} wss://*.firebaseio.com https://api.cloudinary.com https://media.tenor.com https://*.giphy.com https://*.tenor.com https://*.cloudinary.com`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https: blob: https://*.cloudinary.com https://media.tenor.com https://*.giphy.com",
              "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com",
              "media-src 'self' https: blob: https://*.cloudinary.com https://media.tenor.com https://*.giphy.com",
            ].join('; '),
          },
          // Allow cross-origin authentication for development
          ...(process.env.NODE_ENV === 'development' ? [
            {
              key: 'Access-Control-Allow-Origin',
              value: '*',
            },
            {
              key: 'Access-Control-Allow-Methods',
              value: 'GET, POST, PUT, DELETE, OPTIONS',
            },
            {
              key: 'Access-Control-Allow-Headers',
              value: 'X-Requested-With, Content-Type, Authorization',
            },
          ] : []),
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.staticneo.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.tenor.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "encrypted-tbn0.gstatic.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
   env: {
    // Firebase Configuration
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_MEASUREMENT_ID: process.env.NEXT_PUBLIC_MEASUREMENT_ID,
    
    // External Services
    NEXT_PUBLIC_TENOR_API_KEY: process.env.NEXT_PUBLIC_TENOR_API_KEY,
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET,
    NEXT_PUBLIC_GEMINI_API_KEY: process.env.GEMINI_API_KEY, // Add Gemini API key
    
    // Runtime Environment
    NEXT_PUBLIC_APP_URL: process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000',
    NEXT_PUBLIC_DEV_MODE: process.env.NODE_ENV === 'development' ? 'true' : 'false'
  },
};

export default withPWA(nextConfig);
