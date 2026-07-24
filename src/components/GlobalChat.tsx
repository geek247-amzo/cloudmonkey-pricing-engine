import { useEffect, useState } from "react";

import { FloatingSupportChat } from "@/components/dashboard/FloatingSupportChat";
import { CaesarChat } from "@/components/site/CaesarChat";
import { authClient } from "@/lib/auth-client";

export function GlobalChat() {
  const { data: session, isPending } = authClient.useSession();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Session state is client-specific, so defer the switch until hydration completes.
  if (!isMounted || isPending) return null;
  return session ? <FloatingSupportChat /> : <CaesarChat />;
}
