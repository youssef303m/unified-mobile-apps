import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { BackHandler, StyleSheet, View, useWindowDimensions } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetScrollView,
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

function useModal(visible: boolean, onClose: () => void, presentKey?: string | number) {
  const ref = useRef<BottomSheetModal>(null);
  const presented = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
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
  // The library calls this when the sheet is gone: after our own dismiss as well as a swipe, a tap
  // on the backdrop or Back. It is no longer presented then. Dismissing it again (the parent
  // hides it next) would leave the library waiting for a close animation that never comes, and
  // the sheet would never open again.
  const onDismiss = useCallback(() => {
    presented.current = false;
    onCloseRef.current();
  }, []);
  // A sheet lives in the app-wide provider, not in its screen: leaving the screen with the sheet
  // open must dismiss it, or it stays on top of whatever comes next. A layout effect, because the
  // sheet's ref is still set while this cleanup runs.
  useLayoutEffect(
    () => () => {
      if (!presented.current) return;
      presented.current = false;
      ref.current?.dismiss();
    },
    [],
  );
  // Android Back closes an open sheet first (its onDismiss then calls onClose).
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      ref.current?.dismiss();
      return true;
    });
    return () => sub.remove();
  }, [visible]);
  return { ref, onDismiss };
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

export interface SheetProps extends BaseProps {
  children: ReactNode;
  /** Long content (the player's track and settings sheets): a fixed height that scrolls. */
  scrollable?: boolean;
  /** Centred at this width on wide (landscape) screens. */
  maxWidth?: number;
}

export function Sheet({
  visible,
  presentKey,
  onClose,
  title,
  testID,
  children,
  scrollable = false,
  maxWidth,
}: SheetProps) {
  const { ref, onDismiss } = useModal(visible, onClose, presentKey);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const side = maxWidth && width > maxWidth ? (width - maxWidth) / 2 : 0;
  const body = (
    <View style={[styles.body, { paddingBottom: insets.bottom + spacing.lg }]}>
      <Title title={title} />
      {children}
    </View>
  );
  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={onDismiss}
      enableDynamicSizing={!scrollable}
      snapPoints={scrollable ? SCROLL_SNAP : undefined}
      maxDynamicContentSize={height * MAX_HEIGHT}
      backdropComponent={Backdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      style={[styles.shadow, side > 0 && { marginHorizontal: side }]}
    >
      {scrollable ? (
        <BottomSheetScrollView testID={testID}>{body}</BottomSheetScrollView>
      ) : (
        // Dynamic sizing measures BottomSheetView: padding on it keeps the sheet from showing.
        <BottomSheetView testID={testID}>{body}</BottomSheetView>
      )}
    </BottomSheetModal>
  );
}

const SCROLL_SNAP = ["90%"];

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
  const { ref, onDismiss } = useModal(visible, onClose);
  const insets = useSafeAreaInsets();
  const render = useCallback(({ item }: { item: T }) => renderItem(item), [renderItem]);
  return (
    <BottomSheetModal
      ref={ref}
      onDismiss={onDismiss}
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
        // Style A rows are outlined cards: inset like the header, with a gap (D-085).
        ItemSeparatorComponent={RowGap}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.lg }]}
      />
    </BottomSheetModal>
  );
}

function RowGap() {
  return <View style={styles.rowGap} />;
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.card.bg,
    borderTopStartRadius: radius.sheet,
    borderTopEndRadius: radius.sheet,
  },
  handle: { backgroundColor: colors.surface[3] },
  shadow: { boxShadow: `0px -4px 16px ${colors.shadow}` },
  body: { paddingHorizontal: layout.gutter, gap: spacing.md },
  list: { paddingHorizontal: layout.gutter },
  rowGap: { height: spacing.sm },
  listHeader: { paddingHorizontal: layout.gutter, gap: spacing.md, paddingBottom: spacing.sm },
  title: { textAlign: "center", paddingBottom: spacing.xs },
});
