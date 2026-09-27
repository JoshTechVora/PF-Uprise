"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function GroupBySubcategoryToggle({ checked }: { checked: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(nextChecked: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    // Grouped is the default, so only the ungrouped view needs a param.
    if (nextChecked) {
      params.delete("group");
    } else {
      params.set("group", "none");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => handleChange(e.target.checked)}
        className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
      />
      Group by subcategory
    </label>
  );
}
