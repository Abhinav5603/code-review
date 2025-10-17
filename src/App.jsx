import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import Dashboard from './components/Dashboard';

export default function App() {
  const { user, profile, loading, signUp, signIn, signOut } = useAuth();
  const [currentView, setCurrentView] = useState('login');

  // Debug logging
  useEffect(() => {
    console.log('=== AUTH STATE CHANGE ===');
    console.log('User:', user);
    console.log('Profile:', profile);
    console.log('Profile Role:', profile?.role);
    console.log('Loading:', loading);
    console.log('========================');
  }, [user, profile, loading]);

  // Reset view to login when user logs out
  useEffect(() => {
    if (!user && !loading) {
      console.log('No user detected, showing login page');
      setCurrentView('login');
    }
  }, [user, loading]);

  // Handle logout functionality
  const handleLogout = async () => {
    try {
      console.log('🚪 Logout initiated from App...');
      await signOut();
      setCurrentView('login');
      console.log('✅ Successfully logged out, redirected to login');
    } catch (error) {
      console.error('❌ Logout failed:', error);
      // Force redirect to login even on error for security
      setCurrentView('login');
    }
  };

  // Handle going back from dashboard
  const handleBackFromDashboard = () => {
    handleLogout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // If user is logged in, show dashboard
  if (user && profile) {
    return (
      <Dashboard 
        onBack={handleBackFromDashboard}
        profile={profile}
        onLogout={handleLogout}
      />
    );
  }

  // Authentication views
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {currentView === 'login' ? (
          <LoginForm
            onLogin={async (email, password) => {
              try {
                console.log('Attempting login...');
                const result = await signIn(email, password);
                console.log('Login successful:', result.user?.email);
              } catch (error) {
                console.error('Login failed:', error);
                alert('Login failed: ' + error.message);
              }
            }}
            onSwitchToRegister={() => setCurrentView('register')}
          />
        ) : (
          <RegisterForm
            onRegister={async (name, email, password, role) => {
              try {
                console.log('Attempting registration with role:', role);
                const result = await signUp(name, email, password, role);
                console.log('Registration result:', result);
                
                if (result.user && !result.session) {
                  alert('Please check your email to confirm your account');
                  setCurrentView('login');
                } else if (result.user && result.session) {
                  console.log('Registration successful and logged in');
                }
              } catch (error) {
                console.error('Registration failed:', error);
                alert('Registration failed: ' + error.message);
              }
            }}
            onSwitchToLogin={() => setCurrentView('login')}
          />
        )}
      </div>
    </div>
  );
}