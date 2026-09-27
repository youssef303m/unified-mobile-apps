import { StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { subtitleFontSize, type SubtitleStyle } from "../playerSettings";
import { cueSpans, type Cue } from "../subtitles/srt";

// The external subtitle overlay (player.md §5.2, §5.4): the saved size, colours and position,
// with <i> <b> <u> <br> kept.
export interface SubtitleTextProps {
  cue: Cue | undefined;
  style: SubtitleStyle;
}

export function SubtitleText({ cue, style }: SubtitleTextProps) {
  const { width, height } = useWindowDimensions();
  if (!cue) return null;
  const fontSize = subtitleFontSize(style.size, Math.min(width, height));
  return (
    <View
      pointerEvents="none"
      style={[styles.root, { bottom: `${style.position}%` }]}
      testID="subtitle-text"
    >
      <Text
        style={[
          styles.text,
          {
            fontSize,
            lineHeight: fontSize * 1.25,
            color: style.textColor,
            backgroundColor: style.bgColor,
          },
        ]}
      >
        {cueSpans(cue.text).map((span, i) => (
          <Text
            key={i}
            style={[
              span.bold && styles.bold,
              span.italic && styles.italic,
              span.underline && styles.underline,
            ]}
          >
            {span.text}
          </Text>
        ))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", left: "8%", right: "8%", alignItems: "center" },
  text: { textAlign: "center", paddingHorizontal: 6 },
  bold: { fontWeight: "700" },
  italic: { fontStyle: "italic" },
  underline: { textDecorationLine: "underline" },
});
