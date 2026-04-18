import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, Loader2, Printer } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getAuthorizedDevices, isWebUsbSupported } from '@/lib/print/usb-printer'
import { cn } from '@/lib/utils'
import { usePrinterStore } from '@/store/printer-store'

import { posMessages } from './messages'

// The indicator surfaces four things at a glance:
//  - is the browser capable of WebUSB at all (Chromium only)
//  - has the operator ever authorized a printer on this machine
//  - is an authorized printer currently plugged in right now
//  - did the last print job succeed, fail, or is one in flight
//
// `getAuthorizedDevices()` is polled on mount and on `navigator.usb`
// connect/disconnect events so the badge flips live when the cable is
// yanked — no manual refresh required.

type IndicatorState =
  | 'unsupported'
  | 'unauthorized'
  | 'disconnected'
  | 'printing'
  | 'error'
  | 'ready'

export function PrinterStatusIndicator() {
  const status = usePrinterStore((s) => s.status)
  const storedDeviceLabel = usePrinterStore((s) => s.deviceLabel)
  const lastErrorMessage = usePrinterStore((s) => s.lastErrorMessage)

  const [webUsbSupported] = useState(() => isWebUsbSupported())
  const [connectedName, setConnectedName] = useState<string | null>(null)

  useEffect(() => {
    if (!webUsbSupported) return
    let cancelled = false

    async function refresh() {
      try {
        const devices = await getAuthorizedDevices()
        if (cancelled) return
        setConnectedName(devices[0]?.name ?? null)
      } catch {
        if (!cancelled) setConnectedName(null)
      }
    }
    refresh()

    // `navigator.usb` implements the EventTarget interface. The typed
    // cast keeps us out of the `any` shape we avoid elsewhere.
    const usb = (navigator as unknown as { usb: EventTarget }).usb
    const handler = () => {
      refresh()
    }
    usb.addEventListener('connect', handler)
    usb.addEventListener('disconnect', handler)
    return () => {
      cancelled = true
      usb.removeEventListener('connect', handler)
      usb.removeEventListener('disconnect', handler)
    }
  }, [webUsbSupported])

  const state = deriveState({
    webUsbSupported,
    connectedName,
    storedDeviceLabel,
    status,
  })

  const copy = posMessages.printer[state]
  const variantClass = VARIANTS[state]
  const Icon =
    state === 'printing'
      ? Loader2
      : state === 'unsupported' ||
          state === 'unauthorized' ||
          state === 'disconnected' ||
          state === 'error'
        ? AlertTriangle
        : Printer

  const tooltip = resolveTooltip(state, connectedName ?? storedDeviceLabel, lastErrorMessage)

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/settings/printer"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
              variantClass
            )}
            data-testid="pos-printer-status"
            aria-label={tooltip}
          >
            <Icon aria-hidden className={cn('size-4', state === 'printing' && 'animate-spin')} />
            <span>{copy.label}</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function deriveState(args: {
  webUsbSupported: boolean
  connectedName: string | null
  storedDeviceLabel: string | null
  status: ReturnType<typeof usePrinterStore.getState>['status']
}): IndicatorState {
  const { webUsbSupported, connectedName, storedDeviceLabel, status } = args
  if (!webUsbSupported) return 'unsupported'
  // A live print-in-flight beats the connection check — the device is
  // obviously there or we wouldn't be transferring bytes.
  if (status === 'printing') return 'printing'
  if (!connectedName) {
    // Distinguish "never authorized" from "was authorized but now
    // unplugged" so the tooltip can give the right fix-it hint.
    return storedDeviceLabel ? 'disconnected' : 'unauthorized'
  }
  if (status === 'error') return 'error'
  return 'ready'
}

function resolveTooltip(
  state: IndicatorState,
  deviceLabel: string | null,
  lastErrorMessage: string | null
): string {
  // Switched instead of a single `copy.tooltip` lookup because some
  // states expose a function (ready / error inject runtime context) and
  // the others expose a static string — the narrowing keeps TS happy
  // without an unsafe cast.
  switch (state) {
    case 'ready':
      return posMessages.printer.ready.tooltip(deviceLabel)
    case 'error':
      return posMessages.printer.error.tooltip(lastErrorMessage)
    case 'unsupported':
      return posMessages.printer.unsupported.tooltip
    case 'unauthorized':
      return posMessages.printer.unauthorized.tooltip
    case 'disconnected':
      return posMessages.printer.disconnected.tooltip
    case 'printing':
      return posMessages.printer.printing.tooltip
  }
}

// Variant classes are tied to the theme tokens — no bespoke colors.
// `ready` uses the brand primary (teal in the light theme); the failure
// states all ride `destructive` so the operator's eye catches them.
const VARIANTS: Record<IndicatorState, string> = {
  unsupported: 'border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10',
  unauthorized: 'border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10',
  disconnected: 'border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10',
  error: 'border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10',
  printing: 'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10',
  ready: 'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10',
}
