# Local appearance asset sources

All appearance images used by the runtime page are stored locally. Appearance photography and spectral reflectance data are maintained as separate sources.

## Seven-material renderer

- `../material-texture-atlas.png` 鈥?original local seven-material renderer atlas used for warm oak, dark walnut, cognac leather, warm beige fabric, green leaf, skin-tone reference and neutral matte wall.
- Reference and current-light views use the same atlas cell. Screen colour changes are calculated previews and do not alter the source image.

## Dining food reference photographs

The seven files below were generated with the built-in OpenAI image generation tool on 2026-08-03. They use close framing and neutral studio presentation. They identify food categories and are not measured spectral specimens.

- `foods/red-brown-cooked-meat.webp` 鈥?red-brown cooked meat surface.
- `foods/vivid-red-produce.webp` 鈥?vivid red tomato surface.
- `foods/orange-pink-fish.webp` 鈥?orange-pink salmon flesh.
- `foods/deep-green-leaves.webp` 鈥?deep-green spinach leaves.
- `foods/neutral-light-staple.webp` 鈥?cooked white rice.
- `foods/golden-baked-crust.webp` 鈥?golden baked bread crust.
- `foods/dark-brown-roasted.webp` 鈥?dark-roasted coffee beans.

## Use notes

- The runtime page does not request third-party image URLs.
- Food and material photographs are appearance references. Reflectance curves remain engineering models or user-imported measurements.
- Reference, before and after comparisons reuse the same source photograph so the displayed difference comes from the calculated preview transform.