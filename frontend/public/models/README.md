# Bundled dog model

`dog/dog.glb` is the Quaternius **Shiba Inu**, downloaded from its CC0 Poly Pizza listing. It is loaded locally as `/models/dog/dog.glb`.

See `../../src/assets/3d/ATTRIBUTION.md` for source and license, and `../../MODEL_REPORT.md` for rig/action details. The model uses six embedded material colors, with no external bitmap textures. The renderer preserves the palette and applies nonmetallic rough shading.

To replace it, inspect the new skeleton/clips, update `src/pet-3d/dogConfig.js`, and validate all actions and sensor axes. Do not assume another asset shares the Shiba's bone axes or clip names. See `../../README-PET-3D.md` for the integration copy list and configurable model URL.
