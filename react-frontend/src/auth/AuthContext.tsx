import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import {
  clearCredential,
  getCredential,
  setCredential,
  subscribe,
  type Credential,
} from './credentialStore';

interface AuthContextValue {
  credential: Credential | null;
  login: (credential: Credential) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const credential = useSyncExternalStore(subscribe, getCredential);

  const value: AuthContextValue = {
    credential,
    login: setCredential,
    logout: clearCredential,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
