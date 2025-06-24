import React, { useState, createContext, useContext } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import IdeaPage from "./pages/Idea";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

const queryClient = new QueryClient();

// Add a type for user profile to help with property access
interface UserProfile {
  preferred_industries?: string[];
  industry?: string;
  preferred_business_models?: string[];
}

// Add this context for idea refresh
export const IdeaRefreshContext = createContext({ refreshIdeas: () => {} });

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

// Authentication Page Component
const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      {isLogin ? (
        <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
      ) : (
        <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
      )}
    </div>
  );
};

// Main App Routes Component
const AppRoutes = ({ refreshFlag }) => {
  const { user, isLoading, refreshUser } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);
  const { toast } = useToast();
  const { refreshIdeas } = useContext(IdeaRefreshContext);
  
  // Check if user needs onboarding
  React.useEffect(() => {
    if (user) {
      console.log('User logged in:', user);
      console.log('User profile:', user.profile);
      
      // Show onboarding if user has no profile or hasn't completed onboarding
      if (!user.profile || !user.profile.onboarding_completed) {
        console.log('Showing onboarding - user needs to complete profile');
        setShowOnboarding(true);
      } else {
        console.log('User has completed onboarding');
        setShowOnboarding(false);
      }
    }
  }, [user]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  if (generatingIdeas) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-lg text-slate-600">Generating your starter ideas...</p>
        </div>
      </div>
    );
  }
  
  // Show onboarding if user is logged in but hasn't completed it
  if (user && showOnboarding) {
    console.log('Rendering onboarding wizard');
    return (
      <OnboardingWizard 
        onComplete={async () => {
          setGeneratingIdeas(true);
          try {
            // Use user's onboarding profile for personalization
            const profile = (user?.profile || {}) as UserProfile;
            const industry = profile.preferred_industries?.[0] || profile.industry || '';
            const business_model = profile.preferred_business_models?.[0] || '';
            await api.post('/ideas/generate', {
              industry,
              business_model,
              context: '',
              use_personalization: true,
            });
            await refreshUser();
            setShowOnboarding(false);
            refreshIdeas();
            window.location.href = '/';
          } catch (err) {
            setGeneratingIdeas(false);
            toast({
              title: 'Idea Generation Failed',
              description: 'Could not generate starter ideas. Please try again.',
              variant: 'destructive',
            });
          }
        }} 
      />
    );
  }
  
  // If user is logged in and has completed onboarding, show main app
  if (user && !showOnboarding) {
    console.log('Rendering main app routes');
    return (
      <Routes>
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Index refreshFlag={refreshFlag} />
            </ProtectedRoute>
          } 
        >
          <Route path="ideas/:id" element={<IdeaPage />} />
        </Route>
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } 
        />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        {/* Redirect /auth to home when logged in */}
        <Route path="/auth" element={<Navigate to="/" replace />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }
  
  // If not logged in, show auth page
  console.log('User not logged in, showing auth page');
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  );
};

const App = () => {
  const [refreshFlag, setRefreshFlag] = useState(0);
  const refreshIdeas = () => setRefreshFlag(f => f + 1);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <IdeaRefreshContext.Provider value={{ refreshIdeas }}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AppRoutes refreshFlag={refreshFlag} />
          </TooltipProvider>
        </IdeaRefreshContext.Provider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
