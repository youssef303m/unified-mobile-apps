import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { LoadingView } from "@/components/LoadingView";
import { BOOT_STEP_KEYS } from "@/i18n/statusKeys";
import { onBootStep, startBoot } from "@/session/boot";
import { useSession } from "@/session/store";
import { goToBootRoute } from "@/utils/navigation";

// Splash (screens.md): terms, device id, servers, verification or device info, then the screen
// the account state calls for (user-flows.md §1).
export default function SplashScreen() {
  const { t } = useTranslation();
  const [status, setStatus] = useState(() => t("loading_status"));
  const macAddress = useSession((s) => s.macAddress);
  const cancelRun = useRef<(() => void) | undefined>(undefined);

  /** Starts a boot; the returned function makes it stop updating this screen. */
  const begin = useCallback(() => {
    let live = true;
    onBootStep((step) => {
      if (live) setStatus(t(BOOT_STEP_KEYS[step]));
    });
    startBoot()
      .catch(() => "server_failed" as const)
      .then((route) => {
        if (live) goToBootRoute(route);
      });
    return () => {
      live = false;
    };
  }, [t]);

  useEffect(() => {
    const cancel = begin();
    cancelRun.current = cancel;
    return () => {
      cancel();
      onBootStep(undefined);
    };
  }, [begin]);

  const retry = useCallback(() => {
    cancelRun.current?.();
    setStatus(t("loading_status"));
    cancelRun.current = begin();
  }, [begin, t]);

  return <LoadingView status={status} onRetry={retry} macAddress={macAddress} />;
}
