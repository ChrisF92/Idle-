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
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % options.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = options.length - 1
    else return
    event.preventDefault()
    onChange(options[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div className="sheet-tabs pane-tabs" role="tablist" aria-label={label}>
      {options.map((opt, index) => (
        <button
          key={opt.id}
          ref={(node) => { refs.current[index] = node }}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          tabIndex={value === opt.id ? 0 : -1}
          className={value === opt.id ? 'sheet-tab active' : 'sheet-tab'}
          data-guide={opt.guide}
          onClick={() => onChange(opt.id)}
          onKeyDown={(event) => move(event, index)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
import { useRef, type KeyboardEvent } from 'react'
