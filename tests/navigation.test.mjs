import test from 'node:test';
import assert from 'node:assert/strict';
import { ReelMotion, GestureTracker, wheelPixels, cardPose, imagePose, imageHeightForParallax, LOOP_PADDING } from '../dist/scripts/navigation.js';
import { DEFAULT_SETTINGS } from '../dist/scripts/settings.js';

const close = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
const create = options => new ReelMotion({ total: 6, ...options });

test('a long wheel gesture animates to exactly one adjacent card', () => {
  const motion = create({ loop: false });
  let previous = 0;
  for (let i = 0; i < 300; i++) {
    motion.wheelBy(i < 10 ? 4 : 150, 800, i * 8);
    assert.ok(motion.position >= previous && motion.position <= 1);
    previous = motion.position;
  }
  assert.equal(motion.index, 1);
  motion.update(3000);
  assert.equal(motion.position, 1);
  assert.equal(motion.moving, false);
});

test('commitment starts immediately and decelerates all the way without a release pause', () => {
  for (const direction of [-1, 1]) {
    const motion = create({ loop: false, wheelPauseMs: 2000 });
    motion.position = motion.target = 2;
    motion.wheelBy(direction * 180, 800, 0);
    const held = motion.position;
    assert.equal(motion.tween.start, 0);
    assert.equal(motion.wheelUntil, null);
    let previous = held;
    let previousSpeed = Infinity;
    for (let t = 8; t <= 400; t += 8) {
      motion.update(t);
      const speed = (motion.position - previous) * direction;
      assert.ok(speed >= -1e-10 && speed <= previousSpeed + 1e-10);
      if (t < 320) assert.ok(speed > 0, 'No pause before reaching the destination');
      assert.ok(motion.position >= 1 && motion.position <= 3);
      previous = motion.position;
      previousSpeed = speed;
    }
    assert.equal(motion.position, 2 + direction);
  }
});

test('small Magic Mouse packets accumulate, then launch a complete animation', () => {
  const motion = create({ loop: false, wheelPauseMs: 10, commitThreshold: 0.05 });
  motion.wheelBy(24, 800, 0);
  const first = motion.position;
  motion.update(16);
  assert.equal(motion.position, first);
  assert.equal(motion.wheelBy(24, 800, 16), true);
  assert.equal(motion.tween.start, 16);
  assert.equal(motion.wheelUntil, null);
  motion.update(35);
  assert.ok(motion.position > first);
  motion.update(500);
  assert.equal(motion.position, 1);
});

test('old momentum after the response gap cannot retarget or delay the landing', () => {
  const motion = create({ loop: false });
  motion.wheelBy(180, 800, 0);
  motion.update(21);
  const tween = motion.tween;
  for (let t = 30; t <= 500; t += 16) {
    assert.equal(motion.wheelBy(80 * Math.exp(-t / 130), 800, t), false);
    assert.equal(motion.target, 1);
    assert.ok(motion.position <= 1);
    if (motion.tween) assert.equal(motion.tween, tween);
  }
  motion.update(600);
  assert.equal(motion.position, 1);
});

test('a fresh gesture interrupts an unfinished landing immediately and selects the next card', () => {
  const motion = create({ loop: false });
  motion.wheelBy(180, 800, 0);
  motion.update(130);
  const visible = motion.position;
  assert.ok(visible > 0 && visible < 1);
  motion.wheelBy(180, 800, 130);
  close(motion.position, visible);
  assert.equal(motion.target, 2);
  assert.equal(motion.tween.start, 130);
  motion.update(600);
  assert.equal(motion.position, 2);
});

test('renewed acceleration after decay and deliberate reversal count as fresh gestures', () => {
  const tracker = new GestureTracker();
  assert.equal(tracker.push(100, 0, 120), true);
  for (const [delta, time] of [[120, 8], [80, 16], [40, 32], [10, 48], [3, 64]]) assert.equal(tracker.push(delta, time, 120), false);
  assert.equal(tracker.push(30, 80, 120), true);
  assert.equal(tracker.push(-2, 88, 120), false);
  assert.equal(tracker.push(-20, 96, 120), true);
  const motion = create({ loop: false });
  motion.position = motion.target = 2;
  motion.wheelBy(180, 800, 0);
  motion.wheelBy(-180, 800, 8);
  assert.equal(motion.target, 2);
  motion.update(500);
  assert.equal(motion.position, 2);
});

