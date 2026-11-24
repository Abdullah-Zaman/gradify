const SEVEN_DAYS = 7 * 24 * 3600;

// Secure cookies are only sent over HTTPS, so add the flag in production only;
// plain http://localhost keeps working during development.
const SECURE = process.env.NODE_ENV === 'production' ? '; Secure' : '';

export function setAuthCookie(name: 'auth_token' | 'first_login', value: string, maxAge = SEVEN_DAYS) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${SECURE}`;
}

export function clearAuthCookies() {
  document.cookie = `auth_token=; path=/; max-age=0; SameSite=Lax${SECURE}`;
  document.cookie = `first_login=; path=/; max-age=0; SameSite=Lax${SECURE}`;
}

export function hasAuthCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((c) => {
    const [k, v] = c.trim().split('=');
    return k === 'auth_token' && !!v;
  });
}
