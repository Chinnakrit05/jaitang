"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { isPet, type Pet } from "@/lib/theme";

/**
 * Renders the active pet's name ("น้องชิบะ" / "น้องแมวดำ" / …) so dashboard
 * copy reads in the pet the user picked. Falls back to Shiba on SSR + first
 * paint; MutationObserver keeps it in sync with /settings live changes.
 */
export function PetName({ className }: { className?: string }) {
  const t = useTranslations();
  const [pet, setPet] = useState<Pet>("shiba");

  useEffect(() => {
    const sync = () => {
      const v = document.documentElement.getAttribute("data-pet");
      setPet(isPet(v) ? v : "shiba");
    };
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-pet"],
    });
    return () => obs.disconnect();
  }, []);

  const key =
    pet === "blackcat"
      ? "dashboard.petName.blackcat"
      : pet === "husky"
        ? "dashboard.petName.husky"
        : pet === "pug"
          ? "dashboard.petName.pug"
          : pet === "whitecat"
            ? "dashboard.petName.whitecat"
            : "dashboard.mascotName";

  return <span className={className}>{t(key)}</span>;
}
