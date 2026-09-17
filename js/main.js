// Sidebar (Home / What's new / Generate a test) + light/dark theme toggle.
// Shared across every page.

(function () {
  var THEME_KEY = 'examindex-theme';

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
    var lightBtn = document.getElementById('theme-light-btn');
    var darkBtn = document.getElementById('theme-dark-btn');
    if (lightBtn && darkBtn) {
      var isDark = theme === 'dark';
      lightBtn.setAttribute('aria-pressed', isDark ? 'false' : 'true');
      darkBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    }
  }

  function setTheme(theme) {
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    applyTheme(theme);
  }

  document.addEventListener('DOMContentLoaded', function () {
    // sync toggle button state with whatever the early head script already applied
    var current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(current);

    var lightBtn = document.getElementById('theme-light-btn');
    var darkBtn = document.getElementById('theme-dark-btn');
    if (lightBtn) lightBtn.addEventListener('click', function () { setTheme('light'); });
    if (darkBtn) darkBtn.addEventListener('click', function () { setTheme('dark'); });

    var menuToggle = document.getElementById('menu-toggle');
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    var closeBtn = document.getElementById('sidebar-close');

    function openSidebar() {
      sidebar.classList.add('is-open');
      overlay.classList.add('is-visible');
      document.body.style.overflow = 'hidden';
      menuToggle.setAttribute('aria-expanded', 'true');
    }

    function closeSidebar() {
      sidebar.classList.remove('is-open');
      overlay.classList.remove('is-visible');
      document.body.style.overflow = '';
      menuToggle.setAttribute('aria-expanded', 'false');
    }

    if (menuToggle && sidebar && overlay) {
      menuToggle.addEventListener('click', openSidebar);
      closeBtn.addEventListener('click', closeSidebar);
      overlay.addEventListener('click', closeSidebar);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeSidebar();
      });
    }
  });
})();

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

// Past Papers dropdown (Year / Level / Type) on each subject page.
// Builds a link to the matching PDFs under papers/<subject>/<level>/...
// so the site owner can drop real files in using the same naming pattern.
function showPastPapers(subjectKey) {
  var year = document.getElementById('pp-year').value;
  var level = document.getElementById('pp-level').value;
  var type = document.getElementById('pp-type').value;

  var levelLabel = level === 'higher' ? 'Higher level' : 'Ordinary level';
  var typeLabel = type === 'marking-scheme' ? 'Marking scheme' : 'Exam paper';

  var base = 'papers/' + subjectKey + '/' + level + '/' + year + '-' + type;

  var results = document.getElementById('pp-results');
  if (!results) return;

  results.innerHTML =
    '<p class="pp-results-heading">' + year + ' — ' + levelLabel + ' — ' + typeLabel + '</p>' +
    '<ul class="pp-links">' +
      '<li><a href="' + base + '-paper-1.pdf">Paper 1</a></li>' +
      '<li><a href="' + base + '-paper-2.pdf">Paper 2</a></li>' +
    '</ul>' +
    '<p class="pp-note">If a link doesn\u2019t open, that paper hasn\u2019t been filed yet.</p>';

  results.hidden = false;
}
