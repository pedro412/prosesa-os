import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCompanies } from '@/lib/queries/companies'
import { buildTestTicketBytes } from '@/lib/print/build-ticket'
import { fetchAndDitherLogo } from '@/lib/print/logo'
import { isWebUsbSupported, printViaUSB, requestPrinter } from '@/lib/print/usb-printer'
import { type PrinterCharWidth, usePrinterStore } from '@/store/printer-store'

import { settingsMessages } from './messages'

const messages = settingsMessages.printer

// Per-workstation printer configuration + WebUSB auth flow. Admin-gated
// via the parent `/_app/settings` route. Everything here is client-
// side: the Zustand store persists to localStorage, WebUSB persists
// the device authorization in the browser's permission store.
export function PrinterSettings() {
  const webUsbSupported = useMemo(() => isWebUsbSupported(), [])

  const charWidth = usePrinterStore((s) => s.charWidth)
  const deviceLabel = usePrinterStore((s) => s.deviceLabel)
  const status = usePrinterStore((s) => s.status)
  const lastErrorMessage = usePrinterStore((s) => s.lastErrorMessage)
  const setCharWidth = usePrinterStore((s) => s.setCharWidth)
  const setDeviceLabel = usePrinterStore((s) => s.setDeviceLabel)
  const setStatus = usePrinterStore((s) => s.setStatus)

  const { data: companies } = useCompanies({ includeInactive: false })
  // Memo so the default-selection effect doesn't re-run every render
  // (fresh `[]` each render would retrigger it and warn via
  // react-hooks/exhaustive-deps).
  const activeCompanies = useMemo(() => companies ?? [], [companies])
  const [testCompanyId, setTestCompanyId] = useState<string | null>(null)

  // Pick the first active company on mount so the test-print button
  // is usable without an extra click. If companies load later, default
  // into the first one that appears.
  useEffect(() => {
    if (testCompanyId) return
    if (activeCompanies.length === 0) return
    setTestCompanyId(activeCompanies[0].id)
  }, [activeCompanies, testCompanyId])

  const testCompany = activeCompanies.find((c) => c.id === testCompanyId) ?? null

  const [authorizing, setAuthorizing] = useState(false)
  const [testing, setTesting] = useState(false)

  async function handleAuthorize() {
    if (!webUsbSupported) return
    setAuthorizing(true)
    try {
      const device = await requestPrinter()
      setDeviceLabel(device.name)
      setStatus('idle', null)
    } catch (err) {
      // User cancelled the browser picker → no-op, no toast. Other
      // errors surface so the user knows something went wrong.
      const name = err instanceof Error ? err.name : ''
      if (name !== 'NotFoundError' && name !== 'AbortError') {
        toast.error(messages.device.authorizeError)
      }
    } finally {
      setAuthorizing(false)
    }
  }

  async function handleTestPrint() {
    if (!testCompany) return
    setTesting(true)
    setStatus('printing', null)
    try {
      const logoBytes = testCompany.logo_url ? await fetchAndDitherLogo(testCompany.logo_url) : null
      const bytes = buildTestTicketBytes({
        company: {
          razon_social: testCompany.razon_social,
          nombre_comercial: testCompany.nombre_comercial,
          rfc: testCompany.rfc,
          regimen_fiscal: testCompany.regimen_fiscal,
          direccion_fiscal: testCompany.direccion_fiscal,
          cp_fiscal: testCompany.cp_fiscal,
        },
        config: { charWidth },
        logoBytes,
      })
      await printViaUSB(bytes)
      setStatus('ok', null)
      toast.success(messages.test.success)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setStatus('error', errorMessage)
      toast.error(messages.test.error, { description: errorMessage })
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className="space-y-4" data-testid="printer-settings">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{messages.sectionTitle}</h2>
        <p className="text-muted-foreground text-sm">{messages.sectionDescription}</p>
      </header>

      {!webUsbSupported && (
        <Card>
          <CardContent className="text-destructive py-4 text-sm" data-testid="printer-unsupported">
            {messages.unsupported}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{messages.status.label}</CardTitle>
          <CardDescription>{statusDescription(status)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{messages.device.label}:</span>
            {deviceLabel ? (
              <Badge variant="secondary" className="font-mono">
                {deviceLabel}
              </Badge>
            ) : (
              <span className="text-muted-foreground">{messages.device.none}</span>
            )}
          </div>
          {lastErrorMessage && (
            <p className="text-destructive text-xs" data-testid="printer-last-error">
              {lastErrorMessage}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{messages.device.authorize}</CardTitle>
          <CardDescription>{messages.device.authorizeHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            onClick={handleAuthorize}
            disabled={!webUsbSupported || authorizing}
            data-testid="printer-authorize"
          >
            {deviceLabel ? messages.device.reauthorize : messages.device.authorize}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{messages.paper.label}</CardTitle>
          <CardDescription>{messages.paper.hint}</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={String(charWidth)}
            onValueChange={(next) => setCharWidth(Number(next) as PrinterCharWidth)}
          >
            <SelectTrigger className="w-full sm:w-80" data-testid="printer-paper-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="42">{messages.paper.option80}</SelectItem>
              <SelectItem value="32">{messages.paper.option58}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{messages.test.button}</CardTitle>
          <CardDescription>{messages.test.hint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeCompanies.length === 0 ? (
            <p className="text-muted-foreground text-sm">{messages.companyNotice.missing}</p>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="printer-test-company">{messages.companyNotice.label}</Label>
              <Select value={testCompanyId ?? undefined} onValueChange={setTestCompanyId}>
                <SelectTrigger
                  id="printer-test-company"
                  className="w-full sm:w-80"
                  data-testid="printer-test-company"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeCompanies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre_comercial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">{messages.companyNotice.hint}</p>
            </div>
          )}

          <Button
            type="button"
            onClick={handleTestPrint}
            disabled={!webUsbSupported || !deviceLabel || !testCompany || testing}
            data-testid="printer-test-button"
          >
            {testing ? messages.test.sending : messages.test.button}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{messages.preview.label}</CardTitle>
          <CardDescription>{messages.preview.hint}</CardDescription>
        </CardHeader>
        <CardContent>
          <pre
            className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs leading-snug"
            data-testid="printer-preview"
          >
            {previewText(charWidth, testCompany?.razon_social ?? 'RAZÓN SOCIAL')}
          </pre>
        </CardContent>
      </Card>
    </section>
  )
}

function statusDescription(status: ReturnType<typeof usePrinterStore.getState>['status']): string {
  if (status === 'printing') return messages.status.printing
  if (status === 'ok') return messages.status.ok
  if (status === 'error') return messages.status.error
  return messages.status.idle
}

function previewText(charWidth: number, headerLine: string): string {
  const bar = '='.repeat(charWidth)
  const minor = '-'.repeat(charWidth)
  const center = (s: string) => {
    const safe = s.slice(0, charWidth)
    const pad = Math.max(0, Math.floor((charWidth - safe.length) / 2))
    return ' '.repeat(pad) + safe
  }
  return [
    bar,
    center(headerLine),
    center('Ticket de ejemplo'),
    minor,
    center('¡Gracias por su compra!'),
    bar,
  ].join('\n')
}
