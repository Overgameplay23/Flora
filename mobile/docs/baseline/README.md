# Restoration baseline artefacts

Created 2026-09-16 by the Floura restoration engagement. Everything here is additive and safe to keep in version control.

- `manifest.sha256` — SHA-256 of 182 source, config, SQL, script, asset and native files as they were **before** any change. Verify with:

  ```bash
  sha256sum -c docs/baseline/manifest.sha256
  ```

  Files reported `FAILED` are the ones the first change set modified (listed in `docs/RESTORATION_BASELINE.md`, section 6.8). Everything else should report `OK`.

- `originals/` — byte-for-byte copies (with original modification times) of every pre-existing file that the engagement modified, mirrored at their original relative paths. `app.json` is included although it was not changed, as a reference for the app-identity decision. To see exactly what changed in a file:

  ```bash
  git diff --no-index docs/baseline/originals/src/utils/dateKeys.ts src/utils/dateKeys.ts
  ```

Neither `.env` nor anything under `liftiq/` is recorded here.

## Known gap: `package-lock.json`

The original `package-lock.json` was **not** copied before the test toolchain (`jest`, `jest-expo`,
`@types/jest`) was installed on 2026-09-16; only its SHA-256 is in the manifest. An attempt to rebuild
it from the preserved `package.json` (`npm install --package-lock-only`) produced a functionally
equivalent but **not byte-identical** file, saved as `originals/package-lock.rebuilt.json`. It resolves
the same versions for every package the two lockfiles share; the differences are the added dev-only
test packages.
