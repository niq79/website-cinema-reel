import { validateSettings } from './settings.js';
import { element, frameFor, detailFor } from './cards.js';
import { ReelMotion, wheelPixels, cardPose, imagePose, imageHeightForParallax, LOOP_PADDING } from './navigation.js';

export class CinemaReel {
  constructor({ cards, settings }) {
    this.cards = cards;
    this.settings = settings;
    this.motion = new ReelMotion({ ...settings, total: cards.length });
    this.loop = this.motion.loop;
    this.padding = this.loop ? LOOP_PADDING : 0;
    this.pointer = null;
    this.raf = 0;
    this.lastFrame = null;
    this.textActivity = 0;
    this.imageActivity = 0;
    this.controlState = '';
    this.reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.motion.reducedMotion = this.reduceMotion.matches;
    this.track = document.querySelector('#track');
    this.viewport = document.querySelector('#viewport');
    this.dialog = document.querySelector('#details');
    this.previous = document.querySelector('#previous');
    this.next = document.querySelector('#next');
    this.pips = document.querySelector('#pips');
    this.announcement = document.querySelector('#announcement');
    this.render();
    this.applySettings(settings);
    this.listen();
  }

  get index() { return this.motion.index; }
  get canonicalSlot() { return this.index + this.padding; }

  render() {
    const { cards } = this;
    if (this.loop) {
      for (let i = cards.length - LOOP_PADDING; i < cards.length; i++) {
        this.track.append(frameFor(cards[i], i, cards.length, true));
      }
    }
    cards.forEach((card, index) => {
      this.track.append(frameFor(card, index, cards.length));
      const pip = element('button', 'pip');
      pip.type = 'button';
      pip.setAttribute('aria-label', `Go to ${card.title.join(' ')}`);
      pip.addEventListener('click', () => this.goTo(index));
      this.pips.append(pip);
    });
    if (this.loop) {
      for (let i = 0; i < LOOP_PADDING; i++) this.track.append(frameFor(cards[i], i, cards.length, true));
    }
    this.frames = [...this.track.children];
    this.layers = this.frames.map((frame, slot) => ({
      frame,
      ordinal: slot - this.padding,
      content: frame.querySelector('.card-content'),
      image: frame.querySelector('.image-parallax'),
      soft: frame.querySelector('.image-soft'),
      frost: frame.querySelector('.image-frost'),
      offscreen: false,
    }));
    document.querySelector('#total-number').textContent = String(cards.length).padStart(2, '0');
    this.viewport.setAttribute('aria-describedby', 'navigation-help');
    document.querySelector('#cinema').setAttribute('aria-label', 'Card collection');
    document.querySelector('.reel-nav').setAttribute('aria-label', 'Choose a card');
    this.previous.setAttribute('aria-label', 'Previous card');
    this.next.setAttribute('aria-label', 'Next card');
    this.previous.title = 'Previous card (↑)';
    this.next.title = 'Next card (↓)';
    if (cards.length < 2) document.querySelector('.reel-nav').hidden = true;
  }

  applySettings(patch) {
    this.settings = validateSettings({ ...this.settings, ...patch });
    this.motion.configure(this.settings, performance.now());
    const variables = {
      '--image-blur': `${this.settings.imageBlur}px`,
      '--gap': `${this.settings.cardGap}dvh`,
      '--radius': `${this.settings.cornerRadius}px`,
      '--vignette-depth': `${this.settings.vignetteDepth}dvh`,
      '--vignette-strength': this.settings.vignetteStrength,
      '--image-height': `${imageHeightForParallax(this.settings.parallax) * 100}dvh`,
    };
    for (const [key, value] of Object.entries(variables)) document.documentElement.style.setProperty(key, value);
    this.measure();
  }

  measure() {
    const gap = parseFloat(getComputedStyle(this.track).rowGap) || 0;
    this.slideHeight = this.frames[0].getBoundingClientRect().height;
    this.pitch = this.slideHeight + gap;
    this.centerOffset = this.track.offsetTop + this.slideHeight / 2 - this.viewport.clientHeight / 2;
    // Position is in card units, so a resize preserves progress and the target.
    this.paint();
    this.wake();
  }

