// Android Back on the tab roots (03-design/screens.md, R-130): on a tab root Back goes to Home;
// on Home a first Back shows "Press back again to exit" and a second one within 2 s exits.
import { useCallback, useRef } from "react";
import { BackHandler } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";

import { showToast } from "@/components/Toast";
import { homeBackAction } from "@/content/rules/app";

export function useTabBack(isHome: boolean): void {
  const { t } = useTranslation();
  const lastBack = useRef<number | undefined>(undefined);
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!isHome) {
          router.navigate("/home");
          return true;
        }
        const now = Date.now();
        if (homeBackAction(lastBack.current, now) === "exit") {
          BackHandler.exitApp();
          return true;
        }
        lastBack.current = now;
        showToast({ text: t("mobile_press_back_again") });
        return true;
      });
      return () => sub.remove();
    }, [isHome, t]),
  );
}
