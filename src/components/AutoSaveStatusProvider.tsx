import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  AutoSaveStatusContext,
  type AutoSaveStatusContextValue,
  type RegisteredStatus,
} from "./AutoSaveStatusContext";

export default function AutoSaveStatusProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [registeredStatus, setRegisteredStatus] =
    useState<RegisteredStatus | null>(null);
  const publish = useCallback<AutoSaveStatusContextValue["publish"]>(
    (source, snapshot) => {
      setRegisteredStatus((current) => {
        if (snapshot === null) {
          return current?.source === source ? null : current;
        }
        return { source, snapshot };
      });
    },
    [],
  );
  const value = useMemo(
    () => ({ snapshot: registeredStatus?.snapshot ?? null, publish }),
    [publish, registeredStatus],
  );

  return (
    <AutoSaveStatusContext.Provider value={value}>
      {children}
    </AutoSaveStatusContext.Provider>
  );
}
