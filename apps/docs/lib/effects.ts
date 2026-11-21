/** The effects shown in the gallery: the five built in, and the custom one from the docs. */
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
