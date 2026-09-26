import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { openUrl } from "@/platform/links";
import { verify, webVerifyLink, type VerifyAction } from "@/session/boot";
import type { VerifyError } from "@/session/device";
import { useSession } from "@/session/store";
import { colors, radius, spacing } from "@/theme/tokens";
import { goToBootRoute } from "@/utils/navigation";

const CAPTCHA_WIDTH = 240;
const CAPTCHA_HEIGHT = 80;

const ERROR_KEYS = {
  enter_code: "mobile_verify_enter_code",
  not_verified_yet: "mobile_verify_not_verified_yet",
  network: "mobile_verify_network_error",
  failed: "mobile_verify_failed",
} as const;

// Verify Your Device (R-003, current-app-inventory.md §3 Mobile): the captcha with a native text
// field, or the website verification followed by "I've verified — Continue".
export default function VerifyScreen() {
  const { t } = useTranslation();
  const challenge = useSession((s) => s.challenge);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<VerifyAction["kind"] | undefined>();
  const [openedWebsite, setOpenedWebsite] = useState(false);

  if (!challenge) return <Screen title={t("verify_your_device")}>{null}</Screen>;

  const run = (action: VerifyAction) => {
    setBusy(action.kind);
    verify(challenge, action)
      .catch(() => "server_failed" as const)
      .then((route) => {
        setBusy(undefined);
        setCode("");
        // Another captcha (wrong code, new code) stays here with the new image.
        if (route !== "verify") goToBootRoute(route);
      });
  };

  const errorText = (error: VerifyError) =>
    "message" in error ? error.message : t(ERROR_KEYS[error.key]);
  const uidMode = challenge.mode === "uid";

  return (
    <Screen title={t("verify_your_device")} testID="verify-screen">
      <AppText color="secondary">
        {uidMode ? challenge.message || t("mobile_verify_uid_mismatch") : t("verify_device_desc")}
      </AppText>
      <View
        style={styles.captcha}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t("mobile_captcha_image")}
        testID="captcha-image"
      >
        <SvgXml xml={challenge.svg} width={CAPTCHA_WIDTH} height={CAPTCHA_HEIGHT} />
      </View>
      <TextField
        value={code}
        onChangeText={setCode}
        placeholder={t("type_the_code")}
        autoCapitalize={uidMode ? "characters" : "none"}
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={() => run({ kind: "submit", code })}
        error={challenge.error ? errorText(challenge.error) : undefined}
        testID="captcha-input"
      />
      <Button
        label={t("verify")}
        variant="brand"
        loading={busy === "submit"}
        disabled={busy !== undefined}
        onPress={() => run({ kind: "submit", code })}
        testID="verify-submit"
      />
      <Button
        label={t("new_code")}
        variant="secondary"
        loading={busy === "new_code"}
        disabled={busy !== undefined}
        onPress={() => run({ kind: "new_code" })}
        testID="verify-new-code"
      />
      <AppText color="tertiary" style={styles.or}>
        {t("or")}
      </AppText>
      <Button
        label={t("mobile_verify_on_website")}
        variant="secondary"
        disabled={busy !== undefined}
        onPress={() => {
          setOpenedWebsite(true);
          void openUrl(webVerifyLink(challenge));
        }}
        testID="verify-website"
      />
      {openedWebsite ? (
        <Button
          label={t("mobile_verify_done_continue")}
          variant="primary"
          loading={busy === "web_continue"}
          disabled={busy !== undefined}
          onPress={() => run({ kind: "web_continue" })}
          testID="verify-web-continue"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  captcha: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.sm,
    borderRadius: radius.card,
    // svg-captcha draws coloured text and noise meant for a light background.
    backgroundColor: colors.text.primary,
  },
  or: { textAlign: "center" },
});
