---
'shatter-router': minor
---

Navigation memory: Back plays the exact reverse of the effect that brought you to a page, from the same point, and Forward replays it (`backForward: 'mirror'`, the new default). Falling effects get a true time reverse (`'<name>:reverse'`) whose last frame is the page you return to. `TransitionRequest.replace` marks replace navigations; the React, React Router and Next adapters pass it. `explode` now starts exactly at rest.
