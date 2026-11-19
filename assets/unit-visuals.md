# Department Unit imagery

Four new images were generated with the built-in image generation tool for the MRPD portal. Original generated PNGs were kept; the website uses optimized WebP copies up to 1200 × 675 pixels. Existing patrol, personnel, evidence and communications images remain available for the other workspaces.

| Unit | Website asset | Scene prompt |
| --- | --- | --- |
| SWAT | `assets/unit-swat.webp` | A police tactical response team in dark protective uniforms and helmets standing beside an armored response SUV outside a Los Santos style urban station. Calm briefing scene, weapons safely slung, no raid or action. |
| Sheriff | `assets/unit-sheriff.webp` | A clearly recognizable sheriff patrol SUV with muted olive and cream livery parked on a rural desert highway in southern California, mountains and scrub land, warm sunset. |
| K9 | `assets/unit-k9.webp` | A German shepherd police service dog wearing a dark K9 working harness beside a uniformed handler and a police vehicle outside an urban station. Dog and handler both clearly visible, calm scene. |
| Air Support | `assets/unit-air.webp` | A police helicopter parked on a rooftop helipad with a Los Santos style downtown skyline in the distance at blue hour. Clear view of the aircraft and rotor, calm grounded scene. |

Each scene was generated separately with this common prompt framing

> Use case: stylized-concept. Asset type: wide photographic web card banner for an MRPD police roleplay department portal. Primary request: [scene prompt above]. Style: polished realistic GTA-like cinematic environment, crisp professional imagery, restrained deep navy and warm highlights, coherent website asset collection. Composition: 16:9 landscape, recognizable main subject centered, safe crop for wide cards. No added headings, chapter numbers, borders, captions, watermarks, or UI. Generate one single full-frame scene.

`unit-workspaces.js` selects these images for cards and workspace headers. Images for custom K9 and Air Support workspaces are matched by their Unit name. No RP-server integration is involved.
