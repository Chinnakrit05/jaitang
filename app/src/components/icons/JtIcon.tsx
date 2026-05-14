"use client";

import type { ComponentPropsWithoutRef } from 'react';

import type { IconName, IconStyle } from './icon-names';
import { useIconStyle } from './IconStyleContext';

export type { IconName, IconStyle } from './icon-names';
export { ICON_NAMES, ICON_STYLES, ICON_STYLE_LABELS } from './icon-names';

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
  const spriteStyle = styleOverride ?? activeStyle;
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
