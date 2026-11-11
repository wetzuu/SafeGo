# SafeGo design system

Tactile, friendly and honest: complex weather and travel data that reads at a glance, without
claiming more than SafeGo knows.

## Tokens (`app/globals.css`)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `surface` | `#FFFDF9` paper | `#131126` midnight | Page background |
| `panel` | `#FFFFFF` | `#1F1C3B` nebula | Cards |
| `outline` | `#1E1B3A` | `#4A4380` | Tactile borders and hard shadows |
| Accents | Sunny `#10B981` / Mint `#A7F3D0`, Amber `#F59E0B` / Cyan `#06B6D4`, Coral `#F43F5E` / Orange `#FB923C`, Violet `#8B5CF6` | same | Map lines, badges |
| Tones | `tone-calm`, `best`, `rain`, `wet`, `danger`, `school`, `unknown` (+ `-ink`) | dark pairs | Badge background / text, readable in both themes |

Type: **Fredoka** (`font-display`, self-hosted, SIL OFL) for headlines, badges and big numbers; the
system sans for body text. Radius `--radius-tactile` (1.5rem) and hard shadow `--shadow-tactile`
only on tactile pieces; ordinary cards keep `rounded-box` and the soft shadow.

## Primitives (`components/safego/tactile.tsx`)

- `TactileCard`: chunky outline, big radius, hard offset shadow; as a button it presses down
  (`.tactile-press`, off under reduced motion). Use for things people press and the few things that
  must stand out (Sky report, route cards, school tickets, report buttons), not for every box.
- `StoryBadge`: icon + label pill in a tone.
- `FactPill`: small icon + fact (time, distance, weather, road).
- `VisualMeter`: weather intensity in four steps (calm, light, heavy, severe).

## Copy (`lib/safego/humanize-risk.ts`)

All plain-language wording comes from one module, tested in `tests/humanize-risk.test.ts`:
weather levels, route badges and stories, the Sky report, school tickets, relative times.

Rules the tests enforce:

- Never "safe", "safest", "dry", "puddle" or a flood depth (ankle, knee, waist). SafeGo rates
  weather and PAGASA alerts; it does not measure street flooding.
- No jargon in route copy: no "points", "risk score", "tradeoff" or "delta".
- News reports are always labelled as reports, not the school's own notice.
- Sentence case; emoji only as icons next to words, never alone.

## Motion

One ambient animation: the current step of the Sky report pulses while schools are being checked.
Everything else moves only in answer to a tap (press-down). `prefers-reduced-motion` turns both off.