  updateControls() {
    const state = `${this.index}:${this.motion.moving}`;
    if (state === this.controlState) return;
    this.controlState = state;
    document.querySelector('#current-number').textContent = String(this.index + 1).padStart(2, '0');
    [...this.pips.children].forEach((pip, index) => pip.setAttribute('aria-current', String(index === this.index)));
    this.previous.disabled = this.cards.length < 2 || (!this.loop && this.index === 0);
    this.next.disabled = this.cards.length < 2 || (!this.loop && this.index === this.cards.length - 1);
    if (this.motion.moving && this.track.contains(document.activeElement)) this.viewport.focus({ preventScroll: true });
    this.frames.forEach(frame => {
      const active = !frame.dataset.duplicate && Number(frame.dataset.index) === this.index;
      // Making the touched frame inert cancels its active pointer on mobile.
      // Keep it interactive while the finger is down, then disable it during
      // the automatic landing like the other navigation paths.
      frame.inert = !active || (this.motion.moving && !this.motion.drag);
      frame.setAttribute('aria-hidden', String(!active));
      frame.classList.toggle('is-active', active);
    });
    if (!this.motion.moving) {
      this.announcement.textContent = `${this.index + 1} of ${this.cards.length}: ${this.cards[this.index].title.join(' ')}`;
    }
  }

  paint() {
    if (this.motion.moving) this.textActivity = this.imageActivity = 1;
    this.track.style.transform = `translate3d(0, ${-(this.motion.position + this.padding) * this.pitch}px, 0)`;
    for (const layer of this.layers) {
      const dy = (layer.ordinal - this.motion.position) * this.pitch + this.centerOffset;
      if (Math.abs(dy) > this.slideHeight * 2) {
        if (!layer.offscreen) {
          layer.content.style.opacity = '0';
          layer.soft.style.visibility = 'hidden';
          layer.frost.style.opacity = '0';
        }
        layer.offscreen = true;
        continue;
      }
      layer.offscreen = false;
      const pose = cardPose(dy, this.slideHeight, this.textActivity, this.settings, this.reduceMotion.matches);
      const imageY = this.reduceMotion.matches ? 0 : -dy * this.settings.parallax;
      const effect = imagePose(dy, this.slideHeight, this.imageActivity, this.settings, this.reduceMotion.matches);
      layer.soft.style.opacity = effect.blur.toFixed(4);
      layer.soft.style.visibility = effect.blur < 0.001 ? 'hidden' : 'visible';
      layer.frost.style.opacity = effect.frost.toFixed(4);
      layer.image.style.transform = `translate3d(0, ${imageY.toFixed(3)}px, 0)`;
      layer.content.style.transform = `translate3d(0, ${pose.y.toFixed(3)}px, 0)`;
      layer.content.style.opacity = pose.opacity.toFixed(4);
      layer.content.style.filter = pose.blur < 0.01 ? 'none' : `blur(${pose.blur.toFixed(2)}px)`;
    }
    this.updateControls();
  }

