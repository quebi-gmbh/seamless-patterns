import { Tooltip as AriaTooltip, TooltipTrigger } from 'react-aria-components'
import type { ReactNode } from 'react'

interface TooltipProps {
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  children: ReactNode
  delay?: number
}

export function Tooltip({ content, placement = 'top', delay = 500, children }: TooltipProps) {
  return (
    <TooltipTrigger delay={delay}>
      {children}
      <AriaTooltip
        placement={placement}
        offset={8}
        className="px-2 py-1 text-xs text-white bg-bg-elevated border border-primary/20 rounded-md shadow-lg z-50"
      >
        {content}
      </AriaTooltip>
    </TooltipTrigger>
  )
}
