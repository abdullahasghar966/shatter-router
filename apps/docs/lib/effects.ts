/** The effects shown in the gallery: the built-in ones (ADR-055 adds the motion families), and the custom one from the docs. */
export interface EffectInfo {
  readonly name: string;
  readonly title: string;
  readonly summary: string;
  readonly motion: string;
  readonly ends: string;
  readonly custom: boolean;
  /** Two colours for the card's glass art. */
  readonly colors: readonly [string, string];
}

export const EFFECTS: readonly EffectInfo[] = [
  {
    name: 'shatter',
    title: 'Shatter',
    summary: 'The pane cracks from the click, then drops: heavy glass falling, not thrown.',
    motion:
      'A long crack races out from the impact point and holds for a moment. Then the pane drops: the pieces nearest the impact fall first, with little outward speed, turning slowly so their glass edges catch the light, and fade. With physics: rapier() the pieces collide on the way down.',
    ends: 'Every shard has fallen away or faded, revealing the new page underneath.',
    custom: false,
    colors: ['#ff5a36', '#ffb38a'],
  },
  {
    name: 'explode',
    title: 'Explode',
    summary: 'A blast: a white flash, a shockwave, and the page flung at you.',
    motion:
      'No crack: the page breaks into a spider web at once. A white flash lights the impact, a shockwave lifts the page toward you as it passes and the view shakes; then the pieces fly hard at you and outward, stretched along their velocity, slowed by drag, and only then fall.',
    ends: 'Every shard has left the viewport.',
    custom: false,
    colors: ['#f6c945', '#ff7a45'],
  },
  {
    name: 'implode',
    title: 'Implode',
    summary: 'The page is pulled into the click and vanishes into a point.',
    motion:
      'Shards spiral into the impact point like water down a drain, the nearest first, shrinking to nothing as they arrive, with a brief lensing pull on the glass near the point.',
    ends: 'Every shard has reached the point (scale 0).',
    custom: false,
    colors: ['#7b61ff', '#c3b6ff'],
  },
  {
    name: 'flip',
    title: 'Flip',
    summary: 'Every shard turns over in place: the old page on the front, the new on the back.',
    motion:
      'Shards stay in place and turn over by 180° about a random axis, the nearest first, lifting toward you halfway through. The back faces show the incoming page, mirrored so that they tile it exactly.',
    ends: 'Every shard has turned over: the last frame is exactly the new page.',
    custom: false,
    colors: ['#2cb5a0', '#a6f0e1'],
  },
  {
    name: 'assemble',
    title: 'Assemble',
    summary: 'The old page scatters while the new one flies together out of shards.',
    motion:
      'Two layers in one draw call: the outgoing page shatters and falls while shards of the incoming page fly in from off-screen, untwisting, and spring into place with a critically damped spring that never overshoots.',
    ends: 'Every incoming shard has settled at rest: the last frame is exactly the new page.',
    custom: false,
    colors: ['#3f8f5a', '#b7e4a8'],
  },
  {
    name: 'crumble',
    title: 'Crumble',
    summary: 'The pane gives way from the bottom up, like a wall losing its footing.',
    motion:
      'A short crack, then the lowest row drops first and every row above follows, almost straight down: no throw, a little sideways scatter and a lazy tumble. With physics: rapier() the rubble collides on the way down.',
    ends: 'Every piece has fallen below the viewport.',
    custom: false,
    colors: ['#c2703d', '#f0c59a'],
  },
  {
    name: 'rain',
    title: 'Rain',
    summary: 'The page runs off like rain on a window.',
    motion:
      'No crack and no tumble: square tiles drop straight down at random moments, speeding up and streaking along their fall with a faint sway. Pair it with the strips pattern and whole columns pour away.',
    ends: 'Every drop has left the bottom of the viewport.',
    custom: false,
    colors: ['#3d7fc2', '#a9d1f5'],
  },
  {
    name: 'vortex',
    title: 'Vortex',
    summary: 'A twister at the click flings the page outward and up.',
    motion:
      'The opposite of implode: each piece is caught by the swirl, whirls around the impact point (the inner ones faster, as in a real vortex), spirals outward and up toward you and fades as it is thrown clear.',
    ends: 'Every piece has been flung away and faded.',
    custom: false,
    colors: ['#5b4fd6', '#bdb5ff'],
  },
  {
    name: 'wind',
    title: 'Wind',
    summary: 'A gust from the side of the click carries the page away.',
    motion:
      'No crack: the gust sweeps across from the click, lifting each piece, speeding it sideways, buffeting it with turbulence and fluttering it like paper. Every push is solved so the piece clears the edge.',
    ends: 'Every piece has blown past the edge.',
    custom: false,
    colors: ['#2f9e8f', '#a8e6dc'],
  },
  {
    name: 'blinds',
    title: 'Blinds',
    summary: 'Venetian blinds: slats turn edge-on, one after another.',
    motion:
      'The page is cut into vertical strips that turn about their own axis from left to right, closing edge-on and fading so the new page shows between the slats. On other patterns every piece turns like a louvre.',
    ends: 'Every slat has closed and faded.',
    custom: false,
    colors: ['#8a8f99', '#d9dde3'],
  },
  {
    name: 'domino',
    title: 'Domino',
    summary: 'A cascade from the click: each piece tips over and knocks the next.',
    motion:
      'Each piece tips about its bottom edge, its top swinging out toward you, faster and faster, one after another; once flat it drops away and fades.',
    ends: 'Every piece has tipped, dropped and faded.',
    custom: false,
    colors: ['#d64f4f', '#ffb8b8'],
  },
  {
    name: 'slide',
    title: 'Slide',
    summary: 'The page is dealt away: rows slide out in opposite directions.',
    motion:
      'Flat tiles slide straight out of the viewport, alternate rows in opposite directions, each pulling back a touch before it goes. Earlier pieces ride slightly above the rest and pass over them.',
    ends: 'Every tile has slid past the edge.',
    custom: false,
    colors: ['#c49a2c', '#f2dc9a'],
  },
  {
    name: 'fold',
    title: 'Fold',
    summary: 'Origami: every piece folds over toward the click.',
    motion:
      'The creases appear first; then each piece lifts and folds 180° about its edge that faces the click, the nearest first, the later ones landing on top, fading as they land so the new page shows through.',
    ends: 'Every piece has folded over and faded.',
    custom: false,
    colors: ['#3f8f5a', '#b7e4a8'],
  },
  {
    name: 'melt',
    title: 'Melt',
    summary: 'The page melts like wax under a heat source at the click.',
    motion:
      'Each piece sags with its top held, stretching into a drip that runs, thins and fades; neighbouring columns drip at different speeds, so the page runs off in uneven curtains.',
    ends: 'Every drip has run off and faded.',
    custom: false,
    colors: ['#e07a2e', '#ffd0a1'],
  },
  {
    name: 'ripple',
    title: 'Ripple',
    summary: 'The page is water and the click a dropped stone.',
    motion:
      'The page breaks into concentric rings; as the wave reaches a ring it bobs toward and away from you on a growing swell, tilting with the slope of the wave so the glint runs along the crests, then drifts outward and fades.',
    ends: 'Every ring has faded on the swell.',
    custom: false,
    colors: ['#2c86b5', '#a6dcf0'],
  },
  {
    name: 'glitch',
    title: 'Glitch',
    summary: 'A corrupted signal: rows jump, colours split, the page drops out.',
    motion:
      'Nothing falls: rows of the page jump sideways in hard steps, 24 times a second, further and further, while the picture splits into red and blue and scanlines show; row by row the page drops out.',
    ends: 'Every row has dropped out.',
    custom: false,
    colors: ['#d43fd4', '#7ef0ff'],
  },
  {
    name: 'ripple-out',
    title: 'Ripple out',
    summary: 'A custom effect: a ring spreads from the click and lifts each shard away.',
    motion:
      'Written against the public effect interface in about 80 lines, comments included (see “Writing a custom effect”). When the ring reaches a shard, the shard rises on an arc, tilts away from the impact point, drifts outward and fades.',
    ends: 'Every shard has faded out over the new page.',
    custom: true,
    colors: ['#e94b8a', '#ffb3cf'],
  },
];

export function findEffect(name: string): EffectInfo | undefined {
  return EFFECTS.find((effect) => effect.name === name);
}
