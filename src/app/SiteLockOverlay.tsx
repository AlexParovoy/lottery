"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function SiteLockOverlay() {
  const pathname = usePathname();
  const [siteLocked, setSiteLocked] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const response = await fetch("/api/site-status", {
          cache: "no-store",
        });

        const result = await response.json();

        setSiteLocked(Boolean(result.siteLocked));
      } catch {
        setSiteLocked(false);
      } finally {
        setLoaded(true);
      }
    };

    void loadStatus();
  }, [pathname]);

  const isAdminPage = pathname?.startsWith("/admin");
  const shouldBlock =
    loaded &&
    siteLocked &&
    !isAdminPage &&
    (pathname === "/" ||
      pathname === "/draw-main" ||
      pathname === "/draw-extra" ||
      pathname === "/draw");

  if (!shouldBlock) return null;

  return (
    <div className="fixed inset-0 z-[999999] bg-black" aria-hidden="true" />
  );
}