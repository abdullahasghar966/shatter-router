---
'shatter-router': patch
---

Faster captures on pages with hidden content: elements with `display: none` (closed menus and dialogs, inactive tab panels) are left out of the page copy instead of being cloned and styled. Hidden options of a select and hidden SVG sprite sheets are kept.
