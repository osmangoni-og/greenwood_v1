interface TabItem {
  id: string;
  label: string;
}

export function Tabs({ items, activeId, onChange }: { items: readonly TabItem[]; activeId: string; onChange: (id: string) => void }) {
  return (
    <div className="border-b border-stone-200">
      <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Tabs">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeId === item.id
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
