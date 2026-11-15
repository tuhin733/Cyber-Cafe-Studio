import { useContext, useEffect, useRef } from "react";
import type { AutoSaveStatus } from "../lib/autoSaveStatus";
import { AutoSaveStatusContext } from "./AutoSaveStatusContext";

export function useAppAutoSaveStatus() {
  return useContext(AutoSaveStatusContext)?.snapshot ?? null;
}

export function useRegisterAutoSaveStatus(
  status: AutoSaveStatus,
  lastSavedAt: number | null,
  onRetry: () => void,
  enabled = true,
) {
  const publish = useContext(AutoSaveStatusContext)?.publish;
  const source = useRef(Symbol("autosave-status"));

  useEffect(() => {
    const sourceId = source.current;
    if (!publish || !enabled) return;
    publish(sourceId, { status, lastSavedAt, onRetry });
    return () => publish(sourceId, null);
  }, [enabled, lastSavedAt, onRetry, publish, status]);
}
