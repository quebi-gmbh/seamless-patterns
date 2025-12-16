import { ReactNode } from 'react'
import { Disclosure, DisclosurePanel, Button } from 'react-aria-components'

interface CollapsiblePanelProps {
  title: string
  children: ReactNode
  defaultCollapsed?: boolean
  className?: string
}

export function CollapsiblePanel({ title, children, defaultCollapsed = false, className = '' }: CollapsiblePanelProps) {
  return (
    <Disclosure defaultExpanded={!defaultCollapsed} className={`bg-bg-panel backdrop-blur-sm rounded-lg border border-border-subtle mb-3 overflow-hidden ${className}`}>
      {({ isExpanded }) => (
        <>
          <Button
            slot="trigger"
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal"
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${title}`}
          >
            <span className="text-sm font-medium text-text-primary">{title}</span>
            <span className="text-xs text-text-muted transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
              ▶
            </span>
          </Button>
          <DisclosurePanel>
            <div className="px-4 pb-4 max-h-96 overflow-y-auto">
              {children}
            </div>
          </DisclosurePanel>
        </>
      )}
    </Disclosure>
  )
}
