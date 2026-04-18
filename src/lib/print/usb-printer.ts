// WebUSB printer driver — sends raw ESC/POS bytes straight to the
// device, bypassing the OS print dialog. Compatible with generic 80mm
// / 58mm thermal printers (POS80, Epson, Star, Bixolon). Ported from
// motoisla-platform where this same driver has shipped reliably.
//
// Browser support: Chromium only (Chrome, Edge, Opera). Firefox and
// Safari do not expose `navigator.usb`. Callers should check
// `isWebUsbSupported()` before surfacing the print action.

// Minimal WebUSB type definitions — @types/w3c-web-usb isn't in
// @types/node and we don't want a Node-typings dep just for the USB
// interface. Keep these shapes narrow; expand if a new field is needed.

interface UsbEndpoint {
  endpointNumber: number
  type: 'bulk' | 'interrupt' | 'isochronous' | 'control'
  direction: 'in' | 'out'
}

interface UsbAlternate {
  endpoints: UsbEndpoint[]
}

interface UsbInterface {
  interfaceNumber: number
  alternate: UsbAlternate
}

interface UsbConfig {
  interfaces: UsbInterface[]
}

interface UsbDevice {
  opened: boolean
  configuration: UsbConfig | null
  productName?: string
  vendorId?: number
  productId?: number
  open(): Promise<void>
  close(): Promise<void>
  selectConfiguration(value: number): Promise<void>
  claimInterface(interfaceNumber: number): Promise<void>
  releaseInterface(interfaceNumber: number): Promise<void>
  transferOut(
    endpointNumber: number,
    data: ArrayBuffer | ArrayBufferView
  ): Promise<{ status: string; bytesWritten: number }>
}

interface UsbManager {
  getDevices(): Promise<UsbDevice[]>
  requestDevice(opts: { filters: Array<{ vendorId?: number }> }): Promise<UsbDevice>
}

function getUsb(): UsbManager | null {
  if (typeof navigator === 'undefined' || !('usb' in navigator)) return null
  return (navigator as unknown as { usb: UsbManager }).usb
}

export function isWebUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator
}

export interface AuthorizedDevice {
  name: string
  vendorId: string
  productId: string
}

export async function getAuthorizedDevices(): Promise<AuthorizedDevice[]> {
  const usb = getUsb()
  if (!usb) return []
  const devices = await usb.getDevices()
  return devices.map((d) => ({
    name: d.productName ?? 'Impresora térmica',
    vendorId: (d.vendorId ?? 0).toString(16).toUpperCase().padStart(4, '0'),
    productId: (d.productId ?? 0).toString(16).toUpperCase().padStart(4, '0'),
  }))
}

// Triggers the one-time authorization popup. Must be called from a
// user gesture (click) per WebUSB rules. Returns the authorized device
// so the caller can persist its label.
export async function requestPrinter(): Promise<AuthorizedDevice> {
  const usb = getUsb()
  if (!usb) throw new Error('WebUSB no disponible. Usa Chrome o Edge.')
  // Empty filters list = any USB device; user picks from the popup.
  const device = await usb.requestDevice({ filters: [{}] })
  return {
    name: device.productName ?? 'Impresora térmica',
    vendorId: (device.vendorId ?? 0).toString(16).toUpperCase().padStart(4, '0'),
    productId: (device.productId ?? 0).toString(16).toUpperCase().padStart(4, '0'),
  }
}

// Sends raw ESC/POS bytes to the first authorized USB printer. Opens
// device → finds the bulk-out endpoint dynamically → transfers →
// releases + closes. Throws on any failure with a readable message the
// UI can surface in a toast.
export async function printViaUSB(data: Uint8Array): Promise<void> {
  const usb = getUsb()
  if (!usb) throw new Error('WebUSB no disponible. Usa Chrome o Edge.')

  const devices = await usb.getDevices()
  if (devices.length === 0) {
    throw new Error('Sin impresora autorizada. Ve a Ajustes > Impresora y solicita acceso.')
  }

  const device = devices[0]
  let claimedInterface = -1

  try {
    // Close first if previously left open (e.g. after a failed print).
    if (device.opened) {
      try {
        await device.close()
      } catch {
        /* ignore */
      }
    }

    await device.open()

    if (!device.configuration) {
      await device.selectConfiguration(1)
    }

    // Dynamically find the bulk-out endpoint. Some printers expose
    // several interfaces; we pick the first one with an OUT bulk ep.
    let endpointNumber = -1
    for (const iface of device.configuration!.interfaces) {
      const ep = iface.alternate.endpoints.find((e) => e.type === 'bulk' && e.direction === 'out')
      if (ep) {
        claimedInterface = iface.interfaceNumber
        endpointNumber = ep.endpointNumber
        break
      }
    }

    if (endpointNumber === -1) {
      throw new Error(
        'No se encontró el endpoint de salida. Verifica que el dispositivo autorizado sea la impresora correcta.'
      )
    }

    await device.claimInterface(claimedInterface)
    await device.transferOut(
      endpointNumber,
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    )
  } finally {
    if (claimedInterface !== -1) {
      try {
        await device.releaseInterface(claimedInterface)
      } catch {
        /* ignore */
      }
    }
    try {
      await device.close()
    } catch {
      /* ignore */
    }
  }
}
