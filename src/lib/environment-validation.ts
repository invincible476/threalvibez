/**
 * Environment validation for production-ready security
 * This validates that required secrets and configurations are present
 * at startup to prevent unsafe fallbacks.
 */

export interface EnvironmentConfig {
  nodeEnv: string;
  isProduction: boolean;
  isDevelopment: boolean;
  allowDevFallback: boolean;
}

export function getEnvironmentConfig(): EnvironmentConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const isDevelopment = nodeEnv === 'development';
  // Convert string 'true' to boolean true, case insensitive
  const allowDevFallback = process.env.ALLOW_DEV_TOKEN_FALLBACK?.toLowerCase() === 'true';

  return {
    nodeEnv,
    isProduction,
    isDevelopment,
    allowDevFallback,
  };
}

export function validateEnvironmentSecrets(): void {
  const config = getEnvironmentConfig();
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log(`🔍 Environment validation for ${config.nodeEnv} environment...`);

  // Require project id in production. In development allow a fallback but warn.
  if (config.isProduction) {
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      errors.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID is required');
    }
  } else {
    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      warnings.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID not set - using development fallback');
    }
  }

  // Required for secure environments (production only)
  // In development with ALLOW_DEV_TOKEN_FALLBACK=true, we skip this check
  if (config.isProduction && !process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    errors.push('FIREBASE_SERVICE_ACCOUNT_KEY is required in production');
  }

  // Validate Firebase service account format if provided
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
        errors.push('FIREBASE_SERVICE_ACCOUNT_KEY is not a valid service account JSON');
      }
    } catch (error) {
      errors.push('FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON');
    }
  }

  // Development-specific warnings
  if (config.isDevelopment && config.allowDevFallback) {
    warnings.push('⚠️  DEVELOPMENT MODE: ALLOW_DEV_TOKEN_FALLBACK is enabled - this is INSECURE and must not be used in production');
  }

  // Production-specific validations
  if (config.isProduction) {
    // Ensure no development flags are set in production
    if (config.allowDevFallback) {
      errors.push('ALLOW_DEV_TOKEN_FALLBACK must not be enabled in production');
    }

    // Additional production requirements can be added here
    console.log('✅ Production environment security validation...');
  }

  // Log warnings
  warnings.forEach(warning => console.warn(warning));

  // Fail fast on errors
  if (errors.length > 0) {
    console.error('🚨 ENVIRONMENT VALIDATION FAILED:');
    errors.forEach(error => console.error(`   ❌ ${error}`));
    
    if (config.isProduction) {
      console.error('🚨 CRITICAL: Production deployment blocked due to security configuration errors');
    } else {
      console.error('🚨 Environment setup incomplete - please fix configuration errors');
    }
    
    throw new Error(`Environment validation failed: ${errors.join(', ')}`);
  }

  console.log('✅ Environment validation passed');
  
  // Log security status
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    console.log('🔒 Security: Firebase Admin SDK configured with service account');
  } else if (config.isDevelopment && config.allowDevFallback) {
    console.warn('⚠️  Security: Development mode with insecure fallback enabled');
  }
}

/**
 * Validates environment at startup - call this early in app initialization
 */
export function validateEnvironmentOnStartup(): void {
  try {
    validateEnvironmentSecrets();
  } catch (error) {
    console.error('Environment validation failed at startup:', error);
    // In production, this should prevent the app from starting
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    // In development, we'll log the error but allow the app to continue
    console.warn('Development mode: Continuing despite environment validation failure');
  }
}