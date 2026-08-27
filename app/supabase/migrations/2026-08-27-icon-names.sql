-- Icon columns hold JtIcon names instead of emoji characters.
--
-- Why: an emoji is a font glyph, so it can never follow the icon style the
-- user picked in settings. A name resolves against whichever sprite is
-- active. The column type is unchanged and still accepts either — this only
-- moves the defaults and the seeded categories.
--
-- This touches NO existing rows on purpose. Converting the emoji already in
-- the tables is the app's job: Settings → "แปลงอีโมจิเป็นไอคอน" shows every
-- swap before writing it, and skips emoji no icon can honestly replace.

alter table public.ledgers    alter column icon set default 'ledgers';
alter table public.categories alter column icon set default 'sparkle';
alter table public.trips      alter column icon set default 'airplane';
alter table public.accounts   alter column icon set default 'banknote';
alter table public.goals      alter column icon set default 'bullseye';

-- seed_default_categories, byte-for-byte as it stands in production apart
-- from the sixteen icon values.
--
-- The version that used to sit in schema.sql was NOT what production runs:
-- different parameter name, `returns void` instead of integer, no
-- SECURITY DEFINER, no auth or membership check, no "already seeded" guard,
-- and a different category list with no subcategories. Replacing production
-- with it would have quietly removed all of that, so schema.sql has been
-- corrected to match reality instead of the other way round.

create or replace function public.seed_default_categories(p_ledger_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  uid uuid;
  inserted_count int := 0;
  food_id uuid;
  travel_id uuid;
  shopping_id uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.ledger_members
    WHERE ledger_id = p_ledger_id AND user_id = uid
  ) THEN
    RAISE EXCEPTION 'Not a member of this ledger';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.categories
    WHERE ledger_id = p_ledger_id AND deleted_at IS NULL
  ) THEN
    RETURN 0;
  END IF;

  INSERT INTO public.categories (ledger_id, name, icon, kind, sort_order)
    VALUES (p_ledger_id, 'อาหาร', 'ramen', 'expense'::tx_kind, 0)
    RETURNING id INTO food_id;
  INSERT INTO public.categories (ledger_id, name, icon, kind, sort_order)
    VALUES (p_ledger_id, 'เดินทาง', 'car', 'expense'::tx_kind, 1)
    RETURNING id INTO travel_id;
  INSERT INTO public.categories (ledger_id, name, icon, kind, sort_order)
    VALUES (p_ledger_id, 'ช้อปปิ้ง', 'shopping-bag', 'expense'::tx_kind, 2)
    RETURNING id INTO shopping_id;

  INSERT INTO public.categories (ledger_id, name, icon, kind, sort_order)
    VALUES
      (p_ledger_id, 'สุขภาพ', 'pill', 'expense'::tx_kind, 3),
      (p_ledger_id, 'บิล', 'receipt', 'expense'::tx_kind, 4),
      (p_ledger_id, 'บันเทิง', 'movie', 'expense'::tx_kind, 5),
      (p_ledger_id, 'บ้าน', 'house', 'expense'::tx_kind, 6),
      (p_ledger_id, 'การศึกษา', 'graduation-cap', 'expense'::tx_kind, 7);

  INSERT INTO public.categories (ledger_id, name, icon, kind, parent_id, sort_order)
    VALUES
      (p_ledger_id, 'คาเฟ่', 'coffee', 'expense'::tx_kind, food_id, 0),
      (p_ledger_id, 'ของหวาน', 'cake', 'expense'::tx_kind, food_id, 1),
      (p_ledger_id, 'น้ำมัน', 'fuel', 'expense'::tx_kind, travel_id, 0),
      (p_ledger_id, 'ขนส่งสาธารณะ', 'train', 'expense'::tx_kind, travel_id, 1),
      (p_ledger_id, 'เสื้อผ้า', 'shirt', 'expense'::tx_kind, shopping_id, 0);

  INSERT INTO public.categories (ledger_id, name, icon, kind, sort_order)
    VALUES
      (p_ledger_id, 'เงินเดือน', 'money-bag', 'income'::tx_kind, 0),
      (p_ledger_id, 'รายรับพิเศษ', 'gift', 'income'::tx_kind, 1),
      (p_ledger_id, 'ดอกเบี้ย / ลงทุน', 'banknote', 'income'::tx_kind, 2);

  SELECT COUNT(*) INTO inserted_count
  FROM public.categories
  WHERE ledger_id = p_ledger_id AND deleted_at IS NULL;

  RETURN inserted_count;
END;
$function$;
