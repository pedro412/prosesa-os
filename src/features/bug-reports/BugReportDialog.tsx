import { type ChangeEvent, type FormEvent, useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { bugReportMessages } from './messages'
import { useCreateBugReport } from './useCreateBugReport'

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg'])

interface BugReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BugReportDialog({ open, onOpenChange }: BugReportDialogProps) {
  const mutation = useCreateBugReport()
  const [description, setDescription] = useState('')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [descriptionError, setDescriptionError] = useState<string | null>(null)
  const [screenshotError, setScreenshotError] = useState<string | null>(null)

  function reset() {
    setDescription('')
    setScreenshot(null)
    setDescriptionError(null)
    setScreenshotError(null)
  }

  function handleScreenshotChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setScreenshotError(null)

    if (!file) {
      setScreenshot(null)
      return
    }

    if (!ACCEPTED_TYPES.has(file.type)) {
      setScreenshotError(bugReportMessages.dialog.errors.screenshotWrongType)
      event.target.value = ''
      return
    }

    if (file.size > MAX_SCREENSHOT_BYTES) {
      setScreenshotError(bugReportMessages.dialog.errors.screenshotTooLarge)
      event.target.value = ''
      return
    }

    setScreenshot(file)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = description.trim()
    if (trimmed.length === 0) {
      setDescriptionError(bugReportMessages.dialog.errors.descriptionRequired)
      return
    }

    setDescriptionError(null)

    try {
      await mutation.mutateAsync({
        description: trimmed,
        url: typeof window === 'undefined' ? null : window.location.href,
        userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
        screenshot,
      })
      toast.success(bugReportMessages.toast.success)
      reset()
      onOpenChange(false)
    } catch {
      toast.error(bugReportMessages.toast.error)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) reset()
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{bugReportMessages.dialog.title}</DialogTitle>
          <DialogDescription>{bugReportMessages.dialog.description}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="bug-description">{bugReportMessages.dialog.descriptionLabel}</Label>
            <Textarea
              id="bug-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={bugReportMessages.dialog.descriptionPlaceholder}
              className="min-h-28"
              required
              aria-invalid={descriptionError ? true : undefined}
              disabled={mutation.isPending}
            />
            {descriptionError && <p className="text-destructive text-sm">{descriptionError}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bug-screenshot">{bugReportMessages.dialog.screenshotLabel}</Label>
            <p className="text-muted-foreground text-xs">
              {bugReportMessages.dialog.screenshotHelp}
            </p>
            {screenshot ? (
              <div className="border-border/60 bg-muted/30 flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                <span className="truncate text-sm">{screenshot.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setScreenshot(null)}
                  disabled={mutation.isPending}
                >
                  <X className="mr-1 size-3" />
                  {bugReportMessages.dialog.screenshotRemove}
                </Button>
              </div>
            ) : (
              <Input
                id="bug-screenshot"
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleScreenshotChange}
                disabled={mutation.isPending}
              />
            )}
            {screenshotError && <p className="text-destructive text-sm">{screenshotError}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              {bugReportMessages.dialog.cancel}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? bugReportMessages.dialog.submitting
                : bugReportMessages.dialog.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
