// Batch Download — filter, select, and package past papers client-side.
(function () {
  var manifest = [];
  var selected = new Set();
  var yearBounds = { min: 2001, max: 2026 };
  var slider = null;

  function currentFilters() {
    return {
      subject: document.getElementById('bd-subject').value,
      level: document.getElementById('bd-level').value,
      type: document.getElementById('bd-type').value
    };
  }

  function currentYearRange() {
    var r = slider ? slider.getRange() : yearBounds;
    return { lo: r.lo, hi: r.hi };
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
    slider = createDualSlider({
      wrapId: 'bd-slider-wrap', minHandleId: 'bd-handle-min', maxHandleId: 'bd-handle-max',
      fillId: 'bd-slider-fill', bubbleMinId: 'bd-bubble-min', bubbleMaxId: 'bd-bubble-max',
      displayId: 'bd-year-range-display', min: yearBounds.min, max: yearBounds.max,
      onChange: function () { renderList(); }
    });
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

    updateDownloadButton();
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
    document.getElementById('bd-select-all').addEventListener('click', selectAllVisible);
    document.getElementById('bd-clear').addEventListener('click', clearSelection);
    document.getElementById('bd-download-btn').addEventListener('click', downloadSelected);
  });
})();

// Batch download — by topic. Zips every question image for the topics you
// pick (optionally narrowed by level and year), instead of whole papers.
(function () {
  var manifest = [];
  var selected = new Set(); // keys: subject|level|paper|topic
  var yearBounds = { min: 2001, max: 2026 };
  var slider = null;

  function currentFilters() {
    return {
      subject: document.getElementById('bdt-subject').value,
      level: document.getElementById('bdt-level').value
    };
  }

  function currentYearRange() {
    var r = slider ? slider.getRange() : yearBounds;
    return { lo: r.lo, hi: r.hi };
  }

  function groupKey(item) {
    return item.subject + '|' + item.level + '|' + item.paper + '|' + item.topic;
  }

  function filteredImages() {
    var f = currentFilters();
    var yr = currentYearRange();
    return manifest.filter(function (item) {
      if (f.subject !== 'all' && item.subject !== f.subject) return false;
      if (f.level !== 'all' && item.level !== f.level) return false;
      return item.year >= yr.lo && item.year <= yr.hi;
    });
  }

  function groupedTopics() {
    var groups = {};
    filteredImages().forEach(function (item) {
      var key = groupKey(item);
      if (!groups[key]) {
        groups[key] = {
          key: key, subject: item.subject, level: item.level, paper: item.paper,
          topic: item.topic, topicLabel: item.topicLabel, count: 0
        };
      }
      groups[key].count++;
    });
    return Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) {
      return a.subject.localeCompare(b.subject) || a.level.localeCompare(b.level) || a.topicLabel.localeCompare(b.topicLabel);
    });
  }

  function setUpYearSlider() {
    slider = createDualSlider({
      wrapId: 'bdt-slider-wrap', minHandleId: 'bdt-handle-min', maxHandleId: 'bdt-handle-max',
      fillId: 'bdt-slider-fill', bubbleMinId: 'bdt-bubble-min', bubbleMaxId: 'bdt-bubble-max',
      displayId: 'bdt-year-range-display', min: yearBounds.min, max: yearBounds.max,
      onChange: function () { renderList(); }
    });
  }

  function levelLabel(l) { return l === 'higher' ? 'Higher' : 'Ordinary'; }
  function subjectLabel(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function paperLabel(p) {
    if (p === 'paper-1') return 'Paper 1';
    if (p === 'paper-2') return 'Paper 2';
    if (p === 'language-skills') return 'Language Skills';
    if (p === 'literature') return 'Literature';
    return p;
  }

  function updateDownloadButton() {
    var btn = document.getElementById('bdt-download-btn');
    var count = document.getElementById('bdt-download-count');
    var title = document.getElementById('bdt-selection-title');
    var totalImages = 0;
    var groups = groupedTopics();
    var byKey = {};
    groups.forEach(function (g) { byKey[g.key] = g; });
    selected.forEach(function (k) { if (byKey[k]) totalImages += byKey[k].count; });
    btn.disabled = selected.size === 0;
    count.textContent = String(totalImages);
    title.textContent = selected.size
      ? selected.size + ' topic' + (selected.size === 1 ? '' : 's') + ' selected'
      : 'Ready to download';
  }

  function updateCount(matched) {
    var countEl = document.getElementById('bdt-count');
    if (!manifest.length) { countEl.textContent = ''; return; }
    countEl.textContent = matched + ' topic' + (matched === 1 ? '' : 's') +
      (selected.size ? ' · ' + selected.size + ' selected' : '');
  }

  function renderList() {
    var container = document.getElementById('bdt-list');

    if (!manifest.length) {
      container.innerHTML = '<div class="bd-empty"><strong>No topic images filed yet</strong>Question images will appear here as topics are added.</div>';
      updateCount(0);
      updateDownloadButton();
      return;
    }

    var groups = groupedTopics();
    updateCount(groups.length);

    if (!groups.length) {
      container.innerHTML = '<div class="bd-empty"><strong>No topics match these filters</strong>Try another subject or level, or widen the year range.</div>';
      updateDownloadButton();
      return;
    }

    container.innerHTML = groups.map(function (g) {
      var checked = selected.has(g.key);
      return '<label class="bd-item' + (checked ? ' is-selected' : '') + '">' +
        '<input type="checkbox" value="' + g.key + '"' + (checked ? ' checked' : '') + '>' +
        '<span class="bd-item-main bdt-topic-row">' +
          '<span><span class="bd-item-title">' + g.topicLabel + '</span>' +
          '<span class="bd-item-meta">' +
            '<span class="bd-chip">' + subjectLabel(g.subject) + '</span>' +
            '<span class="bd-chip">' + levelLabel(g.level) + '</span>' +
            '<span class="bd-chip">' + paperLabel(g.paper) + '</span>' +
          '</span></span>' +
          '<span class="bdt-topic-count">' + g.count + ' image' + (g.count === 1 ? '' : 's') + '</span>' +
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

    updateDownloadButton();
  }

  function selectAllVisible() {
    groupedTopics().forEach(function (g) { selected.add(g.key); });
    renderList();
  }

  function clearSelection() {
    selected.clear();
    renderList();
  }

  function loadManifest() {
    fetch('data/topic-images-manifest.json')
      .then(function (res) { if (!res.ok) throw new Error('manifest'); return res.json(); })
      .then(function (data) { manifest = Array.isArray(data) ? data : []; setUpYearSlider(); renderList(); })
      .catch(function () { manifest = []; setUpYearSlider(); renderList(); });
  }

  function downloadSelected() {
    if (!selected.size || typeof JSZip === 'undefined') return;

    var status = document.getElementById('bdt-status');
    var btn = document.getElementById('bdt-download-btn');
    btn.disabled = true;

    var yr = currentYearRange();
    var images = manifest.filter(function (item) {
      return selected.has(groupKey(item)) && item.year >= yr.lo && item.year <= yr.hi;
    });

    var zip = new JSZip();
    var failed = [];
    var done = 0;

    function next() {
      if (done >= images.length) return finish();
      var item = images[done];
      status.textContent = 'Fetching image ' + (done + 1) + ' of ' + images.length + '…';
      fetch(item.src)
        .then(function (res) { if (!res.ok) throw new Error('not found'); return res.blob(); })
        .then(function (blob) {
          var filename = item.src.split('/').pop();
          var folder = subjectLabel(item.subject) + '/' + levelLabel(item.level) + '/' + item.topicLabel.replace(/[\\/:*?"<>|]/g, '-');
          zip.file(folder + '/' + filename, blob);
        })
        .catch(function () { failed.push(item.src); })
        .finally(function () { done++; next(); });
    }

    function finish() {
      var fileCount = Object.keys(zip.files).filter(function (n) { return !zip.files[n].dir; }).length;
      if (!fileCount) {
        status.textContent = 'None of the selected images could be found.';
        btn.disabled = false;
        return;
      }
      status.textContent = 'Building your ZIP…';
      zip.generateAsync({ type: 'blob' }).then(function (content) {
        var url = URL.createObjectURL(content);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'examindex-topics.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        status.textContent = failed.length
          ? 'Downloaded ' + (images.length - failed.length) + ' of ' + images.length + ' images. ' + failed.length + ' could not be found.'
          : 'Downloaded ' + images.length + ' image' + (images.length === 1 ? '' : 's') + ' as examindex-topics.zip.';
        btn.disabled = false;
      }).catch(function () {
        status.textContent = 'The ZIP could not be created. Please try again.';
        btn.disabled = false;
      });
    }

    next();
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('bdt-list')) return;
    loadManifest();
    ['bdt-subject', 'bdt-level'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', renderList);
    });
    document.getElementById('bdt-select-all').addEventListener('click', selectAllVisible);
    document.getElementById('bdt-clear').addEventListener('click', clearSelection);
    document.getElementById('bdt-download-btn').addEventListener('click', downloadSelected);

    document.querySelectorAll('.bd-mode-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var mode = tab.dataset.mode;
        document.querySelectorAll('.bd-mode-tab').forEach(function (t) {
          t.setAttribute('aria-selected', t.dataset.mode === mode ? 'true' : 'false');
        });
        document.getElementById('bd-mode-paper').hidden = mode !== 'paper';
        document.getElementById('bd-mode-topic').hidden = mode !== 'topic';
      });
    });
  });
})();
