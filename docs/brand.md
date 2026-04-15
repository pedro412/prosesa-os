# ProsesaOS brand brief

Design direction for the ProsesaOS internal application. This file is the source of truth for color, typography, radius, and shadow decisions that shape the UI chrome. Tokens live in [`src/index.css`](../src/index.css); this file explains **why** they are what they are.

Decisions were reached through a lightweight `shape` interview on 2026-04-15. The goal was a defensible starting theme, not a finished design system — refinements happen in follow-up passes (see [LIT-63](https://linear.app/litoralcode/issue/LIT-63/brand-theme-visual-design-tokens)).

## Feature summary

ProsesaOS is a multi-module internal tool (POS, work orders, inventory, sales notes, cash close, customers, catalog, settings) used by three to five staff at Prosesa Diseño y Publicidad — a print and advertising shop in Ciudad del Carmen. The theme must **feel like a Prosesa product** without distracting from the data those staff stare at for eight-hour shifts.

## Brand voice

- **Warm and competent.** Prosesa's mark is playful and polychromatic — the product shouldn't fight that, but it also shouldn't mimic it in every surface.
- **Calm workhorse, not entertainment.** The UI chrome stays neutral and focused; the brand shows up through the logo, a single saturated accent, and subtle warmth in the neutrals. Status badges and category tags are where the polychrome logo palette can appear, sparingly.
- **Spanish-first, Mexican register.** Copy is already handled in `messages.ts` per feature; typography must support diacritics cleanly.

## Target mood

Warm, friendly, organized. Low chroma in the chrome; one energetic accent. Rounded geometry, soft shadows, generous whitespace — but not cold minimalism.

## Primary accent

**Deep teal** — `oklch(0.55 0.12 195)`, roughly `#0E7C82`. Sampled from the logo's teal/cyan splash. Calm and professional without reading as generic "SaaS blue"; distinctive without the aggression of the orange-yellow that led the first iteration. Passes WCAG AA against white foreground at 4.5:1.

- Primary (default) — solid teal on buttons and primary CTAs
- Primary hover — ~6% darker via color-mix in primitives
- Primary foreground — warm off-white, never pure `#fff`
- Ring (focus) — same hue, slightly higher chroma and lightness for visibility

Other logo colors (orange-yellow, pink, blue, green, purple) are **not** primary; they're reserved as a **palette for status and categorization** (work-order stages, line-item categories) once those features land. No UI chrome uses them.

The original orange-yellow pick was swapped after visual review — the warmth fought the calm-workhorse tone the ticket set. Teal preserves the brand connection (the hue comes straight from the logo) while keeping the chrome restful.

**Destructive** stays on the standard red family — do not repurpose any of the brand hues for destructive actions; semantic meaning > brand harmony.

## Neutral temperature

**Warm grays.** OKLCH neutrals with a sliver of yellow hue (`hue ~ 80`). Matches the cream backdrop the logo lives on. Cool blue-greys would feel corporate and fight the warmth of the primary.

- Background: near-white cream, not pure `#ffffff`
- Card: same as background (no elevation by color)
- Muted / secondary: warm off-white ~4% darker
- Border: warm light gray
- Foreground: deep warm near-black, never pure `#000`

## Typography

Two-family pairing, both from Google Fonts, no self-hosting:

- **Display — Manrope** (500/600/700). Rounded terminals echo the logo wordmark's personality without being cartoonish. Used on headings, card titles, the app title in the header.
- **Body — Inter** (400/500/600). Neutral workhorse for running text, labels, data tables. Ideal for info-dense screens like POS and inventory.

Type scale (Tailwind defaults preserved; no custom scale yet). Tabular numerals enabled via `font-variant-numeric: tabular-nums` on table/money contexts — added inline when those components arrive, not globally.

## Radius

**Friendlier than shadcn default.** `--radius: 0.875rem` (14px). The logo's outer silhouette is all round; our base radius matches rather than fights it. Smaller radii (`sm`, `md`) derive from base via the existing formula in `src/index.css`.

## Shadow

**Subtle and warm.** Default shadcn shadows work, but their tint is cool. We nudge the shadow color toward the warm neutral hue so elevations don't feel blue. One level of shadow for cards, a stronger one for popovers/dialogs — no five-step elevation scale yet.

## Accessibility floor

- **WCAG AA across every semantic pair.** Primary on primary-foreground, foreground on background, border perceivable on background. Verified manually with a contrast checker during the token pass; added to the PR checklist.
- Focus rings visible at all times (no `outline: none` without a replacement).
- Never rely on color alone — status badges get an icon + label.

## Logo treatment

- **Asset:** `src/assets/brand/prosesa-logo.png` — the full stacked logo. Use for documents where full identity matters (print templates, emails — future).
- **App header:** the paint-splatter **P mark** alone + "ProsesaOS" typeset in Manrope. The mark is cropped from the full logo; a dedicated SVG crop is a follow-up improvement (LIT-63b or whenever a vector export arrives).
- **Never stretch, recolor, or place the logo on high-contrast backgrounds that fight the brand's warm cream.** The app's background (warm off-white) is the correct canvas.

## Dark mode

**Deferred.** Tokens are structured so a dark mode can be bolted on later by defining a `:root[data-theme="dark"]` block. Scope decision per [LIT-63](https://linear.app/litoralcode/issue/LIT-63/brand-theme-visual-design-tokens): light mode ships now; dark mode is a follow-up if it proves worth shipping.

## Print stylesheets

**Deferred to the tickets that ship each print template** (thermal ticket in M3, detailed note in M4, corte in M6). Each template will reference the brand tokens as available; this ticket does not attempt to theme templates that don't exist yet.

## Out of scope for LIT-63

- Logo redesign — using the existing Prosesa mark.
- Marketing surfaces — the app has none.
- Component restyling beyond what tokens achieve — shadcn primitives already own the look; this ticket tweaks their tokens, not their structure.

## Implementation notes

- Tokens live in `src/index.css` under `:root` and are exposed through `@theme` to Tailwind.
- Fonts load via `<link rel="preconnect">` + `<link rel="stylesheet">` in `index.html`, wired into `--font-sans` / `--font-display` tokens. No JS dependency.
- The `AppHeader` "P" tile is replaced by the real mark; the wordmark is set in Manrope.
- When a new feature adds a domain-specific color (e.g. order-stage palette), define it as a **new named token** (e.g. `--color-stage-design`) rather than reusing `--primary` — the primary is reserved for CTAs.
