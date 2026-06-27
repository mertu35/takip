// Takip Sistemi - Yetkilendirme ve Rota Koruyucu (ProtectedRoute)
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        fontSize: '1.25rem',
        fontWeight: 500
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'pulseSoft 1.5s infinite linear'
          }}></div>
          Yükleniyor...
        </div>
      </div>
    );
  }

  // Oturum kapalıysa Giriş sayfasına yönlendir
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Rota belirli bir rol gerektiriyorsa ve kullanıcının rolü uymuyorsa, ana sayfaya yönlendir
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
