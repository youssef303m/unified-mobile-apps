// Poster grids (03-design/screens.md): 3 columns on phones, 4 from 480 dp, 6 on tablets.
import { layout } from "@/theme/tokens";

export function gridColumns(width: number): number {
  return width >= 600 ? 6 : width >= 480 ? 4 : 3;
}

/** The poster width that fills `columns` across the screen between the gutters. */
export function gridCardWidth(width: number, columns: number): number {
  return (width - layout.gutter * 2 - layout.posterGap * (columns - 1)) / columns;
}
