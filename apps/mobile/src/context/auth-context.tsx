import {
  deleteToken,
  deleteTokenWithRetry,
  getToken,
  isSignoutBlocked,
  saveToken,
  setSignoutBlocked,
} from "@/lib/auth";
import { api } from "@/lib/axios";
import { User } from "@food-xpress/types";
import { createContext, use, useContext, useEffect, useState } from "react";


export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  register: (data: RegisterData) => Promise<void>;
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
};

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkExistingSession()
  }, []);

  async function checkExistingSession() {
    try {
      // A previous logout failed to remove the persisted token. Refuse to
      // restore the session so the user isn't silently logged back in.
      if (await isSignoutBlocked()) {
        await deleteTokenWithRetry();
        return;
      }

      const token = await getToken();

      if (token) {
        setToken(token);
        const res = await api.get('/auth/me');
        setUser(res.data);
      }
    } catch (error) {
      await deleteToken();
    } finally {
      setIsLoading(false)
    }
  };

  async function login(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password })
    await saveToken(res.data.token);
    await setSignoutBlocked(false);

    setToken(res.data.token);
    setUser(res.data.user);
  };

  async function register(data: RegisterData) {
    const res = await api.post('/auth/register', data);
    await saveToken(res.data.token);
    await setSignoutBlocked(false);

    setToken(res.data.token);
    setUser(res.data.user);
  };

  async function logout() {
    try {
      const removed = await deleteTokenWithRetry();

      if (!removed) {
        // The persisted token could not be removed. Persist a marker so a
        // later provider mount (checkExistingSession) does not restore the
        // session from the leftover token.
        await setSignoutBlocked(true);
      }
    } finally {
      // Always clear the in-memory session for the current process.
      setToken(null);
      setUser(null);
    };
  };


  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  )
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) throw new Error('useAuth must be used inside AuthProvider');

  return context;
}