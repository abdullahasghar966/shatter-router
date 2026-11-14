export { createShatter } from './core/shatter';
export type {
  FallbackReason,
  PausePoint,
  Shatter,
  ShatterEventHandler,
  ShatterEventMap,
  ShatterEventName,
  ShatterOptions,
  ShatterTestHook,
  TransitionRequest,
} from './core/shatter';
export { classifyLinkClick, findAnchor, getLinkEffect } from './core/links';
export type { LinkClickDecision, LinkClickEvent, LinkLocation, LinkSkipReason } from './core/links';
export { isBrowser, prefersReducedMotion } from './core/env';
export type { CaptureRequest, Capturer, Snapshot } from './core/snapshot';
export type { ViewportMetrics } from './core/viewport';
