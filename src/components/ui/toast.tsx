"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Toast = { id: number; message: string };

const ToastContext = createContext<(message: string) => void>(() => {});

export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const publier = useCallback((message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((liste) => [...liste, { id, message }]);
    window.setTimeout(() => {
      setToasts((liste) => liste.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const valeur = useMemo(() => publier, [publier]);

  return (
    <ToastContext.Provider value={valeur}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((toast) => (
          <p key={toast.id} role="status" className="pointer-events-auto rounded-lg border border-green-200 bg-card px-3 py-2 text-sm text-success shadow-sm">
            {toast.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
