import type { IconName } from "@/components/icons";

/**
 * Emoji → icon name, for converting rows that were saved before the icon
 * picker existed.
 *
 * Only the emoji an icon can actually stand in for are listed. A cat
 * category becomes the cat icon; 🍣 becomes a fish, which is close enough;
 * 🐢 and 🥑 stay emoji, because inventing a match would quietly change
 * what the user chose into something else. Anything absent from this table
 * is left exactly as it is — that is the point of leaving it out.
 *
 * Several emoji collapse onto one icon (🚗 🚕 🚙 are all `car`). Icon sets
 * are smaller than the emoji catalogue and that is the trade being made;
 * the review screen shows the result before anything is written.
 */
const RAW_EMOJI_TO_ICON: Record<string, IconName> = {
  // Food
  "🍜": "ramen", "🍝": "ramen", "🍲": "ramen", "🍛": "ramen",
  "🍚": "ramen", "🍱": "ramen", "🍙": "ramen", "🍘": "ramen",
  "🍣": "fish", "🍤": "fish",
  "🍧": "ice-cream", "🍨": "ice-cream", "🍦": "ice-cream",
  "🍰": "cake", "🧁": "cake", "🥮": "cake", "🍮": "cake", "🥧": "cake", "🎂": "cake",
  "🍪": "cookie", "🍩": "cookie",
  "🍫": "candy", "🍬": "candy", "🍭": "candy",
  "🥐": "bread", "🥯": "bread", "🥖": "bread", "🍞": "bread",
  "🥚": "egg", "🍳": "egg",
  "🥓": "meat", "🥩": "meat", "🍗": "meat", "🍖": "meat",
  "🌭": "burger", "🍔": "burger", "🍟": "burger",
  "🥪": "burger", "🌮": "burger", "🌯": "burger", "🥙": "burger",
  "🍕": "pizza",
  "🥗": "salad",
  "🍵": "coffee", "☕": "coffee",
  "🥛": "milk",
  "🍺": "beer", "🍻": "beer",
  "🍷": "wine",
  "🍸": "cocktail", "🍹": "cocktail",
  "🍶": "bottle", "🥃": "bottle", "🍾": "bottle",
  "🥤": "bottle", "🧃": "bottle", "🧉": "bottle",

  // Fruit + veg
  "🍎": "apple", "🍏": "apple",
  "🍊": "lemon", "🍋": "lemon",
  "🍌": "banana",
  "🍇": "grape",
  "🍓": "cherry", "🫐": "cherry", "🍒": "cherry",
  "🌶️": "pepper", "🫑": "pepper",
  "🥕": "carrot",
  "🌽": "wheat",
  "🥬": "leaf", "🥦": "leaf",

  // Transport
  "🚗": "car", "🚕": "car", "🚙": "car",
  "🚌": "bus", "🚎": "bus", "🚏": "bus",
  "🚚": "truck", "🚛": "truck", "🛻": "truck", "🚜": "truck",
  "🚓": "truck", "🚑": "truck", "🚒": "truck", "🚐": "truck",
  "🏍️": "motorbike", "🛵": "motorbike", "🛴": "motorbike",
  "🚲": "bicycle",
  "✈️": "airplane", "🛩️": "airplane", "🛫": "airplane", "🛬": "airplane",
  "🚀": "rocket", "🛸": "rocket",
  "🚁": "helicopter",
  "🚂": "train", "🚄": "train", "🚆": "train", "🚇": "train", "🚊": "train",
  "⛴️": "cruise-ship", "🚢": "cruise-ship", "🛥️": "cruise-ship", "🚤": "cruise-ship",
  "⛵": "sailboat",
  "⛽": "fuel",
  "🚦": "traffic-light", "🚧": "traffic-light",
  "🛣️": "road", "🛤️": "road",
  "🅿️": "parking",

  // Shopping + clothes
  "🛍️": "shopping-bag", "🛒": "shopping-cart",
  "💼": "briefcase",
  "👜": "coin-purse", "👛": "coin-purse",
  "🎒": "backpack", "🧳": "trips",
  "👕": "shirt", "👔": "shirt", "👗": "shirt", "👚": "shirt", "👙": "shirt",
  "👘": "shirt", "🥻": "shirt", "🩱": "shirt", "🩳": "shirt", "👖": "shirt",
  "🧥": "shirt", "🥼": "shirt", "🧤": "shirt", "🧣": "shirt", "🧦": "shirt",
  "👟": "shoe", "👞": "shoe", "👠": "shoe", "👡": "shoe", "👢": "shoe",
  "🥾": "shoe", "🥿": "shoe",
  "💄": "perfume",
  "💍": "ring",
  "👑": "award",
  "🕶️": "sunglasses", "👓": "sunglasses",
  "🎀": "gift",
  "⌚": "watch",

  // Home
  "🏠": "house", "🏡": "house", "🪟": "house", "🪞": "house",
  "🏢": "building-2", "🏣": "building-2", "🏤": "building-2", "🏨": "building-2",
  "🏪": "building-2", "🏫": "building-2", "🏬": "building-2", "🏭": "building-2",
  "🏯": "building-2", "🏰": "building-2",
  "🏥": "hospital",
  "🏦": "atm", "🏧": "atm",
  "💒": "ring",
  "🛏️": "bed",
  "🛋️": "sofa", "🪑": "sofa",
  "🚪": "door",
  "🚽": "toilet-paper", "🧻": "toilet-paper",
  "🚿": "bath", "🛁": "bath", "🧼": "bath", "🧴": "bath",
  "💡": "lamp", "🕯️": "lamp",
  "🔌": "plug",
  "🔋": "battery", "🪫": "battery",
  "🧺": "wash",
  "🚰": "droplet", "💧": "droplet",
  "🧯": "shield-check",
  "📺": "tv",

  // Health
  "💊": "pill",
  "💉": "vaccine",
  "🩺": "stethoscope",
  "🩹": "first-aid", "🩼": "first-aid", "🦽": "first-aid", "🦼": "first-aid",
  "🦷": "dental",
  "🧖": "massage",
  "🧘": "yoga",
  "🩸": "droplet",
  "🫀": "heart-pulse",
  "🧠": "brain", "🫁": "brain", "🧬": "brain",
  "👁️": "eye",
  "🦴": "bone",

  // Tech
  "📱": "smartphone", "📲": "smartphone", "📟": "smartphone",
  "💻": "laptop", "🖥️": "laptop",
  "⌨️": "keyboard",
  "🖱️": "mouse",
  "🖨️": "printer", "📠": "printer",
  "💾": "server", "💿": "server", "📀": "server",
  "📷": "camera", "📸": "camera",
  "📹": "video", "🎥": "video",
  "📻": "volume-2",
  "🎙️": "mic", "🎤": "mic",
  "🎧": "headphones",
  "☎️": "phone-call", "📞": "phone-call",
  "⏰": "clock", "⏱️": "clock", "⏲️": "clock",
  "🧰": "tools", "🔧": "tools", "🔨": "hammer", "⚙️": "tools", "🪛": "tools",
  "🔩": "tools", "🛠️": "tools", "⚒️": "tools", "🪚": "tools", "⛏️": "tools",
  "🪓": "tools", "🪜": "tools",
  "📡": "wifi", "🛰️": "wifi",

  // Money
  "💰": "money-bag",
  "💵": "banknote", "💴": "banknote", "💶": "banknote", "💷": "banknote",
  "💸": "banknote", "💱": "banknote", "💲": "banknote",
  "💳": "credit-card",
  "🪙": "gold-coin",
  "🧾": "receipt",
  "📊": "bar-chart-3",
  "📈": "trending-up", "📉": "trending-down",
  "🪪": "id-card",
  "📑": "file-text", "📰": "file-text", "🗞️": "file-text",
  "🧮": "budgets",
  "💎": "ring",
  "🏆": "award", "🥇": "award", "🥈": "award", "🥉": "award",
  "🎁": "gift",
  "📒": "ledgers", "📓": "ledgers", "📔": "ledgers",
  "📕": "ledgers", "📗": "ledgers", "📘": "ledgers", "📙": "ledgers",

  // Fun
  "🎮": "game-controller", "🕹️": "game-controller",
  "🎯": "bullseye",
  "🎲": "dice",
  "🎰": "cards", "🎴": "cards", "🃏": "cards", "🎏": "cards", "🎎": "cards",
  "🎨": "palette", "🖌️": "brush", "🖍️": "brush",
  "🎭": "theater",
  "🎬": "movie",
  "🎼": "music", "🎵": "music", "🎶": "music",
  "🎟️": "ticket", "🎫": "ticket",
  "🎉": "party", "🎊": "party", "🎆": "party", "🎇": "party",
  "🎐": "party", "🎑": "party",
  "🎈": "balloon", "🪅": "balloon", "🪆": "balloon", "🪁": "balloon", "🪀": "balloon",
  "🧧": "gift",
  "⚽": "ball-football", "🏀": "ball-football", "🏈": "ball-football",
  "⚾": "ball-football", "🥎": "ball-football", "🎾": "ball-football",
  "🏐": "ball-football", "🏉": "ball-football", "🥏": "ball-football",
  "🎱": "ball-football", "🏓": "ball-football", "🏸": "ball-football",
  "🥅": "ball-football", "⛳": "ball-football",
  "🥊": "barbell", "🥋": "barbell", "🎽": "barbell",
  "🏋️": "barbell", "🤸": "barbell", "⛹️": "barbell",
  "🛹": "run", "🛼": "run", "⛸️": "run", "🎿": "run", "⛷️": "run", "🏂": "run",
  "🏊": "swim",

  // Animals
  "🐶": "dog", "🐕": "dog", "🦮": "dog", "🐩": "dog",
  "🐱": "cat", "🐈": "cat",
  "🐝": "butterfly", "🐛": "butterfly", "🦋": "butterfly", "🐌": "butterfly",
  "🐞": "butterfly", "🐜": "butterfly", "🪲": "butterfly",
  "🐙": "fish", "🦑": "fish", "🦐": "fish", "🦞": "fish", "🦀": "fish",
  "🐡": "fish", "🐠": "fish", "🐟": "fish", "🐬": "fish", "🐳": "fish",
  "🐋": "fish", "🦈": "fish",
  "🐷": "piggy-bank", "🐽": "piggy-bank",
  "🐭": "paw", "🐹": "paw", "🐰": "paw", "🦊": "paw", "🐻": "paw",
  "🐼": "paw", "🐨": "paw", "🐯": "paw", "🦁": "paw", "🐮": "paw",
  "🐒": "paw", "🐵": "paw", "🐺": "paw", "🐗": "paw", "🐴": "paw",
  "🦄": "paw", "🐅": "paw", "🐆": "paw", "🦓": "paw", "🦌": "paw", "🦒": "paw",

  // Nature
  "🌲": "tree", "🌳": "tree", "🌴": "tree",
  "🌱": "plant", "🌿": "plant", "🌵": "plant",
  "🍃": "leaf", "🍂": "leaf", "🍁": "leaf", "☘️": "leaf", "🍀": "leaf",
  "🎍": "leaf", "🎋": "leaf", "🌾": "wheat",
  "🌺": "flower", "🌻": "flower", "🌼": "flower", "🌷": "flower",
  "🥀": "flower", "🌹": "flower", "🌸": "flower", "💐": "flower",
  "🌞": "sun",
  "🌝": "moon", "🌛": "moon", "🌜": "moon", "🌚": "moon", "🌕": "moon",
  "🌖": "moon", "🌗": "moon", "🌘": "moon", "🌑": "moon", "🌒": "moon",
  "🌓": "moon", "🌔": "moon",
  "⭐": "star", "🌟": "star",
  "💫": "sparkle", "✨": "sparkle", "🌌": "sparkle",
  "⚡": "zap",
  "🔥": "flame",
  "🌊": "swim",
  "☔": "umbrella", "☂️": "umbrella",
  "❄️": "snowflake", "☃️": "snowflake", "⛄": "snowflake",
  "🌈": "rainbow",

  // Work
  "📝": "clipboard", "📋": "clipboard",
  "📂": "folder", "📁": "folder", "🗂️": "folder", "📇": "folder",
  "📅": "calendar", "📆": "calendar", "🗓️": "calendar",
  "✏️": "pencil", "🖊️": "pencil", "🖋️": "pencil",
  "📚": "books", "📖": "books",
  "🔍": "search", "🔎": "search",
  "⚖️": "balances",
  "📌": "map", "📍": "map", "🗺️": "map",
  "📎": "link-2", "🖇️": "link-2",
  "✉️": "mail", "📧": "mail", "📨": "mail", "📩": "mail", "📮": "mail",
  "📥": "inbox", "📤": "send",
  "🎓": "graduation-cap",
  "🤖": "bot",
  "👤": "user", "👥": "users",
  "🌍": "globe", "🌎": "globe", "🌏": "globe",
  "🔔": "bell",
  "🏷️": "tag",

  // Hearts + faces
  "❤️": "heart", "🧡": "heart", "💛": "heart", "💚": "heart", "💙": "heart",
  "💜": "heart", "🖤": "heart", "🤍": "heart", "🤎": "heart", "💝": "heart",
  "💖": "heart", "💞": "heart", "💕": "heart", "💔": "heart", "❣️": "heart",
  "💬": "chat", "💭": "chat", "🗯️": "chat",
  "😀": "smile", "😃": "smile", "😄": "smile", "😁": "smile", "😆": "smile",
  "🥹": "smile", "😅": "smile", "😂": "smile", "🤣": "smile", "🥰": "smile",
  "😍": "smile", "🤩": "smile", "😘": "smile", "😋": "smile", "😎": "smile",
  "🤓": "smile", "🧐": "smile", "😏": "smile", "😢": "smile", "😭": "smile",
  "😤": "smile", "😡": "smile", "🤬": "smile", "💋": "smile",
};

/** U+FE0F, the variation selector that makes a glyph render in colour.
 *  "🏷️" and "🏷" are the same pick to a user, and both turn up in stored
 *  data, so the table is keyed without it and lookups strip it. */
const VARIATION_SELECTOR = /️/g;

const EMOJI_TO_ICON = new Map<string, IconName>(
  Object.entries(RAW_EMOJI_TO_ICON).map(([emoji, icon]) => [
    emoji.replace(VARIATION_SELECTOR, ""),
    icon,
  ])
);

/**
 * The icon that replaces this emoji, or null to leave the value alone.
 *
 * Returns null for anything that is not an emoji we map — including values
 * that are already icon names, so calling this on a converted row is safe
 * and does nothing.
 */
export function iconNameForEmoji(
  value: string | null | undefined
): IconName | null {
  if (!value) return null;
  return EMOJI_TO_ICON.get(value.replace(VARIATION_SELECTOR, "")) ?? null;
}

/** How many emoji the table covers. Used by tests to catch an edit that
 *  silently truncates it. */
export const MAPPED_EMOJI_COUNT = EMOJI_TO_ICON.size;
