# Luna

The app is called **Luna** (owner's decision, 2026-10-17; it was Floura / Flora before). The repo, the folder and
the on-device storage keys (`floura:*`) keep the old name on purpose: renaming the keys would wipe people's data.

Mobile app lives in `mobile/` (Expo / React Native + Supabase). See `mobile/README.md` for deploy steps.

## Product direction — read first
Before deciding what to build, read `mobile/docs/product-strategy/PRODUCT_STRATEGY.md`
(summary of the product strategy research). Full source: `Flora_App_Product_Strategy_Research.pdf`
and a greppable text copy `Flora_App_Product_Strategy_Research.txt` in the same folder.

Treat it as the product north star, not a rigid spec. If it conflicts with existing features,
don't remove working code — log the conflict in `mobile/docs/dev-notes.md` for Donovan to decide.
