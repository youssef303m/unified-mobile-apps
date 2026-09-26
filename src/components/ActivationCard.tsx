import { StyleSheet, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useTranslation } from "react-i18next";

import { qrPlaylistUrl } from "@/api/ibo/links";
import { config } from "@/config";
import { colors, radius, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";
import { Card } from "./Card";
import { CopyRow } from "./CopyRow";

const QR_SIZE = 180;
const WEBSITE_HOST = config.app.websiteUrl.replace(/^https?:\/\//, "");

/**
 * The "Add your playlist" card (user-flows.md §1 Mobile, screens.md Activation): the website, the
 * device id and key with copy buttons, and a QR of this device's playlist page for adding from
 * another device.
 */
export function ActivationCard({
  macAddress,
  deviceKey,
}: {
  macAddress: string;
  deviceKey: string;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <AppText variant="h3">{t("mobile_add_your_playlist")}</AppText>
      <AppText color="secondary">
        {t("visit")} <AppText variant="bodyStrong">{WEBSITE_HOST}</AppText>
      </AppText>
      <AppText color="secondary">{t("login_instruction_2")}</AppText>
      <CopyRow label={t("device_id_label")} value={macAddress} testID="device-id" />
      <CopyRow label={t("device_key_label")} value={deviceKey} testID="device-key" />
      {macAddress ? (
        <View
          style={styles.qr}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <QRCode
            value={qrPlaylistUrl(macAddress, "xc")}
            size={QR_SIZE}
            color={colors.text.inverse}
            backgroundColor={colors.text.primary}
            quietZone={spacing.md}
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  qr: { alignSelf: "center", borderRadius: radius.card, overflow: "hidden" },
});
