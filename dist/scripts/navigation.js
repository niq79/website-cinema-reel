import { DEFAULT_SETTINGS } from './settings.js';

export function wheelPixels(event, viewportHeight) {
  if (event.ctrlKey || Math.abs(event.deltaX || 0) > Math.abs(event.deltaY || 0)) return 0;
  return (event.deltaY || 0) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportHeight : 1);
}
export const LOOP_PADDING = 2;
export const IMAGE_RATIO = 1.2;
export const MIN_WHEEL_RELEASE_MS = 20;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const mod = (index, total) => ((index % total) + total) % total;
const smoothstep = t => t * t * (3 - 2 * t);

export function imageHeightForParallax(parallax) {
  const centerRange = Math.abs(0.9 * parallax - 0.4);
  const nearCenterRange = 0.4 + 0.1 * Math.abs(parallax);
  return Math.max(IMAGE_RATIO, 2 * Math.max(centerRange, nearCenterRange));
}

/** Detect a fresh push separately from the 20 ms landing response. */
export class GestureTracker {
  constructor() { this.reset(); }
  reset() {
    this.lastTime = -Infinity;
    this.direction = 0;
    this.reversal = 0;
    this.cadenceMs = 0;
  }
  push(delta, now, quietMs, allowReversal = true) {
    const magnitude = Math.abs(delta);
    const direction = Math.sign(delta);
    const interval = now - this.lastTime;
    const quiet = interval >= quietMs;
    if (direction !== this.direction) this.reversal += magnitude;
    else this.reversal = 0;
    const reverse = allowReversal && direction !== this.direction && this.reversal >= 10;
    const fresh = quiet || reverse;
    if (fresh) {
      this.direction = direction;
      this.reversal = 0;
      this.cadenceMs = 0;
    } else {
      if (Number.isFinite(interval) && interval > 0) {
        this.cadenceMs = this.cadenceMs ? this.cadenceMs * 0.65 + interval * 0.35 : interval;
      }
    }
    this.lastTime = now;
    return fresh;
  }
}

/** Keep copy visible enough to see the blur, symmetrically in either direction. */
export function cardPose(dy, height, activity = 0, settings = DEFAULT_SETTINGS, reducedMotion = false) {
  const distance = Math.abs(dy) / height;
  if (reducedMotion) return { opacity: distance < 0.5 ? 1 : 0, blur: 0, y: 0 };
  const amount = smoothstep(clamp(distance / 0.7, 0, 1));
  return {
    opacity: 1 - smoothstep(clamp((distance - 0.08) / 1.05, 0, 1)),
    blur: Math.max(settings.textBlur * amount, Math.min(settings.textMotionBlur, settings.textBlur) * activity),
    y: Math.sign(dy) * 48 * amount,
  };
}

export function imagePose(dy, height, activity, settings, reducedMotion = false) {
  if (reducedMotion || settings.imageEffect === 'off') return { blur: 0, frost: 0 };
  const phase = Math.max(smoothstep(clamp(Math.abs(dy) / height / 0.75, 0, 1)), activity * 0.65);
  return {
    blur: phase * settings.imageIntensity,
    frost: settings.imageEffect === 'frost' ? phase * settings.imageIntensity * settings.frostOpacity : 0,
  };
}

/**
 * One adjacent destination per wheel gesture. Commitment starts a full eased
 * transition immediately, without waiting for release. Old momentum
 * cannot move the destination. After commitment, only a quiet interval can
 * unlock the next card; velocity changes inside one event stream stay locked.
 */
