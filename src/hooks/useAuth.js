import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [authState, setAuthState] = useState({
    user: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          if (mounted) {
            setAuthState({ user: null, profile: null, loading: false });
          }
          return;
        }

        if (session?.user) {
          await fetchProfile(session.user, mounted);
        } else {
          if (mounted) {
            setAuthState({ user: null, profile: null, loading: false });
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setAuthState({ user: null, profile: null, loading: false });
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('Auth state change event:', event);

        try {
          // Handle SIGNED_OUT event explicitly
          if (event === 'SIGNED_OUT') {
            console.log('User signed out, clearing state');
            setAuthState({ user: null, profile: null, loading: false });
            return;
          }

          if (session?.user) {
            await fetchProfile(session.user, mounted);
          } else {
            setAuthState({ user: null, profile: null, loading: false });
          }
        } catch (error) {
          console.error('Auth state change error:', error);
          setAuthState({ user: null, profile: null, loading: false });
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (user, mounted = true) => {
    if (!user) {
      if (mounted) {
        setAuthState({ user: null, profile: null, loading: false });
      }
      return;
    }

    try {
      const metadataRole = user.user_metadata?.role;
      
      const profileFromMetadata = {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || '',
        role: metadataRole || 'user',
      };

      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 10000)
      );

      let profile, error;
      try {
        const result = await Promise.race([profilePromise, timeoutPromise]);
        profile = result.data;
        error = result.error;
      } catch (timeoutError) {
        console.warn('Profile fetch timed out, using metadata profile');
        if (mounted) {
          setAuthState({
            user,
            profile: profileFromMetadata,
            loading: false,
          });
        }
        return;
      }

      if (error && error.code === 'PGRST116') {
        try {
          const { data: createdProfile, error: createError } = await supabase
            .from('profiles')
            .insert([{
              ...profileFromMetadata,
              created_at: new Date().toISOString(),
            }])
            .select()
            .single();

          if (!createError && createdProfile && mounted) {
            setAuthState({
              user,
              profile: createdProfile,
              loading: false,
            });
            return;
          }
        } catch (createError) {
          console.error('Error creating profile:', createError);
        }
      }

      if (profile && !error) {
        const finalProfile = {
          ...profile,
          role: metadataRole || profile.role || 'user',
        };

        if (mounted) {
          setAuthState({
            user,
            profile: finalProfile,
            loading: false,
          });
        }
        return;
      }

      if (mounted) {
        setAuthState({
          user,
          profile: profileFromMetadata,
          loading: false,
        });
      }

    } catch (error) {
      console.error('Error fetching profile:', error);
      
      if (mounted) {
        const metadataRole = user.user_metadata?.role;
        setAuthState({
          user,
          profile: {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || '',
            role: metadataRole || 'user',
          },
          loading: false,
        });
      }
    }
  };

  const signUp = async (name, email, password, role = 'user') => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { 
          name, 
          role: role
        },
      },
    });

    if (error) throw error;
    return data;
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    try {
      console.log('🚪 Starting logout process...');
      
      // IMPORTANT: Sign out from Supabase FIRST
      // This will clear the session from localStorage and trigger SIGNED_OUT event
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Error signing out from Supabase:', error);
        throw error;
      }
      
      console.log('✅ Successfully signed out from Supabase');
      
      // Clear local state (this will also be handled by the SIGNED_OUT event listener)
      setAuthState({ user: null, profile: null, loading: false });
      
      // Optional: Clear any additional localStorage/sessionStorage items your app uses
      // (Don't clear everything as it might break other apps in the same domain)
      // localStorage.removeItem('your-app-specific-key');
      
      console.log('✅ Logout complete');
      
    } catch (error) {
      console.error('❌ Logout failed:', error);
      // Even if there's an error, clear local state for security
      setAuthState({ user: null, profile: null, loading: false });
      throw error;
    }
  };

  const updateProfile = async (updates) => {
    if (!authState.user) throw new Error('No user logged in');

    try {
      if (updates.role) {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: { 
            ...authState.user.user_metadata,
            role: updates.role 
          }
        });
        
        if (metadataError) {
          console.error('Error updating user metadata:', metadataError);
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', authState.user.id)
        .select()
        .single();

      if (error) throw error;

      setAuthState((prev) => ({
        ...prev,
        profile: data,
      }));

      return data;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  return {
    ...authState,
    signUp,
    signIn,
    signOut,
    updateProfile,
  };
}