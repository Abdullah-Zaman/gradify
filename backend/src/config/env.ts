/**
 * Central access to required environment variables.
 * Every getter throws at startup if a value is missing, so a misconfigured
 * server fails loudly instead of silently running with insecure defaults.
 */

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const MIN_SECRET_LENGTH = 32;

export function getJwtSecrets(): { accessSecret: string; refreshSecret: string } {
  const accessSecret = requireEnv('JWT_SECRET');
  const refreshSecret = requireEnv('JWT_REFRESH_SECRET');

  if (accessSecret.length < MIN_SECRET_LENGTH || refreshSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET and JWT_REFRESH_SECRET must each be at least ${MIN_SECRET_LENGTH} characters long`,
    );
  }
  if (accessSecret === refreshSecret) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }
  return { accessSecret, refreshSecret };
}

/** Comma-separated list of allowed browser origins for CORS. */
export function getAllowedOrigins(): string[] {
  const origins = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  if (origins.length === 0) {
    throw new Error('Missing required environment variable: FRONTEND_URL');
  }
  return origins;
}