export class ReelMotion {
  constructor({ total, ...settings }) {
    this.total = total;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.loop = this.settings.loop && total > 1;
    this.position = this.target = 0;
    this.direction = 1;
    this.tween = this.wheelUntil = this.gesture = this.drag = null;
    this.tracker = new GestureTracker();
    this.reducedMotion = false;
  }
  get index() { return mod(this.target, this.total); }
  get moving() { return this.tween !== null || this.wheelUntil !== null || this.drag !== null; }
  limit(value) { return (this.loop ? value : clamp(value, 0, this.total - 1)) + 0; }
  releaseDelay() {
    const cadenceGrace = this.tracker.cadenceMs ? this.tracker.cadenceMs * 1.6 : 0;
    return Math.max(this.settings.wheelPauseMs, MIN_WHEEL_RELEASE_MS, cadenceGrace);
  }
  configure(settings, now) {
    this.update(now);
    this.settings = { ...this.settings, ...settings };
    if (this.tween) this.startSettle(now);
    if (this.wheelUntil !== null) this.wheelUntil = this.tracker.lastTime + this.releaseDelay();
  }
  rebase() {
    if (!this.loop) return;
    const shift = Math.floor((this.position + 0.5) / this.total) * this.total;
    if (!shift) return;
    this.position -= shift;
    this.target -= shift;
    if (this.tween) { this.tween.from -= shift; this.tween.to -= shift; }
    for (const gesture of [this.gesture, this.drag]) {
      if (gesture) { gesture.from -= shift; gesture.anchor -= shift; gesture.destination -= shift; }
    }
  }
  startSettle(now) {
    const distance = Math.abs(this.target - this.position);
    this.wheelUntil = null;
    if (this.gesture) this.gesture.released = true;
    if (distance < 0.00001 || this.settings.transitionMs === 0 || this.reducedMotion) {
      this.position = this.target;
      this.tween = null;
      this.rebase();
      return;
    }
    this.direction = Math.sign(this.target - this.position);
    this.tween = {
      from: this.position, to: this.target, start: now,
      duration: this.settings.transitionMs * Math.min(1, Math.max(0.4, Math.sqrt(distance))),
    };
  }
  update(now) {
    if (this.drag) return;
    if (this.wheelUntil !== null && now >= this.wheelUntil) {
      this.wheelUntil = null;
      if (this.gesture) this.gesture.released = true;
    }
    if (!this.tween) return;
    const { from, to, start, duration } = this.tween;
    const t = clamp((now - start) / duration, 0, 1);
    const eased = 1 - (1 - t) ** this.settings.easePower;
    this.position = from + (to - from) * eased;
    if (t === 1) { this.position = to; this.tween = null; }
    this.rebase();
  }
  makeGesture(direction) {
    return { from: this.position, anchor: this.target, destination: this.limit(this.target + direction), direction, distance: 0, released: false, committed: false };
  }
  follow(gesture, delta, pitch) {
    gesture.distance = Math.max(0, gesture.distance + delta * gesture.direction * this.settings.scrollSensitivity / pitch);
    // Approach, never pass, the destination. A visible eased finish is retained.
    const progress = Math.min(0.92, 1 - Math.exp(-gesture.distance));
    this.position = gesture.from + (gesture.destination - gesture.from) * progress;
    if (gesture.distance >= this.settings.commitThreshold) gesture.committed = true;
    this.target = gesture.committed ? gesture.destination : gesture.anchor;
    this.direction = gesture.direction;
    this.rebase();
  }
  wheelBy(delta, pitch, now) {
    if (!Number.isFinite(delta) || !delta || this.total < 2 || this.drag) return false;
    this.update(now);
    const fresh = this.tracker.push(delta, now, this.settings.gestureGapMs, !this.gesture?.committed);
    if (fresh || !this.gesture) {
      this.gesture = this.makeGesture(Math.sign(delta));
    }
    if (this.gesture.released) return false;
    const gesture = this.gesture;
    gesture.distance = Math.max(0, gesture.distance + clamp(delta, -200, 200) * gesture.direction * this.settings.scrollSensitivity / pitch);
    if (gesture.distance >= this.settings.commitThreshold) {
      gesture.committed = true;
      this.target = gesture.destination;
      this.startSettle(now);
    } else {
      this.wheelUntil = now + this.releaseDelay();
    }
    return true;
  }
  navigate(index, now, direction = 0) {
    if (this.total < 2) return false;
    this.update(now);
    this.drag = null;
    this.wheelUntil = null;
    if (this.gesture) this.gesture.released = true;
    if (direction) this.target = this.limit(this.target + direction);
    else {
      if (index < 0 || index >= this.total) return false;
      let distance = index - mod(this.target, this.total);
      if (this.loop && distance > this.total / 2) distance -= this.total;
      if (this.loop && distance < -this.total / 2) distance += this.total;
      this.target = this.limit(this.target + distance);
    }
    this.startSettle(now);
    return true;
  }
  beginDrag(now) {
    this.update(now);
    this.tween = this.wheelUntil = null;
    this.drag = this.makeGesture(0);
    this.drag.anchor = Math.round(this.position);
  }
  dragBy(delta, pitch) {
    if (!this.drag || !delta) return;
    if (!this.drag.direction) {
      this.drag.direction = Math.sign(delta);
      this.drag.destination = this.limit(this.drag.anchor + this.drag.direction);
    }
    this.follow(this.drag, delta, pitch);
  }
  endDrag(now, _threshold, cancelled = false) {
    if (!this.drag) return;
    this.target = this.limit(cancelled || !this.drag.committed ? this.drag.anchor : this.drag.destination);
    this.drag = null;
    this.startSettle(now);
  }
  finish() {
    this.position = this.target;
    this.tween = this.wheelUntil = this.drag = null;
    if (this.gesture) this.gesture.released = true;
    this.rebase();
  }
}
