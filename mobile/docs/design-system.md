# Floura design system

Code: `src/theme/tokens.ts` (tokens), `src/theme/fonts.ts` (font loading), `src/utils/haptics.ts`,
`src/components/common/PressableScale.tsx`, `src/components/pet/PetMascot.tsx`, `src/components/pet/SpeechBubble.tsx`.
Reference screen: Home (`src/components/home/`). Design preview on web: `http://localhost:8081/?preview=home`.

## Direction
- **Painted world, warm UI.** The sanctuary painting and the pet carry the richest colour. The interface is warm
  paper (`canvas #FBF4EA`, `paper #FFFBF6`) with tinted ink (`#2E2838`), never pure black or white.
- **Colour has meaning.** Each care category has a tint (card background), a mid (accents, night icons) and a strong
  tone (labels, icons, checks on light). Calm lavender, rest blue, energy apricot, focus teal, body sage, nourish
  water-blue, connection rose, gentle-care pink, play gold. That gives Finch-level colour without Finch's
  uniform saturation, which reads as childish.
- **Light is the brand.** The sky over the scene, the veil behind the greeting and the paper (light or night) follow
  the local time: dawn, morning, day, golden, dusk, night (`skies`, `surfaceFor(phase)`).
- **Type.** Fraunces (soft storybook serif) for titles at 20 pt and up; Nunito (rounded) for everything else, never
  heavier than 800. Scale: `type.display/title/h2/h3/body/bodyStrong/callout/meta/micro/petVoice`.
- **The pet is the anchor.** One hero per screen. Every completed action gets a visible pet response within 300 ms
  (cheer + toast + soft haptic); finishing the day gets one bigger moment (love + success haptic). The pet appears in
  empty states, sheets and celebrations through `PetMascot`.
- **Shape.** Squircle corners (`borderCurve: continuous`): sheet 32, card 24, task row 22, tile 16, chips pill.
  Warm-tinted shadows (`surface.shadow`), never grey.
- **Motion.** Springs: `settle` for layout, `snappy` for presses and checks, `bouncy` only for the pet and the check
  "pop". Every tappable surface scales slightly when pressed (`PressableScale`). Reduced Motion is respected.
- **Haptics are causal only**: soft tap on a tick, success once a day when everything is done, selection on pickers,
  warning when something could not be saved. Never on a missed task, never on a plain button.
- **Icons.** Ionicons outline for meaning (task glyphs, categories) inside tinted tiles; no emoji in the UI.
  Planned: painted icons from the same image pipeline as the pet.
- **Voice.** A warm adult friend. The pet speaks in the first person, never scolds, never counts what was missed.
  Lines are designed (`src/domain/homeDialogue.ts`), not generated.

## Contrast (WCAG 2.x)
ink on paper 13.8:1 · ink2 6.97 · ink3 4.92 · category strong on paper 5.96-7.86 · strong on its own tint
5.24-6.67 · cream on strong 5.96-7.86. On night cards use `mid` (strong fails there). Bloom CTA uses ink text
(5.53:1). Gold is fill-only.
