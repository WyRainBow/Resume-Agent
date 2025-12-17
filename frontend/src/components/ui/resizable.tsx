import { Group, Panel, Separator } from "react-resizable-panels"
import { cn } from "../../lib/utils"

const ResizablePanelGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof Group>) => (
  <Group
    className={cn(
      "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
      className
    )}
    {...props}
  />
)

const ResizablePanel = Panel

const ResizableHandle = ({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) => (
  <Separator
    className={cn(
      "relative flex w-1.5 items-center justify-center",
      "bg-gray-200 dark:bg-neutral-700",
      "hover:bg-purple-300 dark:hover:bg-purple-600",
      "transition-colors cursor-col-resize",
      className
    )}
    {...props}
  />
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }

