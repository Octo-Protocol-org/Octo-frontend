"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function StorageWarningToast() {
  useEffect(() => {
    function onStorageWarning(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      toast.warning(detail || "Your encrypted wallet backup could not be cached locally.");
    }
    window.addEventListener("octo-storage-warning", onStorageWarning);
    return () => window.removeEventListener("octo-storage-warning", onStorageWarning);
  }, []);

  return null;
}