  wake() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(now => this.tick(now));
  }

  tick(now) {
    this.raf = 0;
    this.motion.update(now);
    const elapsed = this.lastFrame === null ? 16.67 : Math.min(64, now - this.lastFrame);
    if (!this.motion.moving) {
      const clear = (activity, duration) => {
        const next = duration === 0 ? 0 : activity * Math.exp(-elapsed / (duration / 4));
        return next < 0.002 ? 0 : next;
      };
      this.textActivity = clear(this.textActivity, this.settings.textSharpnessMs);
      this.imageActivity = clear(this.imageActivity, this.settings.imageClearMs);
    }
    this.paint();
    if ((this.motion.moving && !this.motion.drag) || (!this.motion.moving && (this.textActivity || this.imageActivity))) {
      this.lastFrame = now;
      this.wake();
    } else {
      this.lastFrame = null;
    }
  }

  step(direction) { this.goTo(this.index, direction); }

  goTo(index, direction = 0) {
    if (this.dialog.open) return;
    this.cancelPointer();
    this.motion.navigate(index, performance.now(), direction);
    this.paint();
    this.wake();
  }

  openDetails(index, trigger) {
    if (this.dialog.open || this.motion.moving || index !== this.index || !this.cards[index].details) return;
    document.querySelector('#detail-content').replaceChildren(detailFor(this.cards[index]));
    this.detailTrigger = trigger;
    this.frames[this.canonicalSlot].classList.add('is-detailed');
    this.dialog.showModal();
    this.dialog.scrollTop = 0;
    document.querySelector('#detail-close').focus({ preventScroll: true });
  }

  cancelPointer(cancelled = true) {
    const pointer = this.pointer;
    if (!pointer) return;
    this.pointer = null;
    if (pointer.dragging) this.motion.endDrag(performance.now(), this.viewport.clientHeight * 0.14 / this.pitch, cancelled);
    if (this.viewport.hasPointerCapture(pointer.id)) this.viewport.releasePointerCapture(pointer.id);
    this.wake();
  }

  listen() {
    this.previous.addEventListener('click', () => this.step(-1));
    this.next.addEventListener('click', () => this.step(1));
    this.track.addEventListener('click', event => {
      const button = event.target.closest('[data-detail]');
      if (button) this.openDetails(Number(button.dataset.detail), button);
    });
    document.querySelector('#cinema').addEventListener('wheel', event => {
      if (this.dialog.open || this.cards.length < 2 || event.target.closest('[data-no-reel]')) return;
      const delta = wheelPixels(event, this.viewport.clientHeight);
      if (!delta) return; // Pinch zoom and horizontal gestures remain native.
      event.preventDefault();
      this.motion.wheelBy(delta, this.pitch, performance.now());
      this.paint();
      this.wake();
    }, { passive: false });

    document.addEventListener('keydown', event => {
      if (this.dialog.open || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target.closest('[data-no-reel], input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === ' ' && event.target.closest('button, a')) return;
      const forward = ['ArrowDown', 'PageDown', ' '].includes(event.key);
      const backward = ['ArrowUp', 'PageUp'].includes(event.key);
      if (!forward && !backward && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      if (event.repeat) return;
      if (event.key === 'Home') this.goTo(0);
      else if (event.key === 'End') this.goTo(this.cards.length - 1);
      else this.step(backward || (event.key === ' ' && event.shiftKey) ? -1 : 1);
    });

    this.viewport.addEventListener('pointerdown', event => {
      if (event.isPrimary === false) { this.cancelPointer(); return; }
      if ((event.pointerType !== 'touch' && event.button !== 0) || this.dialog.open || this.cards.length < 2) return;
      if (event.target.closest('button, a')) return;
      this.pointer = { id: event.pointerId, type: event.pointerType, x: event.clientX, y: event.clientY, lastY: event.clientY, dragging: false };
    });
    this.viewport.addEventListener('pointermove', event => {
      const pointer = this.pointer;
      if (!pointer || pointer.id !== event.pointerId) return;
      if (!pointer.dragging) {
        const dx = event.clientX - pointer.x;
        const dy = event.clientY - pointer.y;
        if (Math.abs(dy) < 5 || Math.abs(dy) < Math.abs(dx) * 1.25) return;
        pointer.dragging = true;
        this.motion.beginDrag(performance.now());
        // Touch pointers already have implicit capture. Moving that capture
        // from the touched card to the viewport emits lostpointercapture and
        // can cancel the gesture in mobile browsers.
        if (pointer.type !== 'touch') this.viewport.setPointerCapture(event.pointerId);
      }
      this.motion.dragBy(pointer.lastY - event.clientY, this.pitch);
      pointer.lastY = event.clientY;
      this.paint();
      this.wake();
    });
    this.viewport.addEventListener('pointerup', event => {
      if (this.pointer?.id === event.pointerId) this.cancelPointer(false);
    });
    this.viewport.addEventListener('pointercancel', event => {
      if (this.pointer?.id === event.pointerId) this.cancelPointer();
    });
    this.viewport.addEventListener('lostpointercapture', event => {
      if (event.target === this.viewport && this.pointer?.id === event.pointerId) this.cancelPointer();
    });
    this.viewport.addEventListener('pointerleave', event => {
      if (this.pointer?.id === event.pointerId && !this.viewport.hasPointerCapture(event.pointerId)) this.cancelPointer();
    });
    this.viewport.addEventListener('selectstart', event => { if (this.pointer) event.preventDefault(); });

    document.querySelector('#detail-close').addEventListener('click', () => this.dialog.close());
    const outsideDialog = event => {
      const rect = this.dialog.getBoundingClientRect();
      return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    };
    this.dialog.addEventListener('pointerdown', event => { this.backdropDown = outsideDialog(event); });
    this.dialog.addEventListener('click', event => {
      if (event.target === this.dialog && this.backdropDown && outsideDialog(event)) this.dialog.close();
    });
    this.dialog.addEventListener('close', () => {
      this.frames.forEach(frame => frame.classList.remove('is-detailed'));
      this.detailTrigger?.focus({ preventScroll: true });
    });
    this.resizeObserver = new ResizeObserver(() => this.measure());
    this.resizeObserver.observe(this.viewport);
    this.reduceMotion.addEventListener('change', () => {
      this.cancelPointer();
      this.motion.reducedMotion = this.reduceMotion.matches;
      if (this.reduceMotion.matches) this.motion.finish();
      this.paint();
      this.wake();
    });
    window.addEventListener('blur', () => this.cancelPointer());
  }
}
