import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useAuth() {
  const [authState, setAuthState] = useState({
    user: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    let mounted = true; // Prevent state updates if component is unmounted

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

        try {
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
      // Get the role from user metadata
      const metadataRole = user.user_metadata?.role;
      
      // Create profile object from user metadata (primary source)
      const profileFromMetadata = {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || '',
        role: metadataRole || 'user',
      };

      // Try to get profile from database with timeout
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      // Add timeout to prevent hanging
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

      // If profile doesn't exist in DB, create it
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

      // If we got profile from DB successfully
      if (profile && !error) {
        const finalProfile = {
          ...profile,
          // Use metadata role if it exists, otherwise use DB role
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

      // Fallback: use metadata profile
      if (mounted) {
        setAuthState({
          user,
          profile: profileFromMetadata,
          loading: false,
        });
      }

    } catch (error) {
      console.error('Error fetching profile:', error);
      
      // Always ensure loading is set to false and provide fallback profile
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
    // Clear local state immediately
    setAuthState({ user: null, profile: null, loading: false });
    
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const updateProfile = async (updates) => {
    if (!authState.user) throw new Error('No user logged in');

    try {
      // If role is being updated, also update user metadata
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