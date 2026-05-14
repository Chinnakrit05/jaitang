import type { ComponentPropsWithoutRef } from 'react';

import { type IconName } from './icon-names';

export type { IconName } from './icon-names';
export { ICON_NAMES } from './icon-names';

type JtIconProps = Omit<ComponentPropsWithoutRef<'svg'>, 'width' | 'height'> & {
  name: IconName;
  size?: number | string;
};

const SPRITE = '/icons-sticker.svg';

export function JtIcon({ name, size = 18, className, style, ...rest }: JtIconProps) {
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
      <use href={`${SPRITE}#ic-${name}`} />
    </svg>
  );
}
