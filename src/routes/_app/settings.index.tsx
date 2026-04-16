import { createFileRoute, redirect } from '@tanstack/react-router'

// /settings has no index content of its own — bounce to the first tab.
export const Route = createFileRoute('/_app/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/companies', replace: true })
  },
})
