import { useCallback, useEffect, useRef, type ReactElement, type ReactNode } from "react";
import { BackHandler, StyleSheet, View, useWindowDimensions } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, layout, radius, spacing } from "@/theme/tokens";

import { AppText } from "./AppText";

// BottomSheet (design-system.md §5): @gorhom/bottom-sheet on bg.elevated, a drag handle and the
// 16 dp top radius. `Sheet` sizes itself to its content (PIN, quick actions, sort); `ListSheet`
// holds a long list (the category picker). Both are driven by `visible`; a swipe down or a tap
// on the backdrop calls `onClose`.
interface BaseProps {
  visible: boolean;
  /** A new value presents the sheet again while it stays visible (a new PIN request). */
  presentKey?: string | number;
  onClose: () => void;
  title?: string;
  testID?: string;
}

const MAX_HEIGHT = 0.9;

function useModal(visible: boolean, presentKey?: string | number) {
  const ref = useRef<BottomSheetModal>(null);
  const presented = useRef(false);
  useEffect(() => {
    if (visible) {
      presented.current = true;
      ref.current?.present();
    } else if (presented.current) {
      // Only a presented sheet is dismissed: dismissing one that never opened leaves it in the
      // library's queue, and the next sheet then fails to open.
      presented.current = false;
      ref.current?.dismiss();
    }
  }, [visible, presentKey]);
  // Android Back closes an open sheet first (its onDismiss then calls onClose).
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      ref.current?.dismiss();
      return true;
    });
    return () => sub.remove();
  }, [visible]);
  return ref;
}

function Backdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />;
}

function Title({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <AppText variant="h3" style={styles.title} accessibilityRole="header">
      {title}
    </AppText>
  );
}

export function Sheet({
  visible,
  presentKey,
  onClose,
  title,
  testID,
  children,
}: BaseProps & { children: ReactNode }) {
  const ref = useModal(visible, presentKey);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={onClose}
      enableDynamicSizing
      maxDynamicContentSize={height * MAX_HEIGHT}
      backdropComponent={Backdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      style={styles.shadow}
    >
      {/* Dynamic sizing measures BottomSheetView: padding on it keeps the sheet from showing. */}
      <BottomSheetView testID={testID}>
        <View style={[styles.body, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Title title={title} />
          {children}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

export interface ListSheetProps<T> extends BaseProps {
  data: readonly T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactElement;
  header?: ReactNode;
}

const LIST_SNAP = ["70%", "90%"];

export function ListSheet<T>({
  visible,
  onClose,
  title,
  testID,
  data,
  keyExtractor,
  renderItem,
  header,
}: ListSheetProps<T>) {
  const ref = useModal(visible);
  const insets = useSafeAreaInsets();
  const render = useCallback(({ item }: { item: T }) => renderItem(item), [renderItem]);
  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={onClose}
      snapPoints={LIST_SNAP}
      enableDynamicSizing={false}
      backdropComponent={Backdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      style={styles.shadow}
    >
      <View style={styles.listHeader} testID={testID}>
        <Title title={title} />
        {header}
      </View>
      <BottomSheetFlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={render}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
      />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.bg.elevated,
    borderTopStartRadius: radius.sheet,
    borderTopEndRadius: radius.sheet,
  },
  handle: { backgroundColor: colors.surface[3] },
  shadow: { boxShadow: `0px -4px 16px ${colors.shadow}` },
  body: { paddingHorizontal: layout.gutter, gap: spacing.md },
  listHeader: { paddingHorizontal: layout.gutter, gap: spacing.md, paddingBottom: spacing.sm },
  title: { textAlign: "center", paddingBottom: spacing.xs },
});
