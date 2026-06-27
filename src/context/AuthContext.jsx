// Takip Sistemi - Kimlik Doğrulama Sağlayıcısı (AuthContext)
import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged, login, logout, resetPassword } from "../services/auth";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginUser = async (email, password) => {
    setError(null);
    try {
      const loggedUser = await login(email, password);
      setUser(loggedUser);
      return loggedUser;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logoutUser = async () => {
    setError(null);
    try {
      await logout();
      setUser(null);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const resetPasswordEmail = async (email) => {
    setError(null);
    try {
      await resetPassword(email);
    } catch (err) {
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth bir AuthProvider içinde kullanılmalıdır!");
  }
  return context;
};
