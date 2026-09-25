# Finch Home v1

## Swap background art
- Update `DEFAULT_GARDEN_ART` in `src/components/finchHome/FinchGardenHeader.tsx` to point at the final PNG.
- If you want a custom gradient fallback, edit the `LinearGradient` colors in the same file.

## Sprite positioning notes
- Pet sprite placement is controlled by `styles.pet` in `src/components/finchHome/FinchGardenHeader.tsx`.
- Garden sprouts/flowers are positioned with `styles.sprout` and `styles.flower` in the same file.
- Adjust `right/left/bottom` offsets and `width/height` to align with the reference layout.