test('subthreshold input does not displace the card; sensitivity changes commitment', () => {
  const motion = create();
  motion.wheelBy(60, 800, 0);
  assert.equal(motion.position, 0);
  assert.equal(motion.target, 0);
  motion.update(500);
  assert.equal(motion.position, 0);
  const sensitive = create({ scrollSensitivity: 2.5 });
  sensitive.wheelBy(60, 800, 0);
  assert.equal(sensitive.target, 1);
});

test('landing timing is independent of display refresh rate and can be retuned live', () => {
  const sixty = create();
  const oneTwenty = create();
  sixty.navigate(1, 0);
  oneTwenty.navigate(1, 0);
  for (let t = 0; t < 210; t += 1000 / 60) sixty.update(t);
  for (let t = 0; t < 210; t += 1000 / 120) oneTwenty.update(t);
  sixty.update(210);
  oneTwenty.update(210);
  close(sixty.position, oneTwenty.position);
  const position = sixty.position;
  sixty.configure({ transitionMs: 100, easePower: 4 }, 210);
  close(sixty.position, position);
  sixty.update(310);
  assert.equal(sixty.position, 1);
  oneTwenty.navigate(2, 210);
  oneTwenty.navigate(3, 220);
  assert.equal(oneTwenty.target, 3);
  oneTwenty.update(700);
  assert.equal(oneTwenty.position, 3);
});

test('loop rebasing preserves neighbors and effects across both seams', () => {
  for (const total of [2, 3, 6]) {
    const motion = create({ total });
    const originals = Array.from({ length: total }, (_, i) => i);
    const slots = [...originals.slice(-LOOP_PADDING), ...originals, ...originals.slice(0, LOOP_PADDING)];
    const visible = () => slots.flatMap((card, slot) => {
      const dy = slot - LOOP_PADDING - motion.position;
      return Math.abs(dy) < 1.2 ? [[card, dy, cardPose(dy * 850, 800)]] : [];
    });
    for (const position of [-0.6, total - 0.4]) {
      motion.position = position;
      motion.target = Math.round(position);
      const before = visible();
      motion.rebase();
      const after = visible();
      assert.equal(after.length, before.length);
      before.forEach((value, i) => {
        assert.equal(value[0], after[i][0]);
        close(value[1], after[i][1]);
        close(value[2].blur, after[i][2].blur);
      });
    }
  }
});

test('repeated fresh gestures cross both loop seams without leaving the frame buffer', () => {
  const motion = create({ total: 3 });
  let now = 0;
  for (const direction of [1, -1]) {
    for (let i = 0; i < 60; i++) {
      const expected = (motion.index + direction + 3) % 3;
      motion.wheelBy(direction * 190, 680, now += 600);
      motion.update(now + 500);
      assert.equal(motion.index, expected);
      assert.equal(motion.position, expected);
    }
  }
});

test('touch dragging stays bounded, waits for release, and supports cancellation', () => {
  const motion = create({ loop: false });
  motion.beginDrag(0);
  motion.dragBy(180, 800);
  const held = motion.position;
  motion.update(1000);
  close(motion.position, held);
  motion.dragBy(2400, 800);
  assert.ok(motion.position < 1);
  motion.endDrag(1000);
  motion.update(1500);
  assert.equal(motion.position, 1);
  motion.beginDrag(1600);
  motion.dragBy(180, 800);
  motion.endDrag(1700, undefined, true);
  motion.update(2200);
  assert.equal(motion.position, 1);
});

test('touch release distance is independent of wheel sensitivity', () => {
  const positions = [];
  for (const scrollSensitivity of [0.25, 0.5, 1, 2.5]) {
    const motion = create({ loop: false, scrollSensitivity });
    motion.beginDrag(0);
    motion.dragBy(120, 800);
    positions.push(motion.position);
    assert.equal(motion.index, 0, 'Touch does not commit before release');
    motion.endDrag(20, 0.14);
    assert.equal(motion.index, 1);
    motion.update(2000);
    assert.equal(motion.position, 1);
  }
  positions.forEach(position => close(position, positions[0]));
});

