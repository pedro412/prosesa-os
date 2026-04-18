import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Persisted per-workstation printer config. The USB device handle
// itself is NOT persisted — WebUSB already tracks that via the
// browser's permission store; we only keep a human label so the
// settings page can show "authorized: XP-80C" without re-enumerating.

type PrinterStatus = 'idle' | 'printing' | 'ok' | 'error'

// 32 columns for 58mm paper, 42 for 80mm. The project ships 80mm; the
// operator can switch in settings if they ever swap rolls.
export type PrinterCharWidth = 32 | 42

interface PrinterState {
  charWidth: PrinterCharWidth
  deviceLabel: string | null
  status: PrinterStatus
  lastErrorMessage: string | null
  setCharWidth: (width: PrinterCharWidth) => void
  setDeviceLabel: (label: string | null) => void
  setStatus: (status: PrinterStatus, error?: string | null) => void
}

export const usePrinterStore = create<PrinterState>()(
  persist(
    (set) => ({
      charWidth: 42,
      deviceLabel: null,
      status: 'idle',
      lastErrorMessage: null,
      setCharWidth: (charWidth) => set({ charWidth }),
      setDeviceLabel: (deviceLabel) => set({ deviceLabel }),
      setStatus: (status, error) => set({ status, lastErrorMessage: error ?? null }),
    }),
    {
      name: 'prosesa-printer-config',
      // Only persist user-chosen config. Runtime `status` +
      // `lastErrorMessage` should reset on reload.
      partialize: (state) => ({
        charWidth: state.charWidth,
        deviceLabel: state.deviceLabel,
      }),
    }
  )
)
