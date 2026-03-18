"use client";

import { useEffect } from "react";

export function PWAInitializer() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((error) =>
          console.error("Service worker registration failed:", error)
        );
    }
  }, []);

  return null;
}


