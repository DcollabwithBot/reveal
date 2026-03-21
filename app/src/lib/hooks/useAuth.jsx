import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase.js';
import { getMembership } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial load
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user || null);
      if (s?.user) getMembership().then(m => setMembership(m)).catch(() => {});
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      setUser(s?.user || null);
      if (s?.user) getMembership().then(m => setMembership(m)).catch(() => {});
    });

    return () => subscription?.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, membership, loading, orgId: membership?.organization_id }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