test('touch sensitivity and threshold tune separate parts of the swipe', () => {
  const softer = create({ loop: false, touchSensitivity: 0.75 });
  const stronger = create({ loop: false, touchSensitivity: 1.5 });
  for (const motion of [softer, stronger]) {
    motion.beginDrag(0);
    motion.dragBy(80, 800);
  }
  assert.ok(stronger.position > softer.position, 'Higher sensitivity follows the finger farther');

  const shortThreshold = create({ loop: false, touchThreshold: 0.08 });
  const longThreshold = create({ loop: false, touchThreshold: 0.14 });
  for (const motion of [shortThreshold, longThreshold]) {
    motion.beginDrag(0);
    motion.dragBy(80, 800);
    motion.endDrag(20);
  }
  assert.equal(shortThreshold.index, 1);
  assert.equal(longThreshold.index, 0);
});

test('finite ends, a single card, instant landing, and reduced motion stay usable', () => {
  const finite = create({ total: 3, loop: false });
  finite.wheelBy(-180, 800, 0);
  assert.equal(finite.position, 0);
  finite.navigate(2, 0);
  finite.update(500);
  finite.wheelBy(180, 800, 510);
  assert.equal(finite.position, 2);
  const single = create({ total: 1 });
  assert.equal(single.wheelBy(180, 800, 0), false);
  assert.equal(single.navigate(0, 0, 1), false);
  const instant = create({ transitionMs: 0 });
  instant.navigate(1, 0);
  assert.equal(instant.position, 1);
  const reduced = create();
  reduced.reducedMotion = true;
  reduced.navigate(1, 0);
  assert.equal(reduced.position, 1);
});

test('wheel units normalize while zoom and horizontal gestures remain native', () => {
  assert.equal(wheelPixels({ deltaY: 3, deltaMode: 1 }, 800), 48);
  assert.equal(wheelPixels({ deltaY: -1, deltaMode: 2 }, 800), -800);
  assert.equal(wheelPixels({ deltaY: 70, ctrlKey: true }, 800), 0);
  assert.equal(wheelPixels({ deltaY: 12, deltaX: 80 }, 800), 0);
});

test('strong text blur is symmetric, includes moving center text, and clears at rest', () => {
  for (const dy of [0, 100, 300, 600]) {
    const up = cardPose(dy, 800, 1);
    const down = cardPose(-dy, 800, 1);
    close(up.blur, down.blur);
    close(up.opacity, down.opacity);
    close(up.y, -down.y);
    assert.ok(up.blur >= 8);
  }
  assert.equal(cardPose(600, 800, 1).blur, 32);
  assert.ok(cardPose(400, 800, 1).opacity > 0.5);
  assert.deepEqual(cardPose(0, 800), { opacity: 1, blur: 0, y: 0 });
  assert.equal(cardPose(400, 800, 1, DEFAULT_SETTINGS, true).blur, 0);
});

test('image treatments are independent, symmetric, clear at rest, and respect reduced motion', () => {
  const frost = { ...DEFAULT_SETTINGS, imageEffect: 'frost' };
  assert.deepEqual(imagePose(300, 800, 1, frost), imagePose(-300, 800, 1, frost));
  assert.ok(imagePose(300, 800, 1, frost).frost > 0);
  assert.equal(imagePose(300, 800, 1, DEFAULT_SETTINGS).frost, 0);
  for (const settings of [DEFAULT_SETTINGS, frost]) {
    assert.deepEqual(imagePose(0, 800, 0, settings), { blur: 0, frost: 0 });
    assert.deepEqual(imagePose(300, 800, 1, settings, true), { blur: 0, frost: 0 });
  }
  assert.deepEqual(imagePose(300, 800, 1, { ...frost, imageEffect: 'off' }), { blur: 0, frost: 0 });
});

test('image overscan covers the visible crop throughout the full parallax range', () => {
  const viewport = 1000;
  const frame = 800;
  for (const parallax of [-1, -0.25, 0, 0.25, 0.83, 1, 1.5, 2]) {
    const image = viewport * imageHeightForParallax(parallax);
    for (let dy = -900; dy <= 900; dy += 10) {
      const top = Math.max(-viewport / 2, dy - frame / 2);
      const bottom = Math.min(viewport / 2, dy + frame / 2);
      if (top >= bottom) continue;
      const center = dy * (1 - parallax);
      assert.ok(center - image / 2 <= top && center + image / 2 >= bottom);
    }
  }
});
