import { JtIcon, ICON_NAMES } from '@/components/icons';

export default function IconsPreviewPage() {
  return (
    <div className="p-8 space-y-6">
      <header>
        <h1 className="text-xl font-semibold">JtIcon preview · Sticker Pop sprite</h1>
        <p className="text-sm text-muted-foreground">
          {ICON_NAMES.length} icons · single external sprite at <code>/icons-sticker.svg</code>
        </p>
      </header>

      <section className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
        {ICON_NAMES.map((name) => (
          <div
            key={name}
            className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4"
          >
            <JtIcon name={name} size={56} />
            <code className="text-xs text-muted-foreground">{name}</code>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Size scale</h2>
        <div className="flex items-end gap-4">
          {[12, 14, 16, 18, 20, 24, 28, 36, 48, 64].map((s) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <JtIcon name="home" size={s} />
              <code className="text-[10px] text-muted-foreground">{s}</code>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
