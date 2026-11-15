import type { AutoSaveStatus } from "../lib/autoSaveStatus";
import { useRegisterAutoSaveStatus } from "./useAutoSaveStatus";

interface Props {
  status: AutoSaveStatus;
  lastSavedAt: number | null;
  onRetry: () => void;
  enabled?: boolean;
}

export default function AutoSaveStatusReporter({
  status,
  lastSavedAt,
  onRetry,
  enabled = true,
}: Props) {
  useRegisterAutoSaveStatus(status, lastSavedAt, onRetry, enabled);
  return null;
}
