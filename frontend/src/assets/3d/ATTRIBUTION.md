# Shiba Inu — third-party asset

- **Model:** Shiba Inu, Ultimate Animated Animal Pack
- **Author:** Quaternius
- **Original pack:** https://quaternius.com/packs/ultimateanimatedanimals.html
- **Distribution/model page:** https://poly.pizza/m/y4wdQpg767
- **Downloaded file:** https://static.poly.pizza/ba6d0ee3-bcc0-4ef0-9d3c-a3e245b41c77.glb
- **License:** CC0 1.0 Universal, https://creativecommons.org/publicdomain/zero/1.0/
- **License evidence:** both the author's pack page and individual Poly Pizza model page explicitly identify CC0. Verified 2026-09-27. The author's Google Drive mirror was quota-limited; the same author's CC0 model was downloaded from Poly Pizza instead.
- **Local file:** `public/models/dog/dog.glb`
- **Original size:** 851,196 bytes; 1,950 triangles; 46 skin joints; 24 animation clips.
- **Materials:** six embedded color materials, no bitmap images or external textures. This is the original low-poly material style, not a missing-texture error.
- **Conversion:** none performed locally. The distributed GLB reports `FBX2glTF v0.9.7` as its generator.
- **Modifications:** binary kept unchanged. At runtime, fur materials use nonmetallic rough shading, the model is uniformly scaled/repositioned, and procedural action and sensor offsets are layered onto cloned bones. No animation clips or joints were deleted from the asset.

Attribution is not required by CC0; it is retained here for provenance. No endorsement is implied.
Full loaded bone hierarchy and clip inventory: `dog-manifest.json`. Rebuild that inventory using `node scripts/inspect-dog.mjs`.
