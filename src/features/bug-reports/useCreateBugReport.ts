import { useMutation } from '@tanstack/react-query'

import { createBugReport, type NewBugReport } from '@/lib/queries/bug-reports'

export function useCreateBugReport() {
  return useMutation({
    mutationFn: (input: NewBugReport) => createBugReport(input),
  })
}
