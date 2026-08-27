"use client";

import type { ComponentPropsWithoutRef } from 'react';

import type { IconName as SharedIconName, IconStyle } from './icon-names';
import { EXTRA_ICON_NAMES, type ExtraIconName } from './extra-icon-names';
import { useIconStyle } from './IconStyleContext';

/** Every name any sprite can draw: the 137 all seven styles share, plus
 *  the vector-only extras. */
export type IconName = SharedIconName | ExtraIconName;
export type { IconStyle } from './icon-names';
export { ICON_NAMES, ICON_STYLES, ICON_STYLE_LABELS } from './icon-names';
export { EXTRA_ICON_GROUPS, EXTRA_ICON_NAMES } from './extra-icon-names';

const EXTRA_SET = new Set<string>(EXTRA_ICON_NAMES);
/** The two catalogue styles — the only sprites carrying the extras. */
const VECTOR_STYLES = new Set<IconStyle>(['lucide', 'tabler']);
/** Where an extra comes from when a hand-drawn style is active. Tabler
 *  rather than Lucide because it is the wider catalogue, so it is the one
 *  we can keep growing. */
const EXTRA_FALLBACK: IconStyle = 'tabler';

type JtIconProps = Omit<ComponentPropsWithoutRef<'svg'>, 'width' | 'height'> & {
  name: IconName;
  size?: number | string;
  /** Override the active icon style for this render. */
  styleOverride?: IconStyle;
};

export function JtIcon({
  name,
  size = 22,
  className,
  style,
  styleOverride,
  ...rest
}: JtIconProps) {
  const activeStyle = useIconStyle();
  const wanted = styleOverride ?? activeStyle;
  // The five hand-drawn sprites stop at the shared 137 — they are artwork,
  // not a catalogue. Asking one of them for an extra would render an empty
  // box, so those names come from Tabler whatever style is active. It is a
  // visible mix, and that is the trade for a category picker with more
  // than 33 choices in it.
  const spriteStyle =
    EXTRA_SET.has(name) && !VECTOR_STYLES.has(wanted) ? EXTRA_FALLBACK : wanted;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <use href={`/icons-${spriteStyle}.svg#ic-${name}`} />
    </svg>
  );
}
