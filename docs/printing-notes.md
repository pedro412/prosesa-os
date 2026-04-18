# Thermal printing — operator + engineering notes

Ticket printing bypasses the OS driver by shipping raw ESC/POS bytes over WebUSB. This note collects the non-obvious things we've learned so new workstations get set up fast and regressions don't ambush the next person.

## Browser support

| Browser           | Supported?              |
| ----------------- | ----------------------- |
| Chrome / Chromium | ✅ (desktop only)       |
| Edge              | ✅                      |
| Opera             | ✅                      |
| Firefox           | ❌ (no `navigator.usb`) |
| Safari            | ❌ (no `navigator.usb`) |

The rest of the app works everywhere. Printing is the only WebUSB-dependent feature; the POS success toast will surface a "Revisa la conexión en Ajustes > Impresora" error on non-Chromium browsers and the operator will need to switch.

## Paper width → column count

| Paper | `charWidth` |
| ----- | ----------- |
| 80 mm | 42          |
| 58 mm | 32          |

The Ajustes → Impresora page exposes the switch. 80 mm is the default; Prosesa's shop rolls are 80 mm.

## First-run authorization

1. Plug the printer in via USB.
2. Open the app in Chrome/Edge, go to **Ajustes → Impresora**.
3. Click **Solicitar acceso a impresora** — Chrome will show the WebUSB device picker.
4. Select the printer (common names: `XP-80C`, `POS80`, `Receipt Printer`, `Bixolon SRP-*`, `EPSON TM-*`).
5. Click **Imprimir ticket de prueba** to verify.

The authorization is scoped to the browser profile + workstation. If you move to a different workstation or re-install the OS, repeat the flow.

## Troubleshooting

| Symptom                                           | Likely cause                                                                                                  | Fix                                                                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| "WebUSB no disponible" toast                      | Firefox/Safari                                                                                                | Switch to Chrome or Edge                                                                                                              |
| "Sin impresora autorizada" toast                  | Never ran the authorize flow, or browser profile reset                                                        | Ajustes → Impresora → Solicitar acceso                                                                                                |
| "No se encontró el endpoint de salida"            | User authorized a non-printer USB device                                                                      | Re-authorize and pick the printer explicitly                                                                                          |
| Printer powers on, receives bytes, prints garbage | Wrong paper-width setting                                                                                     | Flip 80 mm ↔ 58 mm in Ajustes                                                                                                         |
| Accented letters print as `?`                     | Expected — we sanitize to ASCII at build time so cheap printers on the default PC437 code page render cleanly | Nothing to do                                                                                                                         |
| Logo prints as a black rectangle                  | Source image is huge (>1500px) and our dither saturates                                                       | Upload a smaller logo to Supabase Storage (≤600 px wide is plenty)                                                                    |
| Partial cut doesn't fire                          | Printer rejects `GS V 66 n` command                                                                           | Verify the model supports partial cut; some budget printers only support full cut (`GS V 65 n`) — switch in `src/lib/print/escpos.ts` |
| Raster logo shows as noise                        | Printer rejects `GS v 0`                                                                                      | Swap to `GS ( L` in `src/lib/print/logo.ts` (structure is similar, different command byte)                                            |
| Last line of ticket gets nicked by the cut        | Should be rare — `FEED_BEFORE_CUT` already inserts 4 extra LFs                                                | Add more LFs in `escpos.ts::FEED_BEFORE_CUT`                                                                                          |

## Models we've tested

_Fill this in as we certify new printers. Include: model, paper width, whether `GS v 0` (raster logo) works out of the box, whether partial cut fires._

| Model                        | Paper | Raster `GS v 0` | Partial cut | Notes |
| ---------------------------- | ----- | --------------- | ----------- | ----- |
| _pending first on-site test_ |       |                 |             |       |

## Engineering notes

- The driver (`src/lib/print/usb-printer.ts`) ends up closing the device at the end of every print. That avoids the "already open" error on the next print if the previous run's `finally` block didn't run (e.g., tab was force-closed mid-print).
- `sanitize()` in `src/lib/print/escpos.ts` drops diacritics + maps `ñ→n`, `¡→!`, `¿→?`, `€→EUR`. Anything still non-ASCII becomes `?`. Stay ASCII-safe unless we ship a code-page-selection command.
- The logo cache in `src/lib/print/logo.ts` is scoped to the page load. Reloading the tab re-fetches + re-dithers. That's the right granularity — auth tokens for the image URL also refresh on reload.
- Ticket byte layout at `charWidth=42`: `ARTICULO (20) + space + CAN (3) + space + P.U. (8) + space + TOTAL (8) = 41`. The unused trailing column soaks up a little slack if the name gets padded oddly.
