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
    summary: 'Cracks run out from the click, then the page falls apart under gravity.',
    motion:
      'Crack lines race out from the impact point. Each shard flies out (faster near the impact), tumbles about a random axis so its glass edge catches the light, falls with gravity and fades. Farther shards start a little later. With physics: rapier() the shards collide on the way down.',
    ends: 'Every shard has fallen away or faded, revealing the new page underneath.',
    custom: false,
    colors: ['#ff5a36', '#ffb38a'],
  },
  {
    name: 'explode',
    title: 'Explode',
    summary: 'A blast from the impact point throws every shard at you, then they fall.',
    motion:
      'No crack: the page bursts at once. Shards fly hard toward the viewer and outward, stretched along their velocity, slowed by drag, and only then start to fall.',
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
