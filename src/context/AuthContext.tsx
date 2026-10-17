import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { api, setAuthToken, setSimulatedUser } from '../services/api.ts';
import { Department, Location, NotificationItem, Organization, SubLocation, User } from '../types/index.ts';
import { testFirestoreConnection } from '../services/firestoreService.ts';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  currentUser: User | null;
  users: User[];
  departments: Department[];
  locations: Location[];
  subLocations: SubLocation[];
  organization: Organization | null;
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  switchUser: (userId: number) => Promise<void>;
  refreshMasterData: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [subLocations, setSubLocations] = useState<SubLocation[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  const refreshMasterData = async () => {
    try {
      const data = await api.getMasterData();
      setDepartments(data.departments || []);
      setLocations(data.locations || []);
      setSubLocations(data.subLocations || []);
      setUsers(data.users || []);
      setOrganization(data.organization || null);
      if (data.currentUser) {
        setCurrentUser(data.currentUser);
      }
    } catch (err) {
      console.error('Failed to load master data:', err);
    }
  };

  const refreshNotifications = async () => {
    try {
      const notifs = await api.getNotifications();
      setNotifications(notifs);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const token = await user.getIdToken();
        setAuthToken(token);
      } else {
        setAuthToken(null);
      }
      await refreshMasterData();
      await refreshNotifications();
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const token = await cred.user.getIdToken();
      setAuthToken(token);
      await refreshMasterData();
      await refreshNotifications();
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      alert('Sign in failed: ' + (err.message || 'Please check popup settings'));
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setAuthToken(null);
    setSimulatedUser(null);
    await refreshMasterData();
  };

  const switchUser = async (userId: number) => {
    setSimulatedUser(userId);
    const targetUser = users.find(u => u.id === userId);
    if (targetUser) {
      setCurrentUser(targetUser);
    }
    await refreshNotifications();
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        currentUser,
        users,
        departments,
        locations,
        subLocations,
        organization,
        notifications,
        unreadCount,
        loading,
        activeTab,
        setActiveTab,
        globalSearch,
        setGlobalSearch,
        signInWithGoogle,
        logout,
        switchUser,
        refreshMasterData,
        refreshNotifications,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
