import React, { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, Zap, Shield } from 'lucide-react';

export default function RegisterForm({ onRegister, onSwitchToLogin, loading = false }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('user');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password || password !== confirmPassword) return;

    setIsSubmitting(true);
    setError(null);

    try {
      console.log('Registering user with:', { name, email, role });
      await onRegister(name, email, password, role);
      console.log('Registration successful for role:', role);
    } catch (err) {
      console.error('Registration error:', err);
      setError(err?.message || 'An error occurred during registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = name && email && password && password === confirmPassword && password.length >= 6;
  const isLoading = loading || isSubmitting;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-slate-800/40 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/10">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Create Account</h2>
            <p className="text-slate-400">Join us to get started</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
                <p className="text-rose-300 text-sm">{error}</p>
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your full name"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your password"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
                  placeholder="Confirm your password"
                  required
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-rose-300 text-xs mt-2">Passwords do not match</p>
              )}
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Account Role
              </label>
              <div className="relative">
                <Shield className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 w-5 h-5" />
                <select
                  value={role}
                  onChange={(e) => {
                    console.log('Role changed to:', e.target.value);
                    setRole(e.target.value);
                  }}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 appearance-none cursor-pointer"
                >
                  <option value="user" className="bg-slate-800 text-white">User</option>
                  <option value="admin" className="bg-slate-800 text-white">Admin</option>
                </select>
              </div>
              <p className="text-slate-500 text-xs mt-2">
                Selected role: <span className="text-cyan-400 font-medium">{role}</span>
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !isValid}
              className={`w-full py-3.5 rounded-xl font-semibold transition-all duration-200 ${
                isLoading || !isValid
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg shadow-blue-500/30 hover:scale-105'
              }`}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-slate-400">
              Already have an account?{' '}
              <button
                onClick={onSwitchToLogin}
                className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}