import { Text, type TextProps } from "react-native";
import { useTranslation } from "react-i18next";

import { colors } from "@/theme/tokens";
import { textStyle, type TextVariant } from "@/theme/typography";

const TONES = {
  ...colors.text,
  danger: colors.status.danger,
  success: colors.status.success,
  warning: colors.status.warning,
  brandLight: colors.brand.light,
  vivid: colors.brand.vivid,
} as const;

export type TextColor = keyof typeof TONES;

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: TextColor;
}

// The only text primitive: picks the type style and the font family for the active language.
export function AppText({ variant = "body", color = "primary", style, ...rest }: AppTextProps) {
  const { i18n } = useTranslation();
  return (
    <Text style={[textStyle(variant, i18n.language), { color: TONES[color] }, style]} {...rest} />
  );
}
