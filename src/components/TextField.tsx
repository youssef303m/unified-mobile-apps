import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { colors, layout, radius, spacing } from "@/theme/tokens";
import { textStyle } from "@/theme/typography";

import { AppText } from "./AppText";

export interface TextFieldProps extends Pick<
  TextInputProps,
  | "value"
  | "onChangeText"
  | "placeholder"
  | "keyboardType"
  | "autoCapitalize"
  | "autoCorrect"
  | "autoFocus"
  | "maxLength"
  | "onSubmitEditing"
  | "returnKeyType"
  | "testID"
  | "editable"
> {
  label?: string;
  error?: string;
  /** A password field with a show/hide toggle. */
  secret?: boolean;
}

// A labelled native text input on surface.1, radius 8 (design-system.md §3).
export function TextField({ label, error, secret = false, ...input }: TextFieldProps) {
  const { t, i18n } = useTranslation();
  const [hidden, setHidden] = useState(secret);
  return (
    <View style={styles.root}>
      {label ? (
        <AppText variant="meta" color="secondary">
          {label}
        </AppText>
      ) : null}
      <View style={[styles.box, error ? styles.boxError : null]}>
        <TextInput
          {...input}
          accessibilityLabel={label ?? input.placeholder}
          secureTextEntry={hidden}
          placeholderTextColor={colors.text.tertiary}
          selectionColor={colors.brand.primary}
          style={[styles.input, textStyle("body", i18n.language)]}
        />
        {secret ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(hidden ? "mobile_show_password" : "mobile_hide_password")}
            onPress={() => setHidden((h) => !h)}
            style={styles.eye}
          >
            {hidden ? (
              <Eye size={layout.iconSize} color={colors.text.secondary} />
            ) : (
              <EyeOff size={layout.iconSize} color={colors.text.secondary} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="meta" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  box: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: layout.touchTarget,
    borderRadius: radius.input,
    backgroundColor: colors.surface[1],
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  boxError: { borderColor: colors.status.danger },
  input: { flex: 1, color: colors.text.primary, paddingHorizontal: spacing.md },
  eye: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
});
