---
'shatter-router': patch
---

Faster captures on pages with web fonts and design tokens: only the font files that can draw the page's text are inlined (subsets whose `unicode-range` the page does not use are dropped), and custom properties are no longer copied onto every element of the page copy. On the docs landing page this halves the capture time (old design: 70–91 ms → 46 ms, headless Chromium). Also fixes the first frame on Firefox at fractional scroll positions.
