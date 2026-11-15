import { createContext } from "react";
import type { AutoSaveStatus } from "../lib/autoSaveStatus";

export interface AutoSaveStatusSnapshot {
  status: AutoSaveStatus;
  lastSavedAt: number | null;
  onRetry: () => void;
}

export interface RegisteredStatus {
  source: symbol;
  snapshot: AutoSaveStatusSnapshot;
}

export interface AutoSaveStatusContextValue {
  snapshot: AutoSaveStatusSnapshot | null;
  publish: (source: symbol, snapshot: AutoSaveStatusSnapshot | null) => void;
}

export const AutoSaveStatusContext =
  createContext<AutoSaveStatusContextValue | null>(null);
