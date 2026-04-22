import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

export type AuthMode = 'loading' | 'guest' | 'user';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('loading');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthMode(currentUser ? 'user' : 'guest');
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Erro ao fazer login:', error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erro ao terminar sessão:', error);
    }
  };

  const continueAsGuest = () => {
    setAuthMode('guest');
  };

  return { user, authMode, login, logout, continueAsGuest };
};
