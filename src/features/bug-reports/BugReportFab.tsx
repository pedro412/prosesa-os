import { useState } from 'react'
import { Bug } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useSession } from '@/hooks/useAuth'

import { BugReportDialog } from './BugReportDialog'
import { bugReportMessages } from './messages'

export function BugReportFab() {
  const session = useSession()
  const [open, setOpen] = useState(false)

  if (!session.data) return null

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={bugReportMessages.fab.label}
        title={bugReportMessages.fab.label}
        className="fixed right-5 bottom-5 z-40 size-12 rounded-full shadow-lg"
        size="icon"
      >
        <Bug className="size-5" />
      </Button>
      <BugReportDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
