import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";

export function useHydratedSession() {
  const [isHydrated, setIsHydrated] = useState(false);
  const session = authClient.useSession();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return {
    ...session,
    isHydrated,
    authReady: isHydrated && !session.isPending,
  };
}

export function useAdminAccess() {
  const session = useHydratedSession();
  const role = session.authReady ? session.data?.user?.role : undefined;
  const isAdmin = role === "admin" || role === "owner";

  return {
    ...session,
    isAdmin,
  };
}
