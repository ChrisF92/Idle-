interface SheetTabOption<T extends string> {
  id: T
  label: string
  guide?: string
}

interface SheetTabsProps<T extends string> {
  value: T
  onChange: (next: T) => void
  options: readonly SheetTabOption<T>[]
  label: string
}

export function SheetTabs<T extends string>({ value, onChange, options, label }: SheetTabsProps<T>) {
  return (
    <div className="sheet-tabs pane-tabs" role="tablist" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          className={value === opt.id ? 'sheet-tab active' : 'sheet-tab'}
          data-guide={opt.guide}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
