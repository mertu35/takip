// Takip Sistemi - Kimlik Doğrulama Sağlayıcısı (AuthContext)
import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { onAuthStateChanged, login, logout, resetPassword } from "../services/auth";
import type { AppUser } from "../types";

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  loginUser: (email: string, password: string) => Promise<AppUser>;
  logoutUser: () => Promise<void>;
  resetPasswordEmail: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginUser = async (email: string, password: string) => {
    setError(null);
    try {
      const loggedUser = await login(email, password);
      setUser(loggedUser);
      return loggedUser;
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const logoutUser = async () => {
    setError(null);
    try {
      await logout();
      setUser(null);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const resetPasswordEmail = async (email: string) => {
    setError(null);
    try {
      await resetPassword(email);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, setError, loginUser, logoutUser, resetPasswordEmail }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth bir AuthProvider içinde kullanılmalıdır!");
  }
  return context;
};
