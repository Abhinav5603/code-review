import React, { useState, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import Dashboard from './components/Dashboard';

export default function App() {
  const { user, profile, loading, signUp, signIn, signOut } = useAuth();
  const [currentView, setCurrentView] = useState('login'); // 'login' | 'register' | 'dashboard'

  // Debug logging
  useEffect(() => {
    console.log('=== AUTH STATE CHANGE ===');
    console.log('User:', user);
    console.log('Profile:', profile);
    console.log('Profile Role:', profile?.role);
    console.log('Loading:', loading);
    console.log('========================');
  }, [user, profile, loading]);

  // Handle logout functionality
  const handleLogout = async () => {
    try {
      console.log('Logging out...');
      await signOut();
      setCurrentView('login'); // Redirect to login page
      console.log('Successfully logged out');
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if there's an error, redirect to login for safety
      setCurrentView('login');
    }
  };

  // Handle going back from dashboard (optional - could just logout)
  const handleBackFromDashboard = () => {
    // For now, just logout when back is pressed
    handleLogout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
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
        onLogout={handleLogout} // Pass logout handler to Dashboard
      />
    );
  }

  // Authentication views
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {currentView === 'login' ? (
          <LoginForm
            onLogin={async (email, password) => {
              try {
                console.log('Attempting login...');
                const result = await signIn(email, password);
                console.log('Login result:', result);
                // Don't need to manually redirect - the auth state change will handle it
              } catch (error) {
                console.error('Login failed:', error);
                // Handle login error (show error message to user)
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
                
                // Check if email confirmation is required
                if (result.user && !result.session) {
                  // Email confirmation required
                  console.log('Please check your email to confirm your account');
                  // Optionally show a message to the user or switch to login
                  setCurrentView('login');
                } else if (result.user && result.session) {
                  // User is immediately logged in
                  console.log('Registration successful and logged in');
                  // The auth state change will automatically redirect to dashboard
                }
              } catch (error) {
                console.error('Registration failed:', error);
                // Handle registration error (show error message to user)
              }
            }}
            onSwitchToLogin={() => setCurrentView('login')}
          />
        )}
      </div>
    </div>
  );
}