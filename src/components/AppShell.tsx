import { useState, type ReactNode } from 'react';
import { Building2, Menu } from 'lucide-react';
import { cx } from '@/lib/cx';
import { VISIBLE_MODULES, type ModuleId } from '@/lib/modules';

interface AppShellProps {
  route: ModuleId;
  children: ReactNode;
}

export function AppShell({ route, children }: AppShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const activeModule = VISIBLE_MODULES.find((module) => module.id === route);

  return (
    <div className="min-h-screen bg-stone-50">
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-stone-200 bg-white px-4 py-6 transition-transform duration-300 ease-out lg:w-64 lg:translate-x-0',
          navOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-700 text-white shadow-sm">
            <Building2 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight text-stone-900">Greenwood Miazi Bari</p>
            <p className="text-xs text-stone-500">Owner project console</p>
          </div>
        </div>

        <nav aria-label="Main" className="-mx-1 mt-8 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-1 pb-4">
          {VISIBLE_MODULES.map(({ id, label, icon: Icon }) => {
            const active = id === route;
            return (
              <a
                key={id}
                href={`#/${id}`}
                onClick={() => setNavOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                  active ? 'bg-primary-50 text-primary-800' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
                )}
              >
                {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-primary-700" aria-hidden />}
                <Icon
                  className={cx('h-5 w-5', active ? 'text-primary-700' : 'text-stone-400 group-hover:text-stone-600')}
                  aria-hidden
                />
                {label}
              </a>
            );
          })}
        </nav>

        <div className="mt-auto rounded-xl bg-stone-50 p-4 text-xs text-stone-600">
          <p className="font-medium text-stone-800">Dhoon Shahadda, Feni</p>
          <p className="mt-0.5">Bangladesh</p>
        </div>
      </aside>

      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-stone-900/40 backdrop-blur-sm lg:hidden"
        />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-stone-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg p-2 text-stone-600 transition-colors hover:bg-stone-100 lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <h2 className="text-base font-semibold text-stone-900">{activeModule?.label}</h2>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
