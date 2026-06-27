// Takip Sistemi - Ana Uygulama Yönlendirme ve Sağlayıcı Entegrasyonu (App.jsx)
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

// Sayfa Bileşenleri
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Customers from "./pages/Customers";
import Accounting from "./pages/Accounting";
import Inventory from "./pages/Inventory";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";

// Ana sayfaya gelen kullanıcıyı rolüne göre ilgili ekrana yönlendiren ara bileşen
const HomeRedirect = () => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Rol bazlı ana sayfa yönlendirmesi
  if (user.role === "admin") {
    return <Dashboard />;
  } else if (user.role === "sysadmin") {
    return <Navigate to="/settings" replace />;
  } else if (user.role === "sales") {
    return <Navigate to="/sales" replace />;
  } else if (user.role === "accounting") {
    return <Navigate to="/accounting" replace />;
  }

  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Giriş Rotası */}
            <Route path="/login" element={<Login />} />

            {/* Korumalı Rotalar (Ortak Layout ile) */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HomeRedirect />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/sales"
              element={
                <ProtectedRoute allowedRoles={["sales"]}>
                  <Layout>
                    <Sales />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/customers"
              element={
                <ProtectedRoute allowedRoles={["sales", "admin"]}>
                  <Layout>
                    <Customers />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/accounting"
              element={
                <ProtectedRoute allowedRoles={["admin", "accounting"]}>
                  <Layout>
                    <Accounting />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/inventory"
              element={
                <ProtectedRoute allowedRoles={["admin", "sales", "accounting"]}>
                  <Layout>
                    <Inventory />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/logs"
              element={
                <ProtectedRoute allowedRoles={["admin", "sysadmin"]}>
                  <Layout>
                    <Logs />
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={["sysadmin"]}>
                  <Layout>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Bilinmeyen Rotayı Giriş'e veya Ana Sayfa'ya yönlendir */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
