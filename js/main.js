// Level tabs (Ordinary / Higher) on each subject page.
// Works with any number of .level-tab buttons wired to .level-panel targets
// via matching data-level attributes.

document.addEventListener('DOMContentLoaded', function () {
  var tabs = document.querySelectorAll('.level-tab');
  if (!tabs.length) return;

  var panels = document.querySelectorAll('.level-panel');

  function activate(level) {
    tabs.forEach(function (tab) {
      var isActive = tab.dataset.level === level;
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.tabIndex = isActive ? 0 : -1;
    });
    panels.forEach(function (panel) {
      panel.hidden = panel.dataset.level !== level;
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      activate(tab.dataset.level);
    });
  });

  // basic left/right arrow key support between tabs
  var tabList = document.querySelector('.level-tabs');
  if (tabList) {
    tabList.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var current = Array.prototype.indexOf.call(tabs, document.activeElement);
      if (current === -1) return;
      var next = e.key === 'ArrowRight'
        ? (current + 1) % tabs.length
        : (current - 1 + tabs.length) % tabs.length;
      tabs[next].focus();
      activate(tabs[next].dataset.level);
    });
  }

  // honour a #higher / #ordinary hash on load, e.g. maths.html#higher
  var hash = window.location.hash.replace('#', '');
  var matching = Array.prototype.find.call(tabs, function (t) {
    return t.dataset.level === hash;
  });
  if (matching) activate(hash);
});
