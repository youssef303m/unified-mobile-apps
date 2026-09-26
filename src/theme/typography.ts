// Typography: 03-design/design-system.md §2.
// Android picks a font file by family name, not by fontWeight, so every weight is its own family.
import type { TextStyle } from "react-native";

export type FontWeight = 400 | 500 | 600 | 700 | 800;
export type Script = "latin" | "arabic" | "devanagari";

const families: Record<Script, Record<FontWeight, string>> = {
  latin: {
    400: "Inter_400Regular",
    500: "Inter_500Medium",
    600: "Inter_600SemiBold",
    700: "Inter_700Bold",
    800: "Inter_800ExtraBold",
  },
  arabic: {
    400: "NotoSansArabic_400Regular",
    500: "NotoSansArabic_500Medium",
    600: "NotoSansArabic_600SemiBold",
    700: "NotoSansArabic_700Bold",
    800: "NotoSansArabic_800ExtraBold",
  },
  devanagari: {
    400: "NotoSansDevanagari_400Regular",
    500: "NotoSansDevanagari_500Medium",
    600: "NotoSansDevanagari_600SemiBold",
    700: "NotoSansDevanagari_700Bold",
    800: "NotoSansDevanagari_800ExtraBold",
  },
};

const scriptByLanguage: Partial<Record<string, Script>> = {
  ar: "arabic",
  fa: "arabic",
  ur: "arabic",
  hi: "devanagari",
};

export function scriptFor(language: string): Script {
  return scriptByLanguage[language] ?? "latin";
}

export function fontFamily(language: string, weight: FontWeight): string {
  return families[scriptFor(language)][weight];
}

export type TextVariant =
  "display" | "h1" | "h2" | "h3" | "body" | "bodyStrong" | "meta" | "caption";

interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  weight: FontWeight;
}

export const typeScale: Record<TextVariant, TypeStyle> = {
  display: { fontSize: 32, lineHeight: 38, weight: 800 },
  h1: { fontSize: 24, lineHeight: 30, weight: 700 },
  h2: { fontSize: 20, lineHeight: 26, weight: 700 },
  h3: { fontSize: 17, lineHeight: 22, weight: 700 },
  body: { fontSize: 15, lineHeight: 21, weight: 400 },
  bodyStrong: { fontSize: 15, lineHeight: 21, weight: 600 },
  meta: { fontSize: 13, lineHeight: 18, weight: 500 },
  caption: { fontSize: 11, lineHeight: 14, weight: 600 },
};

// Cap applied to poster captions and the tab bar only.
export const maxFontSizeMultiplier = 1.3;

export function textStyle(variant: TextVariant, language: string): TextStyle {
  const { fontSize, lineHeight, weight } = typeScale[variant];
  return { fontSize, lineHeight, fontFamily: fontFamily(language, weight) };
}
