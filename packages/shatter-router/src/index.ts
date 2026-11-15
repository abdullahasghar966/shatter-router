export { createShatter } from './core/shatter';
export type {
  FallbackReason,
  PausePoint,
  Point,
  Shatter,
  ShatterDebugOptions,
  ShatterEventHandler,
  ShatterEventMap,
  ShatterEventName,
  ShatterOptions,
  ShatterTestHook,
  TransitionRequest,
} from './core/types';
export type { PhaseTimings, TransitionState } from './core/machine';
export type { ScrollTarget } from './core/ready';
export type { ScrollLock } from './core/scroll-lock';
export { SHARD_ATTRIBUTE_FLOATS } from './core/effect';
export type {
  EffectContext,
  EffectPoint,
  EffectState,
  FractureContext,
  Random,
  ShardAttributes,
  ShardInfo,
  ShatterEffect,
} from './core/effect';
export { classifyLinkClick, findAnchor, getLinkEffect } from './core/links';
export type { LinkClickDecision, LinkClickEvent, LinkLocation, LinkSkipReason } from './core/links';
export { isBrowser, prefersReducedMotion } from './core/env';
export type { CaptureRequest, Capturer, Snapshot } from './core/snapshot';
export { PHYSICS_TRANSFORM_FLOATS } from './core/physics';
export type {
  PhysicsBackend,
  PhysicsPlugin,
  PhysicsSetup,
  PhysicsShard,
  PhysicsSimulation,
} from './core/physics';
export type { ViewportMetrics } from './core/viewport';
