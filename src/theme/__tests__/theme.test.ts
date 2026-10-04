import { colors, layout, radius, spacing } from "../tokens";
import { fontFamily, scriptFor, textStyle } from "../typography";

describe("theme tokens (03-design/design-system.md)", () => {
  it("uses the IBO brand red, never Netflix red", () => {
    expect(colors.brand.primary).toBe("#BF242E");
    expect(JSON.stringify(colors).toUpperCase()).not.toContain("#E50914");
  });

  it("keeps the dark surfaces, spacing scale and touch targets", () => {
    expect(colors.bg.base).toBe("#000000");
    expect(colors.bg.elevated).toBe("#141414");
    expect(layout.gutter).toBe(16);
    expect(layout.posterGap).toBe(8);
    expect(layout.touchTarget).toBe(48);
    // Style A (docs/decisions.md D-085): softer posters, pill buttons.
    expect(radius.poster).toBe(10);
    expect(radius.button).toBe(999);
    expect(Object.values(spacing)).toEqual([2, 4, 8, 12, 16, 20, 24, 32, 40, 56]);
  });
});

describe("typography", () => {
  it("picks the font family from the language", () => {
    expect(scriptFor("en")).toBe("latin");
    expect(scriptFor("ar")).toBe("arabic");
    expect(fontFamily("ar", 700)).toBe("NotoSansArabic_700Bold");
    expect(fontFamily("en", 400)).toBe("Inter_400Regular");
  });

  it("maps each variant to its size, line height and weight", () => {
    expect(textStyle("h1", "en")).toEqual({
      fontSize: 24,
      lineHeight: 30,
      fontFamily: "Inter_700Bold",
    });
    expect(textStyle("caption", "fr")).toEqual({
      fontSize: 11,
      lineHeight: 14,
      fontFamily: "Inter_600SemiBold",
    });
  });
});
