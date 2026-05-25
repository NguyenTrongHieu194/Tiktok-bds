import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { AuthScreens } from './components/AuthScreens';
import { Onboarding } from './components/Onboarding';
import { MainApp } from './components/MainApp';
import { Sparkles, Brain } from 'lucide-react';

// Protected Route Middleware Orchestrator
const AppContent: React.FC = () => {
  const { user, profile, loading } = useAuth();

  // 1. Session Loading State
  if (loading) {
    return (
      <div id="loading-screen" className="min-h-screen w-full flex flex-col items-center justify-center bg-[#09090b] text-[#fafafa]">
        <div className="relative flex flex-col items-center">
          {/* Subtle spinning lights around brain icon */}
          <div className="absolute -inset-4 bg-rose-500/20 rounded-full blur-xl animate-pulse"></div>
          <Brain className="text-rose-500 animate-spin-slow mb-4 relative z-10" size={40} />
          <h3 className="font-extrabold text-white text-sm tracking-widest uppercase">AI BĐS</h3>
          <p className="text-[10px] text-zinc-500 font-mono mt-1 mb-4">Đang truy xuất phiên đăng nhập...</p>
          <div className="w-16 bg-zinc-900 border border-zinc-800 h-1 rounded-full overflow-hidden">
            <div className="bg-rose-500 h-full animate-loading-bar rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated state: display beautiful login panel
  if (!user) {
    return <AuthScreens />;
  }

  // 3. Authenticated but onboarding is incomplete: guide to picker
  if (!profile || !profile.isOnboarded) {
    return <Onboarding />;
  }

  // 4. Fully Authenticated and Onboarded state: enter Main Portal
  return <MainApp />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
