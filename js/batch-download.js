// Batch Download — filter, select, and package past papers client-side.
(function () {
  var manifest = [];
  var selected = new Set();
  var yearBounds = { min: 2001, max: 2026 };

  function currentFilters() {
    return {
      subject: document.getElementById('bd-subject').value,
      level: document.getElementById('bd-level').value,
      type: document.getElementById('bd-type').value
    };
  }

  function currentYearRange() {
    var lo = Number(document.getElementById('bd-year-min').value);
    var hi = Number(document.getElementById('bd-year-max').value);
    return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
  }

  function filteredManifest() {
    var f = currentFilters();
    var yr = currentYearRange();
    return manifest.filter(function (item) {
      if (f.subject !== 'all' && item.subject !== f.subject) return false;
      if (f.level !== 'all' && item.level !== f.level) return false;
      if (f.type !== 'all' && item.type !== f.type) return false;
      return item.year >= yr.lo && item.year <= yr.hi;
    }).sort(function (a, b) {
      return b.year - a.year || a.subject.localeCompare(b.subject) || a.label.localeCompare(b.label);
    });
  }

  function setUpYearSlider() {
    var minInput = document.getElementById('bd-year-min');
    var maxInput = document.getElementById('bd-year-max');
    minInput.min = maxInput.min = yearBounds.min;
    minInput.max = maxInput.max = yearBounds.max;
    minInput.value = yearBounds.min;
    maxInput.value = yearBounds.max;
    updateYearSliderUI();
  }

  function updateYearSliderUI() {
    var minInput = document.getElementById('bd-year-min');
    var maxInput = document.getElementById('bd-year-max');
    var display = document.getElementById('bd-year-range-display');
    var fill = document.getElementById('bd-slider-fill');
    var lo = Number(minInput.value);
    var hi = Number(maxInput.value);

    if (lo > hi) {
      if (document.activeElement === minInput) { maxInput.value = lo; hi = lo; }
      else { minInput.value = hi; lo = hi; }
    }

    display.textContent = lo === hi ? String(lo) : lo + '–' + hi;
    var span = yearBounds.max - yearBounds.min || 1;
    var leftPct = ((lo - yearBounds.min) / span) * 100;
    var rightPct = ((hi - yearBounds.min) / span) * 100;
    fill.style.left = leftPct + '%';
    fill.style.width = Math.max(0, rightPct - leftPct) + '%';
  }

  function updateDownloadButton() {
    var btn = document.getElementById('bd-download-btn');
    var count = document.getElementById('bd-download-count');
    var title = document.getElementById('bd-selection-title');
    btn.disabled = selected.size === 0;
    count.textContent = String(selected.size);
    title.textContent = selected.size
      ? selected.size + ' paper' + (selected.size === 1 ? '' : 's') + ' selected'
      : 'Ready to download';
  }

  function updateCount(matched) {
    var countEl = document.getElementById('bd-count');
    if (!manifest.length) { countEl.textContent = ''; return; }
    countEl.textContent = matched + ' paper' + (matched === 1 ? '' : 's') +
      (selected.size ? ' · ' + selected.size + ' selected' : '');
  }

  function labelParts(item) {
    var subject = item.subject.charAt(0).toUpperCase() + item.subject.slice(1);
    var level = item.level === 'higher' ? 'Higher' : 'Ordinary';
    var type = item.type === 'marking-scheme' ? 'Marking scheme' : 'Exam paper';
    var parts = item.label.split(' — ');
    var title = parts.length > 4 ? parts.slice(4).join(' — ') : type;
    return { subject: subject, level: level, type: type, title: title };
  }

  function renderList() {
    var container = document.getElementById('bd-list');

    if (!manifest.length) {
      container.innerHTML = '<div class="bd-empty"><strong>No papers filed yet</strong>Papers will appear here as they are added to the archive.</div>';
      updateCount(0);
      updateDownloadButton();
      return;
    }

    var items = filteredManifest();
    updateCount(items.length);

    if (!items.length) {
      container.innerHTML = '<div class="bd-empty"><strong>No papers match these filters</strong>Try another subject, level, type, or widen the year range.</div>';
      updateDownloadButton();
      return;
    }

    container.innerHTML = items.map(function (item) {
      var checked = selected.has(item.path);
      var p = labelParts(item);
      return '<label class="bd-item' + (checked ? ' is-selected' : '') + '">' +
        '<input type="checkbox" value="' + item.path + '"' + (checked ? ' checked' : '') + '>' +
        '<span class="bd-item-main">' +
          '<span class="bd-item-title">' + item.year + ' · ' + p.title + '</span>' +
          '<span class="bd-item-meta">' +
            '<span class="bd-chip">' + p.subject + '</span>' +
            '<span class="bd-chip">' + p.level + '</span>' +
            '<span class="bd-chip">' + p.type + '</span>' +
          '</span>' +
        '</span>' +
        '<span class="bd-item-arrow" aria-hidden="true">→</span>' +
      '</label>';
    }).join('');

    Array.prototype.forEach.call(container.querySelectorAll('input[type="checkbox"]'), function (cb) {
      cb.addEventListener('change', function () {
        if (this.checked) selected.add(this.value);
        else selected.delete(this.value);
        renderList();
      });
    });
  }

  function selectAllVisible() {
    filteredManifest().forEach(function (item) { selected.add(item.path); });
    renderList();
  }

  function clearSelection() {
    selected.clear();
    renderList();
  }

  function loadManifest() {
    fetch('data/papers-manifest.json')
      .then(function (res) { if (!res.ok) throw new Error('manifest'); return res.json(); })
      .then(function (data) { manifest = Array.isArray(data) ? data : []; setUpYearSlider(); renderList(); })
      .catch(function () { manifest = []; setUpYearSlider(); renderList(); });
  }

  function downloadSelected() {
    if (!selected.size || typeof JSZip === 'undefined') return;

    var status = document.getElementById('bd-status');
    var btn = document.getElementById('bd-download-btn');
    btn.disabled = true;
    var zip = new JSZip();
    var paths = Array.from(selected);
    var failed = [];
    var done = 0;

    function next() {
      if (done >= paths.length) return finish();
      var path = paths[done];
      status.textContent = 'Fetching paper ' + (done + 1) + ' of ' + paths.length + '…';
      fetch(path)
        .then(function (res) { if (!res.ok) throw new Error('not found'); return res.blob(); })
        .then(function (blob) {
          var filename = path.split('/').pop();
          zip.file(filename, blob);
        })
        .catch(function () { failed.push(path); })
        .finally(function () { done++; next(); });
    }

    function finish() {
      var fileCount = Object.keys(zip.files).length;
      if (!fileCount) {
        status.textContent = 'None of the selected files could be found.';
        btn.disabled = false;
        return;
      }
      status.textContent = 'Building your ZIP…';
      zip.generateAsync({ type: 'blob' }).then(function (content) {
        var url = URL.createObjectURL(content);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'examindex-papers.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        status.textContent = failed.length
          ? 'Downloaded ' + (paths.length - failed.length) + ' of ' + paths.length + ' files. ' + failed.length + ' could not be found.'
          : 'Downloaded ' + paths.length + ' file' + (paths.length === 1 ? '' : 's') + ' as examindex-papers.zip.';
        btn.disabled = false;
      }).catch(function () {
        status.textContent = 'The ZIP could not be created. Please try again.';
        btn.disabled = false;
      });
    }

    next();
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadManifest();
    ['bd-subject', 'bd-level', 'bd-type'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', renderList);
    });
    ['bd-year-min', 'bd-year-max'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', function () {
        updateYearSliderUI();
        renderList();
      });
    });
    document.getElementById('bd-select-all').addEventListener('click', selectAllVisible);
    document.getElementById('bd-clear').addEventListener('click', clearSelection);
    document.getElementById('bd-download-btn').addEventListener('click', downloadSelected);
  });
})();
