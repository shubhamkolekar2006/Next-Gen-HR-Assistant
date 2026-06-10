import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '@/services/api';
import type { AuthUser } from '@/types/api';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    let isActive = true;

    const initializeSession = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        localStorage.removeItem('user');
        setUser(null);
        setIsAuthenticated(false);
        return;
      }

      try {
        const response = await authService.me();
        if (!isActive) return;

        const userData = response?.data?.user;
        if (userData) {
          setUser(userData);
          setIsAuthenticated(true);
          localStorage.setItem('user', JSON.stringify(userData));
        }
      } catch (error) {
        if (!isActive) return;
        localStorage.removeItem('user');
        localStorage.removeItem('access_token');
        setUser(null);
        setIsAuthenticated(false);
      }
    };

    void initializeSession();

    return () => {
      isActive = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password);
      const { access_token, user: userData } = response.data;

      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('access_token', access_token);
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.message ||
        'Unable to sign in. Please check your credentials and try again.';
      throw new Error(message);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const response = await authService.register(name, email, password);
      const { access_token, user: userData } = response.data;

      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('access_token', access_token);
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ||
        error?.message ||
        'Unable to create account. Please try again.';
      throw new Error(message);
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

