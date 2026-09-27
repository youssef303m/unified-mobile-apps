import { StyleSheet, View } from "react-native";
import { Check } from "lucide-react-native";

import { colors, layout, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";
import { ListRow } from "./ListRow";
import { Sheet } from "./Sheet";

// A single choice in a bottom sheet (user-flows.md §14 Mobile: "a radio dialog"): the setting's
// description, then one row per option with a tick on the current one. Choosing closes the sheet.
export interface OptionSheetProps<K extends string> {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  options: readonly { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  testID?: string;
}

export function OptionSheet<K extends string>({
  visible,
  onClose,
  title,
  description,
  options,
  value,
  onChange,
  testID,
}: OptionSheetProps<K>) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} testID={testID}>
      <View style={styles.body}>
        {description ? <AppText color="secondary">{description}</AppText> : null}
        {options.map((option) => (
          <ListRow
            key={option.key}
            title={option.label}
            selected={option.key === value}
            trailing={
              option.key === value ? (
                <Check size={layout.iconSize} color={colors.brand.primary} />
              ) : null
            }
            onPress={() => {
              onClose();
              if (option.key !== value) onChange(option.key);
            }}
            testID={testID ? `${testID}-${option.key}` : undefined}
          />
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
});
