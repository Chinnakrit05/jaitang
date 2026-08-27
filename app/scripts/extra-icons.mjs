// Extra icon names, beyond the 137 the five hand-drawn styles share.
//
// The hand-drawn sprites are artwork — growing them means drawing 137 more
// pictures five times over. Lucide and Tabler are catalogues, so the icon
// vocabulary can grow there for free. Everything listed here is built into
// BOTH vector sprites, and <JtIcon> falls back to Tabler when one of these
// is asked for while a hand-drawn style is active. That fallback is the
// whole reason this list can exist: the alternative is a name that renders
// as an empty box in five of the seven styles.
//
// Grouped the way the category picker shows them, so the order here is the
// order on screen.
//
// `lucide` / `tabler` name the source glyph when it is filed under another
// noun. A few are honest stand-ins rather than exact matches, and they are
// all in Lucide, which is the smaller catalogue:
//   bicycle + motorbike  both land on lucide "bike"
//   shoe + run           both land on lucide "footprints"
//   dental + smile       both land on lucide "smile"
//   helicopter           lands on lucide "plane", same as airplane
// Tabler draws all four distinctly, and it is the fallback style, so this
// only shows up for someone who has picked Lucide.

export const EXTRA_ICON_GROUPS = [
  {
    key: 'food',
    icons: [
      { name: 'pizza' },
      { name: 'burger', lucide: 'hamburger' },
      { name: 'salad' },
      { name: 'egg' },
      { name: 'bread', lucide: 'croissant' },
      { name: 'cake' },
      { name: 'candy' },
      { name: 'cookie' },
      { name: 'ice-cream', lucide: 'ice-cream-cone' },
      { name: 'meat', lucide: 'beef' },
      { name: 'grill', lucide: 'cooking-pot' },
      { name: 'cutlery', lucide: 'utensils', tabler: 'tools-kitchen-2' },
      { name: 'chef-hat' },
      { name: 'beer' },
      { name: 'wine', tabler: 'glass-full' },
      { name: 'cocktail', lucide: 'martini', tabler: 'glass-cocktail' },
      { name: 'milk' },
      { name: 'bottle', lucide: 'bottle-wine' },
    ],
  },
  {
    key: 'fruit',
    icons: [
      { name: 'apple' },
      { name: 'banana' },
      { name: 'cherry' },
      { name: 'grape' },
      { name: 'lemon', lucide: 'citrus' },
      { name: 'carrot' },
      { name: 'pepper', lucide: 'leafy-green' },
      { name: 'wheat' },
    ],
  },
  {
    key: 'transport',
    icons: [
      { name: 'bus' },
      { name: 'train', lucide: 'train-front' },
      { name: 'truck' },
      { name: 'bicycle', lucide: 'bike', tabler: 'bike' },
      { name: 'motorbike', lucide: 'bike' },
      { name: 'fuel', tabler: 'gas-station' },
      { name: 'parking', lucide: 'circle-parking' },
      { name: 'road', lucide: 'route' },
      { name: 'traffic-light', lucide: 'traffic-cone', tabler: 'traffic-lights' },
      { name: 'helicopter', lucide: 'plane' },
      { name: 'rocket' },
      { name: 'sailboat' },
      { name: 'steering-wheel', lucide: 'car-front' },
    ],
  },
  {
    key: 'shopping',
    icons: [
      { name: 'shirt' },
      { name: 'shoe', lucide: 'footprints' },
      { name: 'shopping-bag' },
      { name: 'basket', lucide: 'shopping-basket' },
      { name: 'store', tabler: 'building-store' },
      { name: 'package' },
      { name: 'sunglasses', lucide: 'glasses' },
      { name: 'watch', tabler: 'device-watch' },
      { name: 'perfume', lucide: 'spray-can' },
    ],
  },
  {
    key: 'home',
    icons: [
      { name: 'bed' },
      { name: 'sofa' },
      { name: 'lamp' },
      { name: 'door', lucide: 'door-open' },
      { name: 'bath' },
      { name: 'wash', lucide: 'washing-machine', tabler: 'wash-machine' },
      { name: 'toilet-paper', lucide: 'toilet' },
      { name: 'hammer' },
      { name: 'tools', lucide: 'wrench', tabler: 'tool' },
      { name: 'paint', lucide: 'paint-roller' },
      { name: 'plug' },
      { name: 'key' },
      { name: 'fridge', lucide: 'refrigerator' },
      { name: 'air-conditioning', lucide: 'air-vent' },
    ],
  },
  {
    key: 'health',
    icons: [
      { name: 'heart-pulse', tabler: 'heart-rate-monitor' },
      { name: 'stethoscope' },
      { name: 'vaccine', lucide: 'syringe' },
      { name: 'dental', lucide: 'smile' },
      { name: 'hospital', tabler: 'building-hospital' },
      { name: 'first-aid', lucide: 'briefcase-medical', tabler: 'first-aid-kit' },
      { name: 'yoga', lucide: 'person-standing' },
      { name: 'run', lucide: 'footprints' },
      { name: 'barbell', lucide: 'dumbbell' },
      { name: 'massage', lucide: 'hand-heart' },
      { name: 'brain' },
      { name: 'bone' },
    ],
  },
  {
    key: 'tech',
    icons: [
      { name: 'printer' },
      { name: 'headphones' },
      { name: 'tv', tabler: 'device-tv' },
      { name: 'wifi' },
      { name: 'battery' },
      { name: 'cloud' },
      { name: 'server' },
      { name: 'usb' },
      { name: 'mouse' },
      { name: 'router' },
      { name: 'cpu' },
      { name: 'phone-call' },
    ],
  },
  {
    key: 'money',
    icons: [
      { name: 'chart-pie' },
      { name: 'invoice', lucide: 'receipt-text' },
      { name: 'tax', lucide: 'percent', tabler: 'percentage' },
    ],
  },
  {
    key: 'fun',
    icons: [
      { name: 'music' },
      { name: 'movie', lucide: 'film' },
      { name: 'ticket' },
      { name: 'ball-football', lucide: 'volleyball' },
      { name: 'swim', lucide: 'waves', tabler: 'swimming' },
      { name: 'palette' },
      { name: 'brush', lucide: 'paintbrush' },
      { name: 'puzzle' },
      { name: 'cards', lucide: 'spade' },
      { name: 'dice', lucide: 'dice-5', tabler: 'dice-5' },
      { name: 'guitar', tabler: 'guitar-pick' },
      { name: 'theater' },
      { name: 'balloon' },
      { name: 'book-open', tabler: 'book' },
    ],
  },
  {
    key: 'animal',
    icons: [
      { name: 'cat' },
      { name: 'dog' },
      { name: 'fish' },
      { name: 'butterfly', lucide: 'bug' },
      { name: 'paw', lucide: 'paw-print' },
    ],
  },
  {
    key: 'nature',
    icons: [
      { name: 'tree', lucide: 'trees' },
      { name: 'flower' },
      { name: 'plant', lucide: 'sprout' },
      { name: 'leaf' },
      { name: 'cloud-rain' },
      { name: 'snowflake' },
      { name: 'umbrella' },
      { name: 'droplet' },
      { name: 'rainbow' },
      { name: 'wind' },
      { name: 'star' },
    ],
  },
  {
    key: 'work',
    icons: [
      { name: 'briefcase' },
      { name: 'presentation' },
      { name: 'clipboard', lucide: 'clipboard-list', tabler: 'clipboard-list' },
      { name: 'id-card', tabler: 'id' },
      { name: 'stamp', tabler: 'rubber-stamp' },
      { name: 'folder' },
      { name: 'video' },
    ],
  },
  {
    key: 'love',
    icons: [
      { name: 'heart' },
      { name: 'baby', tabler: 'baby-carriage' },
      { name: 'smile', tabler: 'mood-smile' },
    ],
  },
];

/** Flat list in group order — what the sprite builders iterate. */
export const EXTRA_ICONS = EXTRA_ICON_GROUPS.flatMap((g) => g.icons);

/**
 * Regenerate the TypeScript companion. Both sprite builders call this so
 * the list stays in step no matter which one runs, and the output is a
 * pure function of this file.
 */
export function extraIconNamesSource() {
  const groups = EXTRA_ICON_GROUPS.map(
    (g) =>
      `  {\n    key: "${g.key}",\n    names: [${g.icons
        .map((i) => `"${i.name}"`)
        .join(', ')}],\n  },`
  ).join('\n');
  const names = EXTRA_ICONS.map((i) => `  "${i.name}",`).join('\n');
  return `// Auto-generated by scripts/extra-icons.mjs — do not edit by hand.
// ${EXTRA_ICONS.length} icons that exist only in the vector styles.

export const EXTRA_ICON_GROUPS = [
${groups}
] as const;

export const EXTRA_ICON_NAMES = [
${names}
] as const;

export type ExtraIconName = (typeof EXTRA_ICON_NAMES)[number];
`;
}
