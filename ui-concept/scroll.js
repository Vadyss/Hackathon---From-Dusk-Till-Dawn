(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const duration = 180;
  let animation = null;
  let frame = 0;

  function cancel() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    animation = null;
  }

  function limit(element) {
    return Math.max(0, element.scrollHeight - element.clientHeight);
  }

  function clamp(value, maximum) {
    return Math.max(0, Math.min(maximum, value));
  }

  function scrollContainer(target, direction) {
    const root = document.scrollingElement;
    const modal = target.closest("dialog[open]");
    const openDialog = document.querySelector("dialog[open]");

    // Keep wheel input on a dialog or its backdrop inside that dialog.
    if (openDialog && !modal) return { boundary: true };

    for (let element = target; element; element = element.parentElement) {
      const style = window.getComputedStyle(element);
      if (element === root && !modal) {
        const bodyStyle = window.getComputedStyle(document.body);
        if (/hidden|clip/.test(style.overflowY) || /hidden|clip/.test(bodyStyle.overflowY)) {
          return { boundary: true };
        }
      }

      const scrollable = element === root || /^(auto|scroll)$/.test(style.overflowY);
      const maximum = scrollable ? limit(element) : 0;
      if (maximum > 1) {
        const canMove = direction > 0
          ? element.scrollTop < maximum - 1
          : element.scrollTop > 1;
        if (canMove) return { element };
      }

      if (scrollable && /^(contain|none)$/.test(style.overscrollBehaviorY)) {
        return { boundary: true };
      }
      if (element === modal) return { boundary: true };
    }
    return {};
  }

  function tick(time) {
    frame = 0;
    const current = animation;
    if (!current) return;

    const element = current.element;
    // A user scroll, a navigation, or a layout change may interrupt the easing.
    if (!element.isConnected || document.hidden || reducedMotion.matches
      || Math.abs(element.scrollTop - current.lastTop) > 2) {
      cancel();
      return;
    }

    const maximum = limit(element);
    current.target = clamp(current.target, maximum);
    const progress = Math.min(1, (time - current.started) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const top = clamp(current.start + (current.target - current.start) * eased, maximum);
    // Explicit instant steps avoid competing with CSS scroll-behavior: smooth.
    element.scrollTo({ top, behavior: "instant" });
    current.lastTop = element.scrollTop;

    if (progress < 1 && Math.abs(current.target - current.lastTop) > 0.5) {
      frame = window.requestAnimationFrame(tick);
    } else {
      cancel();
    }
  }

  document.addEventListener("wheel", (event) => {
    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    if (!target) return;

    // Browsers do not identify the input device. Small or fractional pixel
    // deltas are left native so trackpad motion and its inertia stay intact.
    const coarse = event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL
      || (Math.abs(event.deltaY) >= 50 && Number.isInteger(event.deltaY));
    if (event.defaultPrevented || !event.cancelable || reducedMotion.matches
      || !coarse || !event.deltaY || event.deltaX || event.ctrlKey || event.metaKey || event.shiftKey
      || target.closest("select, input[type='number'], input[type='range'], [role='listbox']")) {
      cancel();
      return;
    }

    const direction = Math.sign(event.deltaY);
    const destination = scrollContainer(target, direction);
    if (!destination.element) {
      cancel();
      if (destination.boundary) event.preventDefault();
      return;
    }

    const element = destination.element;
    const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight) || 20;
    const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? lineHeight
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? element.clientHeight * 0.9 : 1;
    const distance = event.deltaY * unit;
    const maximum = limit(element);
    const currentTop = element.scrollTop;
    const continuing = animation?.element === element && animation.direction === direction
      && Math.abs(currentTop - animation.lastTop) <= 2;
    const previousTarget = continuing ? animation.target : currentTop;
    const backlog = Math.max(120, Math.min(600, element.clientHeight * 0.8));
    const nextTarget = clamp(
      Math.max(currentTop - backlog, Math.min(currentTop + backlog, previousTarget + distance)),
      maximum,
    );
    if (Math.abs(nextTarget - currentTop) < 0.5) return;

    event.preventDefault();
    cancel();
    animation = {
      element,
      direction,
      start: currentTop,
      lastTop: currentTop,
      target: nextTarget,
      started: performance.now(),
    };
    frame = window.requestAnimationFrame(tick);
  }, { passive: false });

  // Hand control back immediately for keyboard, touch, selection or scrollbar
  // dragging. There is no timer or background animation after a wheel step.
  document.addEventListener("keydown", cancel, true);
  document.addEventListener("pointerdown", cancel, { capture: true, passive: true });
  document.addEventListener("touchstart", cancel, { capture: true, passive: true });
  document.addEventListener("visibilitychange", cancel);
  document.addEventListener("close", cancel, true);
  window.addEventListener("blur", cancel);
  window.addEventListener("resize", cancel);
  reducedMotion.addEventListener("change", cancel);
})();
