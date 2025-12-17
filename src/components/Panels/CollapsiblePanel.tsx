import { ReactNode } from 'react'
import { Disclosure, DisclosurePanel, Button } from 'react-aria-components'
import { ChevronRight } from 'lucide-react'

interface CollapsiblePanelProps {
  title: string
  children: ReactNode
  defaultCollapsed?: boolean
  className?: string
}

export function CollapsiblePanel({ title, children, defaultCollapsed = false, className = '' }: CollapsiblePanelProps) {
  return (
    <Disclosure defaultExpanded={!defaultCollapsed} className={`bg-bg-panel backdrop-blur-sm rounded-xl border border-primary/10 mb-3 panel-glow ${className}`}>
      {({ isExpanded }) => (
        <>
          <Button
            slot="trigger"
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-t-xl"
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${title}`}
          >
            <span className="text-sm font-medium text-white">{title}</span>
            <ChevronRight size={16} className={`text-text-muted transition-transform duration-200 ${isExpanded ? 'rotate-90 text-primary' : 'rotate-0'}`} />
          </Button>
          <DisclosurePanel>
            <div className="px-4 pb-4">
              {children}
            </div>
          </DisclosurePanel>
        </>
      )}
    </Disclosure>
  )
}
