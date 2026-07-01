// Takip Sistemi - Ana Uygulama Yönlendirme ve Sağlayıcı Entegrasyonu (App.tsx)
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";

// Sayfa bazlı code-splitting: Login dışındaki tüm sayfalar ilk yüklemede
// indirilmez, sadece ilgili rotaya gidildiğinde indirilir. Daha önce bu
// dosyada tüm sayfalar en üstte eager import ediliyordu (bkz. proje
// incelemesi: "route lazy-loading yok" eleştirisi).
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Sales = lazy(() => import("./pages/Sales"));
const Customers = lazy(() => import("./pages/Customers"));
const Accounting = lazy(() => import("./pages/Accounting"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Logs = lazy(() => import("./pages/Logs"));
const Settings = lazy(() => import("./pages/Settings"));

const RouteFallback = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "60vh",
      color: "var(--text-muted)"
    }}
  >
    Yükleniyor...
  </div>
);

// Ana sayfaya gelen kullanıcıyı rolüne göre ilgili ekrana yönlendiren ara bileşen
const HomeRedirect = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

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
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/login" element={<Login />} />

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

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
