import { Text, type TextProps } from "react-native";
import { useTranslation } from "react-i18next";

import { colors } from "@/theme/tokens";
import { textStyle, type TextVariant } from "@/theme/typography";

type TextColor = keyof typeof colors.text;

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: TextColor;
}

// The only text primitive: picks the type style and the font family for the active language.
export function AppText({ variant = "body", color = "primary", style, ...rest }: AppTextProps) {
  const { i18n } = useTranslation();
  return (
    <Text
      style={[textStyle(variant, i18n.language), { color: colors.text[color] }, style]}
      {...rest}
    />
  );
}
