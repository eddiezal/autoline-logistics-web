# Auto Line Logistics — Web

B2C consumer auto-transport site for Auto Line Logistics, LLC.
Built and operated by [Zaldivar Labs](https://zaldivarlabs.com) under the
April 21, 2026 Service Agreement (Amendment No. 1 executed May 7, 2026).

**Status:** Phase A bootstrap, May 8, 2026. Targeting May 13 staging review and June 17 launch.

---

## Stack

- **Next.js 16** (App Router, RSC by default)
- **TypeScript**
- **Tailwind CSS v4** (`@theme` syntax — design tokens live in `src/app/globals.css`)
- **next/font** — Inter (body) + Newsreader (headings, serif)
- **Hosting:** Vercel (planned)
- **Backend / DB:** Firebase + Firestore (planned, not yet integrated)
- **Payments:** Authorize.Net (planned per Amendment No. 1, Item B)
- **Dispatch APIs:** Super Dispatch (primary, B2C) + Central Dispatch (lead-aggregator-fed business). Both pending API access from Client.
- **i18n:** next-intl (planned, ES/EN per Item C of amendment)
- **Error tracking:** Sentry (planned per Item D of amendment)
- **Bot protection:** hCaptcha (planned per Item D of amendment)

---

## Brand spec (locked May 6, 2026)

Hex extracted directly from Ben's vector logo. **No blue tones anywhere** — primary
is orange + neutral grays + black + white.

| Token | Hex | Use |
|---|---|---|
| `--color-orange` | `#FF6600` | Primary brand color, CTAs, accent |
| `--color-orange-dark` | `#E55C00` | Hover state |
| `--color-orange-light` | `#FFB380` | Light accents |
| `--color-orange-tint` | `#FFE4CC` | Background tints |
| `--color-charcoal` | `#2D2D2D` | Dark surfaces (hero, dark sections) |
| `--color-charcoal-alt` | `#1F1F1F` | Deeper layer |
| `--color-gray-900` | `#1A1A1A` | Near-black (headings) |
| `--color-gray-700` | `#404040` | Body text, dark |
| `--color-gray-500` | `#6B6B6B` | Secondary text |
| `--color-gray-300` | `#B0B0B0` | Placeholder text |
| `--color-gray-200` | `#E5E5E5` | Borders, dividers |
| `--color-gray-100` | `#F5F5F5` | Surface backgrounds |

Tokens are defined in `src/app/globals.css` and exposed as Tailwind
utilities (`bg-orange`, `text-charcoal`, etc.).

Constants for use in TS code: `src/lib/brand.ts`.

Logo files (vector): see `../brand-assets/` in the parent workspace.
Convert .eps → .png/.svg and place in `public/brand/` before launch.

---

## Voice (locked April 30, 2026)

- **Primary:** Modern Trust Operator
- **Editorial:** Anti-Scam Educator (for blog + resource hub)
- **Tone:** Modern, transparent, confident, evidence-driven, plainspoken
- **Avoid:** "price guarantee" (use "locked price"), "vetted" (use "verified")

See `src/lib/brand.ts` for the canonical reference.

---

## Routes scaffolded

- `/` — Homepage with Triple Promise teaser
- `/price-promise` — Price Promise tier explanation
- `/damage-promise` — Coverage details
- `/people-promise` — Family-owned, named coordinators

**Coming next:**
- `/quote` — Quote tool (needs SD/CD pricing logic)
- `/portal` — Customer portal (needs Firebase auth + data model)
- `/corridors/*` — Corridor SEO pages (HI/AK first, per Item F)
- `/about` — Trust block (needs MC#/DOT#/BMC-84 from Ben)
- `/services/*` — Service tier pages
- `/es/*` — Spanish mirror (next-intl integration)

---

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Hot reload is on. Editing any file in `src/` reflects in the browser.

```bash
npm run build      # production build
npm run start      # serve production build
npm run lint       # eslint check
```

---

## Project structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout, font loading, metadata
│   ├── page.tsx            # Homepage
│   ├── globals.css         # Tailwind v4 imports + brand tokens
│   ├── price-promise/
│   ├── damage-promise/
│   └── people-promise/
├── components/             # Reusable React components
│   ├── Header.tsx          # Top utility bar + main nav
│   ├── Footer.tsx          # Footer with company info
│   └── Container.tsx       # Width wrapper
└── lib/
    └── brand.ts            # Brand constants (single source of truth)
```

---

## Reference docs (Notion)

- [Auto Line Logistics workspace](https://www.notion.so/34ee58e3049181d595e8d3b92cd0832f)
- [Phase A Schedule](https://www.notion.so/35ae58e3049181c5b05adc01f5faa2de)
- [Comprehensive Amendment](https://www.notion.so/34fe58e304918101936bd285b1e03fda)
- [Action Items](https://www.notion.so/61d14ba702534a5c99213fb7e395f30f)
- [Brand Voice & Positioning](https://www.notion.so/34fe58e3049181b8a042da86706f5aaf)

---

## Account ownership note

Per §5 of the Service Agreement, account ownership of all project resources
(Vercel, Firebase, GitHub repo, domain registrar) transfers to Auto Line
Logistics, LLC at end of engagement. Plan resource setup with this in mind.

---

## Path note (May 8, 2026)

Project was bootstrapped at:

```
C:\Users\eddie\Documents\Claude\Projects\AutoExpress\autoline-logistics-web
```

Originally planned for `C:\Users\eddie\Documents\Claude\Projects\autoline-logistics-web`
(sibling to AutoExpress workspace). Nested under AutoExpress for now because
the Cowork workspace mount is rooted there. To relocate: move the folder
out of AutoExpress and re-add the parent dir as a Cowork workspace.
