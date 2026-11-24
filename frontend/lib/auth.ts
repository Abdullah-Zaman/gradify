import { create } from 'zustand';
import { clearAuthCookies, setAuthCookie } from './cookies';

export type UserRole = 'MANAGER' | 'SUPERVISOR' | 'STUDENT' | 'SUPER_ADMIN';

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
  isFirstLogin?: boolean;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  setAuth: (token: string, user: AuthUser, refreshToken?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  user:
    typeof window !== 'undefined'
      ? (() => {
          try {
            const stored = localStorage.getItem('user');
            if (!stored || stored === 'undefined' || stored === 'null') return null;
            return JSON.parse(stored);
          } catch {
            localStorage.removeItem('user');
            return null;
          }
        })()
      : null,
  setAuth: (token, user, refreshToken?) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    setAuthCookie('auth_token', token);
    // Lets the edge proxy gate first-login users without decoding the JWT body.
    setAuthCookie('first_login', user.isFirstLogin ? '1' : '0');
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    clearAuthCookies();
    set({ token: null, user: null });
  },
}));
