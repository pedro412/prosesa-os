import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Company } from '@/lib/queries/companies'

import { CompanyForm } from './CompanyForm'
import { settingsMessages } from './messages'

interface CompanyEditDialogProps {
  // Null when the dialog is closed. Using the company object as the
  // "selected" state also keys the form below — when the object identity
  // changes we get a fresh <CompanyForm>, which resets its local state
  // (dirty fields, errors) without any manual reset.
  company: Company | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CompanyEditDialog({ company, open, onOpenChange }: CompanyEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-3xl"
        data-testid="company-edit-dialog"
        // The form contains many inputs; trapping "Escape to close" would
        // surprise users mid-typing. onOpenChange (X button + overlay click)
        // is enough.
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {settingsMessages.editDialog.title}
            {company && ` · ${company.code}`}
          </DialogTitle>
          <DialogDescription>{settingsMessages.editDialog.description}</DialogDescription>
        </DialogHeader>
        {company && (
          <CompanyForm key={company.id} company={company} onSaved={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}
