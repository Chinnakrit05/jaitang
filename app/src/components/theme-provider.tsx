"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Tier-2 theme system:
 *   - mode  (light/dark/system) — handled by next-themes (`class` attribute)
 *   - oled  (boolean)           — adds `.oled` to html (only effective on dark)
 *   - accent (6 hues)           — sets data-accent on html
 *   - season (5 palettes + auto)— sets data-season on html (overrides accent)
 *
 * `enableSystem` lets the browser auto-pick when the user chose "System".
 *
 * The pre-paint script in `<head>` reads localStorage and applies the
 * three extras BEFORE React hydrates, otherwise users would see a flash
 * of default cyan before the picker takes effect.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}

/**
 * Sync inline script that runs in <head> before any markup paints. Must be
 * tiny + dependency-free. Mirrors the localStorage layout in lib/theme.ts.
 */
export const themeBootScript = `
(function() {
  try {
    var html = document.documentElement;
    var oled = localStorage.getItem('jt-theme-oled') === 'true';
    if (oled) html.classList.add('oled');

    var accent = localStorage.getItem('jt-theme-accent');
    var validAccents = ['cyan','mint','ocean','lavender','coral','rose'];
    if (accent && validAccents.indexOf(accent) !== -1) {
      html.setAttribute('data-accent', accent);
    }

    var season = localStorage.getItem('jt-theme-season');
    var seasonAuto = localStorage.getItem('jt-theme-season-auto') === 'true';
    var validSeasons = ['default','songkran','loy-krathong','chinese-new-year','christmas'];

    if (seasonAuto) {
      var d = new Date();
      var m = d.getMonth() + 1;
      var dd = d.getDate();
      var s = 'default';
      if (m === 4 && dd >= 10 && dd <= 17) s = 'songkran';
      else if ((m === 1 && dd >= 20) || (m === 2 && dd <= 20)) s = 'chinese-new-year';
      else if (m === 11 && dd >= 5 && dd <= 20) s = 'loy-krathong';
      else if ((m === 12 && dd >= 18) || (m === 1 && dd <= 2)) s = 'christmas';
      if (s !== 'default') html.setAttribute('data-season', s);
    } else if (season && validSeasons.indexOf(season) !== -1 && season !== 'default') {
      html.setAttribute('data-season', season);
    }

    var pet = localStorage.getItem('jt-theme-pet');
    var validPets = ['shiba','blackcat','husky','pug','whitecat'];
    if (pet && validPets.indexOf(pet) !== -1 && pet !== 'shiba') {
      html.setAttribute('data-pet', pet);
    }
  } catch (e) {}
})();
`.trim();
