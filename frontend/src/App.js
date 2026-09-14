import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import Upload from "@/pages/Upload";
import PolicyAnalysis from "@/pages/PolicyAnalysis";
import PolicyHistory from "@/pages/PolicyHistory";
import PolicyCompare from "@/pages/PolicyCompare";
import AskAI from "@/pages/AskAI";
import VerificationCenter from "@/pages/VerificationCenter";
import Profile from "@/pages/Profile";
import AppLayout from "@/components/AppLayout";

function FullLoader() {
  return (
    <div className="min-h-screen app-bg grid place-items-center">
      <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null) return <FullLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading || user === null) return <FullLoader />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/upload" element={<Protected><Upload /></Protected>} />
      <Route path="/policy/:id" element={<Protected><PolicyAnalysis /></Protected>} />
      <Route path="/policies" element={<Protected><PolicyHistory /></Protected>} />
      <Route path="/compare" element={<Protected><PolicyCompare /></Protected>} />
      <Route path="/ask-ai" element={<Protected><AskAI /></Protected>} />
      <Route path="/ask-ai/:id" element={<Protected><AskAI /></Protected>} />
      <Route path="/verify" element={<Protected><VerificationCenter /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster theme="dark" position="top-right" richColors />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
