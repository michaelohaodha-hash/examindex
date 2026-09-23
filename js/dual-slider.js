// Shared dual-handle range slider — pointer-driven (mouse, touch, pen) via
// PointerEvent + setPointerCapture, so each handle stays independently
// grabbable no matter how close the two values get, and Arrow/Home/End keys
// work for keyboard users since each handle is a real role="slider" element.
function createDualSlider(cfg) {
  var wrap = document.getElementById(cfg.wrapId);
  var minHandle = document.getElementById(cfg.minHandleId);
  var maxHandle = document.getElementById(cfg.maxHandleId);
  var fill = document.getElementById(cfg.fillId);
  var bubbleMin = document.getElementById(cfg.bubbleMinId);
  var bubbleMax = document.getElementById(cfg.bubbleMaxId);
  var display = cfg.displayId ? document.getElementById(cfg.displayId) : null;
  var bounds = { min: cfg.min, max: cfg.max };
  var lo = bounds.min, hi = bounds.max;

  function pctFor(v) { return ((v - bounds.min) / ((bounds.max - bounds.min) || 1)) * 100; }
  function valueForClientX(clientX) {
    var rect = wrap.getBoundingClientRect();
    var pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(bounds.min + pct * (bounds.max - bounds.min));
  }

  function render() {
    var loPct = pctFor(lo), hiPct = pctFor(hi);
    minHandle.style.left = loPct + '%';
    maxHandle.style.left = hiPct + '%';
    fill.style.left = loPct + '%';
    fill.style.width = Math.max(0, hiPct - loPct) + '%';
    if (bubbleMin) { bubbleMin.textContent = String(lo); bubbleMin.style.left = loPct + '%'; }
    if (bubbleMax) { bubbleMax.textContent = String(hi); bubbleMax.style.left = hiPct + '%'; }
    if (bubbleMin && bubbleMax) {
      var tooClose = Math.abs(hiPct - loPct) < 8;
      bubbleMin.style.opacity = (tooClose && document.activeElement !== minHandle) ? '0' : '1';
      bubbleMax.style.opacity = (tooClose && document.activeElement === minHandle) ? '0' : '1';
    }
    minHandle.setAttribute('aria-valuenow', lo);
    maxHandle.setAttribute('aria-valuenow', hi);
    if (display) display.textContent = lo === hi ? String(lo) : lo + '–' + hi;
  }

  function setLo(v, silent) { lo = Math.max(bounds.min, Math.min(v, hi)); render(); if (!silent) cfg.onChange(lo, hi); }
  function setHi(v, silent) { hi = Math.min(bounds.max, Math.max(v, lo)); render(); if (!silent) cfg.onChange(lo, hi); }

  function wire(handle, setter, isMin) {
    handle.addEventListener('pointerdown', function (e) {
      handle.setPointerCapture(e.pointerId);
      wrap.classList.add('is-dragging');
      handle.classList.add('is-active');
      setter(valueForClientX(e.clientX));
      function onMove(ev) { setter(valueForClientX(ev.clientX)); }
      function onUp() {
        wrap.classList.remove('is-dragging');
        handle.classList.remove('is-active');
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
      }
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    });
    handle.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 5 : 1;
      var cur = isMin ? lo : hi;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setter(cur - step); e.preventDefault(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { setter(cur + step); e.preventDefault(); }
      else if (e.key === 'Home') { setter(bounds.min); e.preventDefault(); }
      else if (e.key === 'End') { setter(bounds.max); e.preventDefault(); }
      else if (e.key === 'PageUp') { setter(cur + 5); e.preventDefault(); }
      else if (e.key === 'PageDown') { setter(cur - 5); e.preventDefault(); }
    });
  }
  wire(minHandle, setLo, true);
  wire(maxHandle, setHi, false);

  minHandle.setAttribute('aria-valuemin', bounds.min);
  minHandle.setAttribute('aria-valuemax', bounds.max);
  maxHandle.setAttribute('aria-valuemin', bounds.min);
  maxHandle.setAttribute('aria-valuemax', bounds.max);
  render();

  return {
    // Lets a page re-scope the slider once it knows the real data range
    // (e.g. after fetching a manifest) instead of being stuck with whatever
    // placeholder min/max the markup shipped with.
    setBounds: function (newMin, newMax) {
      bounds = { min: newMin, max: newMax };
      minHandle.setAttribute('aria-valuemin', newMin);
      minHandle.setAttribute('aria-valuemax', newMax);
      maxHandle.setAttribute('aria-valuemin', newMin);
      maxHandle.setAttribute('aria-valuemax', newMax);
      lo = bounds.min; hi = bounds.max;
      render();
      cfg.onChange(lo, hi, true);
    },
    getRange: function () { return { lo: lo, hi: hi }; }
  };
}
