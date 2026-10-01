'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';

import { ThemeSwitcher } from '@bf/ui/components/theme-switcher';

import { env } from '@/config/env';

export function Shell({ children }: Readonly<{ children: React.ReactNode }>) {
  const { theme, setTheme } = useTheme();
  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-4 py-6">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-xs text-primary-foreground">
            bf
          </span>
          {env.NEXT_PUBLIC_APP_NAME}
        </Link>
        <nav className="flex items-center gap-2">
          <ThemeSwitcher
            value={(theme as 'light' | 'dark' | 'system' | undefined) ?? 'system'}
            onChange={setTheme}
          />
        </nav>
      </header>
      <main className="flex flex-1 flex-col gap-6">{children}</main>
    </div>
  );
}
