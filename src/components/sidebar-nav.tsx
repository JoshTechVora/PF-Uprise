"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_SECTIONS = [
  {
    title: null,
    items: [{ href: "/dashboard", label: "Home" }],
  },
  {
    title: "Expenses",
    items: [
      { href: "/dashboard/mortgage", label: "Mortgage" },
      { href: "/dashboard/energy", label: "Energy" },
      { href: "/dashboard/groceries", label: "Groceries & Food" },
      { href: "/dashboard/car", label: "Car" },
    ],
  },
  {
    title: "Taxes",
    items: [{ href: "/dashboard/taxes", label: "Taxes" }],
  },
  {
    title: "Purchases",
    items: [{ href: "/dashboard/purchases", label: "Purchases" }],
  },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4">
      {NAV_SECTIONS.map((section, index) => (
        <div key={section.title ?? `section-${index}`} className="flex flex-col gap-1">
          {index > 0 && (
            <hr className="mb-3 border-zinc-200 dark:border-zinc-800" />
          )}
          {section.title && (
            <h3 className="px-3 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {section.title}
            </h3>
          )}
          {section.items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2 text-sm font-medium ${
                  isActive
                    ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
