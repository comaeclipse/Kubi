"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
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
const LAST_ACTIVE_KEY = "safevision_last_active";
const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes

export function ProfileProvider({
  children,
  initialProfiles,
}: {
  children: ReactNode;
  // Resolved on the server and shipped in the initial HTML — no on-mount fetch.
  initialProfiles: Profile[];
}) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const activeProfileIdRef = useRef<number | null>(null);

  const refreshProfiles = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/profiles");
      const data = await res.json();
      setProfiles(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    }
  }, []);

  // Restore the last-active profile from localStorage against the
  // server-provided profile list. localStorage isn't available during SSR, so
  // this runs once after mount.
  useEffect(() => {
    const storedId = localStorage.getItem(STORAGE_KEY);
    const lastActiveRaw = localStorage.getItem(LAST_ACTIVE_KEY);
    const elapsed = lastActiveRaw
      ? Date.now() - parseInt(lastActiveRaw)
      : Infinity;

    if (storedId && elapsed <= INACTIVITY_MS) {
      const id = parseInt(storedId);
      if (initialProfiles.some((p) => p.id === id)) {
        setActiveProfileId(id);
        activeProfileIdRef.current = id;
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    // initialProfiles is the server snapshot; restoration only needs to run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stamp the last-active time whenever the tab is hidden so inactivity is
  // measured from when the user actually left, not when they picked a profile.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "hidden" &&
        activeProfileIdRef.current !== null
      ) {
        localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const switchProfile = useCallback((id: number) => {
    setActiveProfileId(id);
    activeProfileIdRef.current = id;
    localStorage.setItem(STORAGE_KEY, id.toString());
    localStorage.setItem(LAST_ACTIVE_KEY, Date.now().toString());
  }, []);

  const clearProfile = useCallback(() => {
    setActiveProfileId(null);
    activeProfileIdRef.current = null;
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
