"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface Profile {
  id: number;
  name: string;
  avatarColor: string;
  createdAt: string;
}

interface ProfileContextValue {
  profiles: Profile[];
  activeProfile: Profile | null;
  loading: boolean;
  switchProfile: (id: number) => void;
  clearProfile: () => void;
  refreshProfiles: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

const STORAGE_KEY = "safevision_active_profile_id";

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfiles = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/profiles");
      const data = await res.json();
      setProfiles(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/profiles");
        const data = await res.json();
        const fetched: Profile[] = Array.isArray(data) ? data : [];
        setProfiles(fetched);

        const storedId = localStorage.getItem(STORAGE_KEY);
        if (storedId) {
          const id = parseInt(storedId);
          const exists = fetched.some((p) => p.id === id);
          if (exists) {
            setActiveProfileId(id);
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch {
        // ignore
      }
      setLoading(false);
    }
    init();
  }, []);

  const switchProfile = useCallback((id: number) => {
    setActiveProfileId(id);
    localStorage.setItem(STORAGE_KEY, id.toString());
  }, []);

  const clearProfile = useCallback(() => {
    setActiveProfileId(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) ?? null;

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        activeProfile,
        loading,
        switchProfile,
        clearProfile,
        refreshProfiles,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return ctx;
}
