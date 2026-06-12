"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { syncManager } from "@/lib/offline/sync";

interface NetworkState {
  online: boolean;
  pending: number;
}

const NetworkContext = createContext<NetworkState>({
  online: true,
  pending: 0,
});

export function useNetwork(): NetworkState {
  return useContext(NetworkContext);
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setOnline(navigator.onLine);
    syncManager.start();
    const offOnline = syncManager.on("online", setOnline);
    const offPending = syncManager.on("pending", setPending);
    void syncManager.refreshPending();
    return () => {
      offOnline();
      offPending();
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ online, pending }}>
      {children}
    </NetworkContext.Provider>
  );
}
