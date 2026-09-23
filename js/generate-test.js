// Generate Test — pick a subject, level and topics; build a printable,
// watermarked PDF worksheet from real past-paper question images.
(function () {
  var topicsData = null;    // data/topics.json
  var countByKey = {};      // "subject|level|paper|topic" -> image count (all years)
  var manifestByKey = {};   // "subject|level|paper|topic" -> [images]
  var selected = new Set(); // selected topic keys
  var dataMinYear = null;   // earliest year present in the manifest
  var dataMaxYear = null;   // latest year present in the manifest
  var slider = null;        // dual-handle year slider (see js/dual-slider.js)

  function subjectLabel(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function levelLabel(l) { return l === 'higher' ? 'Higher' : 'Ordinary'; }
  function paperLabel(p) {
    if (p === 'paper-1') return 'Paper 1';
    if (p === 'paper-2') return 'Paper 2';
    if (p === 'language-skills') return 'Language Skills';
    if (p === 'literature') return 'Literature';
    return p;
  }

  function currentSubject() { return document.getElementById('gt-subject').value; }
  function currentLevel() { return document.getElementById('gt-level').value; }

  // Current [min, max] from the year-range slider (inclusive).
  function currentYearRange() {
    if (!slider) return [dataMinYear || 0, dataMaxYear || 0];
    var r = slider.getRange();
    return [r.lo, r.hi];
  }

  function countInRange(key, minY, maxY) {
    var items = manifestByKey[key] || [];
    var n = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i].year >= minY && items[i].year <= maxY) n++;
    }
    return n;
  }

  function relevantTopics() {
    var subject = currentSubject();
    var level = currentLevel();
    var range = currentYearRange();
    var levels = (topicsData && topicsData[subject]) || {};
    var levelKeys = level === 'all' ? Object.keys(levels) : [level];
    var rows = [];
    levelKeys.forEach(function (lvl) {
      var papers = levels[lvl] || {};
      Object.keys(papers).forEach(function (paper) {
        papers[paper].forEach(function (item) {
          var key = subject + '|' + lvl + '|' + paper + '|' + item.topic;
          rows.push({
            key: key, subject: subject, level: lvl, paper: paper,
            topic: item.topic, topicLabel: item.label,
            count: countInRange(key, range[0], range[1])
          });
        });
      });
    });
    rows.sort(function (a, b) {
      return (b.count > 0) - (a.count > 0) || a.level.localeCompare(b.level) || a.topicLabel.localeCompare(b.topicLabel);
    });
    return rows;
  }

  function updateCount(rows) {
    var el = document.getElementById('gt-count');
    var available = rows.filter(function (r) { return r.count > 0; }).length;
    el.textContent = available + ' topic' + (available === 1 ? '' : 's') + ' with questions available' +
      (selected.size ? ' · ' + selected.size + ' selected' : '');
  }

  function updateGenerateButton() {
    var btn = document.getElementById('gt-generate-btn');
    var label = document.getElementById('gt-generate-label');
    var range = currentYearRange();
    var totalImages = 0;
    selected.forEach(function (k) { totalImages += countInRange(k, range[0], range[1]); });
    btn.disabled = selected.size === 0;
    var n = selectedQuestionCount();
    var willUse = n === null ? totalImages : Math.min(n, totalImages);
    label.textContent = selected.size
      ? 'Generate PDF · ' + willUse + ' question' + (willUse === 1 ? '' : 's')
      : 'Select at least one topic';
  }

  function renderList() {
    var container = document.getElementById('gt-list');
    var rows = relevantTopics();
    updateCount(rows);

    if (!rows.length) {
      container.innerHTML = '<div class="bd-empty"><strong>No topics indexed for this subject yet</strong>Try a different subject or level.</div>';
      updateGenerateButton();
      return;
    }

    container.innerHTML = rows.map(function (r) {
      var disabled = r.count === 0;
      var checked = selected.has(r.key);
      return '<label class="bd-item' + (checked ? ' is-selected' : '') + (disabled ? ' is-disabled' : '') + '">' +
        '<input type="checkbox" value="' + r.key + '"' + (checked ? ' checked' : '') + (disabled ? ' disabled' : '') + '>' +
        '<span class="bd-item-main gt-topic-row">' +
          '<span><span class="bd-item-title">' + r.topicLabel + '</span>' +
          '<span class="bd-item-meta">' +
            '<span class="bd-chip">' + levelLabel(r.level) + '</span>' +
            '<span class="bd-chip">' + paperLabel(r.paper) + '</span>' +
          '</span></span>' +
          '<span class="bdt-topic-count">' + (disabled ? 'No questions yet' : r.count + ' question' + (r.count === 1 ? '' : 's')) + '</span>' +
        '</span>' +
      '</label>';
    }).join('');

    Array.prototype.forEach.call(container.querySelectorAll('input[type="checkbox"]:not(:disabled)'), function (cb) {
      cb.addEventListener('change', function () {
        if (this.checked) selected.add(this.value);
        else selected.delete(this.value);
        renderList();
      });
    });

    updateGenerateButton();
  }

  function selectAllVisible() {
    relevantTopics().forEach(function (r) { if (r.count > 0) selected.add(r.key); });
    renderList();
  }

  function clearSelection() {
    selected.clear();
    renderList();
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function selectedQuestionCount() {
    var countSel = document.getElementById('gt-question-count').value;
    if (countSel === 'all') return null;
    if (countSel === 'custom') {
      var custom = parseInt(document.getElementById('gt-question-count-custom').value, 10);
      if (!custom || custom < 1) return null;
      return custom;
    }
    return parseInt(countSel, 10);
  }

  function buildQuestionSet() {
    var range = currentYearRange();
    // Only topics with at least one question in the selected year range are
    // used — a topic with nothing available (wrong years, or a subject with
    // no papers indexed yet) is silently dropped rather than causing an error.
    var rows = Array.from(selected).map(function (key) {
      return { key: key, count: countInRange(key, range[0], range[1]) };
    }).filter(function (r) { return r.count > 0; });

    var n = selectedQuestionCount();
    var alloc = allocateEvenly(rows, n);

    var pool = [];
    rows.forEach(function (r) {
      var imgs = (manifestByKey[r.key] || []).filter(function (img) {
        return img.year >= range[0] && img.year <= range[1];
      });
      shuffle(imgs);
      pool = pool.concat(imgs.slice(0, alloc[r.key] || 0));
    });

    var order = document.getElementById('gt-order').value;
    if (order === 'year-desc') pool.sort(function (a, b) { return b.year - a.year; });
    else if (order === 'year-asc') pool.sort(function (a, b) { return a.year - b.year; });
    else shuffle(pool);

    return pool;
  }

  // Splits `target` questions as evenly as possible across `rows` (one
  // selected topic per row), so e.g. 2 topics selected means each gets
  // roughly half the test, 3 topics roughly a third, and so on — capped by
  // how many questions each topic actually has available. Water-fills in
  // rounds: give every topic an equal base share, drop any topic that hits
  // its cap, and repeat with whatever's left over the topics still with
  // room. Once fewer questions remain than there are topics left, those
  // "remainder" questions are handed out one at a time in shuffled order —
  // that's the "±1 question per topic" rounding tolerance, since exact
  // question counts rarely divide evenly.
  function allocateEvenly(rows, target) {
    var alloc = {};
    rows.forEach(function (r) { alloc[r.key] = 0; });
    if (!rows.length) return alloc;

    if (target === null) {
      rows.forEach(function (r) { alloc[r.key] = r.count; });
      return alloc;
    }

    var caps = {};
    rows.forEach(function (r) { caps[r.key] = r.count; });
    var totalAvailable = rows.reduce(function (s, r) { return s + r.count; }, 0);
    var remaining = Math.min(target, totalAvailable);
    var active = rows.map(function (r) { return r.key; });

    while (remaining > 0 && active.length) {
      var base = Math.floor(remaining / active.length);
      if (base > 0) {
        var stillActive = [];
        active.forEach(function (key) {
          var give = Math.min(base, caps[key] - alloc[key]);
          alloc[key] += give;
          remaining -= give;
          if (alloc[key] < caps[key]) stillActive.push(key);
        });
        active = stillActive;
      } else {
        shuffle(active);
        for (var i = 0; i < active.length && remaining > 0; i++) {
          var k = active[i];
          if (alloc[k] < caps[k]) { alloc[k]++; remaining--; }
        }
        break;
      }
    }
    return alloc;
  }

  function loadImageAsset(src) {
    return fetch(src)
      .then(function (res) { if (!res.ok) throw new Error('fetch failed'); return res.blob(); })
      .then(function (blob) {
        return Promise.all([
          blob,
          ('createImageBitmap' in window)
            ? createImageBitmap(blob).then(function (bmp) { return { w: bmp.width, h: bmp.height }; })
            : Promise.resolve({ w: 827, h: 1170 })
        ]);
      })
      .then(function (res) {
        var blob = res[0], size = res[1];
        return new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function () { resolve({ dataUrl: reader.result, w: size.w, h: size.h }); };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      });
  }

  function loadLogoDataUrl() {
    return fetch('images/logo-mark.png')
      .then(function (res) { if (!res.ok) throw new Error('logo fetch failed'); return res.blob(); })
      .then(function (blob) {
        return new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function () { resolve(reader.result); };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      })
      .catch(function () { return null; });
  }

  function setProgress(pct, text) {
    var wrap = document.getElementById('gt-progress');
    var fill = document.getElementById('gt-progress-fill');
    var label = document.getElementById('gt-progress-text');
    wrap.hidden = false;
    fill.style.width = pct + '%';
    label.textContent = text;
  }

  function addWatermark(doc, pageW, logoDataUrl) {
    if (logoDataUrl) {
      // Small logo mark top-left, "examindex" wordmark top-right.
      try { doc.addImage(logoDataUrl, 'PNG', 15, 6, 6, 6, undefined, 'FAST'); } catch (e) {}
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(178, 188, 205);
      doc.text('examindex', 15, 10);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(178, 188, 205);
    doc.text('examindex', pageW - 15, 10, { align: 'right' });
    doc.setTextColor(30, 41, 59);
  }

  function footer(doc, pageW, pageH, pageNum) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 158, 172);
    doc.text('examindex.ie · practice set', 15, pageH - 8);
    doc.text(String(pageNum), pageW - 15, pageH - 8, { align: 'right' });
    doc.setTextColor(30, 41, 59);
  }

  function generate() {
    if (!selected.size) return;
    if (typeof window.jspdf === 'undefined') {
      setProgress(0, 'PDF library failed to load. Check your connection and try again.');
      return;
    }

    var btn = document.getElementById('gt-generate-btn');
    btn.disabled = true;

    var questions = buildQuestionSet();
    if (!questions.length) {
      setProgress(0, 'No questions are available for this selection.');
      btn.disabled = false;
      return;
    }

    var subject = currentSubject();
    var levelSel = currentLevel();
    var range = currentYearRange();
    var topicLabels = [];
    var seenTopics = {};
    questions.forEach(function (q) {
      var key = q.subject + '|' + q.level + '|' + q.paper + '|' + q.topic;
      if (!seenTopics[key]) {
        seenTopics[key] = true;
        topicLabels.push(q.topicLabel + ' (' + levelLabel(q.level) + ')');
      }
    });

    setProgress(2, 'Preparing your test…');

    loadLogoDataUrl().then(function (logoDataUrl) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4' });
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();
    var marginL = 15, marginTop = 22, marginBottom = 16;
    var maxW = pageW - marginL * 2;
    var maxH = pageH - marginTop - marginBottom;

    // Cover page — big logo + title serves as the branding here, so just
    // add the small "examindex" mark to the top-right corner for consistency
    // with the interior pages, rather than doubling up the logo mark.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(178, 188, 205);
    doc.text('examindex', pageW - 15, 10, { align: 'right' });
    doc.setTextColor(30, 41, 59);

    var titleX = marginL;
    if (logoDataUrl) {
      try { doc.addImage(logoDataUrl, 'PNG', marginL, 20, 16, 16, undefined, 'FAST'); titleX = marginL + 22; } catch (e) {}
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(20, 28, 45);
    doc.text('examindex practice set', titleX, 32);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 72, 94);
    doc.text(subjectLabel(subject) + ' · ' + (levelSel === 'all' ? 'Mixed levels' : levelLabel(levelSel)), titleX, 42);
    doc.setFontSize(10);
    doc.setTextColor(110, 122, 140);
    var yearText = range[0] === range[1] ? String(range[0]) : range[0] + '\u2013' + range[1];
    doc.text(questions.length + ' question' + (questions.length === 1 ? '' : 's') + ' · ' + yearText + ' · generated ' + new Date().toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' }), titleX, 49);

    doc.setFontSize(10.5);
    doc.setTextColor(80, 92, 112);
    doc.text('Topics covered:', marginL, 68);
    var y = 75;
    topicLabels.sort().forEach(function (t) {
      var lines = doc.splitTextToSize('•  ' + t, maxW);
      doc.text(lines, marginL, y);
      y += lines.length * 5.2;
    });

    y = Math.max(y + 10, 120);
    doc.setDrawColor(210, 216, 228);
    doc.setFontSize(10.5);
    doc.setTextColor(90, 102, 122);
    doc.text('Name: ____________________________', marginL, y);
    doc.text('Date: ____________________________', marginL, y + 14);
    doc.text('Time allowed: ____________________', marginL, y + 28);

    footer(doc, pageW, pageH, 1);

    var pageNum = 1;
    var failed = 0;

    function next(i) {
      if (i >= questions.length) return finish();
      var pct = 4 + Math.round((i / questions.length) * 92);
      setProgress(pct, 'Adding question ' + (i + 1) + ' of ' + questions.length + '…');
      var item = questions[i];
      loadImageAsset(item.src).then(function (asset) {
        doc.addPage();
        pageNum++;
        addWatermark(doc, pageW, logoDataUrl);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(90, 102, 122);
        var caption = subjectLabel(item.subject) + ' · ' + levelLabel(item.level) + ' · ' + item.topicLabel + ' · ' + item.year + (item.caption ? ' · ' + item.caption : '');
        doc.text(doc.splitTextToSize(caption, maxW), marginL, 17);
        doc.setTextColor(30, 41, 59);

        var aspect = asset.w / asset.h;
        var w = maxW, h = w / aspect;
        if (h > maxH) { h = maxH; w = h * aspect; }
        var x = marginL + (maxW - w) / 2;
        var imgY = marginTop;
        doc.addImage(asset.dataUrl, 'PNG', x, imgY, w, h, undefined, 'FAST');

        footer(doc, pageW, pageH, pageNum);
      }).catch(function () {
        failed++;
      }).finally(function () {
        next(i + 1);
      });
    }

    function finish() {
      setProgress(100, 'Finishing up…');
      var filename = 'examindex-test-' + subject + '-' + (levelSel === 'all' ? 'mixed' : levelSel) + '-' + Date.now() + '.pdf';
      setTimeout(function () {
        doc.save(filename);
        var wrap = document.getElementById('gt-progress');
        var label = document.getElementById('gt-progress-text');
        label.textContent = failed
          ? 'Downloaded with ' + (questions.length - failed) + ' of ' + questions.length + ' questions (' + failed + ' image' + (failed === 1 ? '' : 's') + ' could not be loaded).'
          : 'Downloaded ' + filename;
        wrap.hidden = false;
        btn.disabled = false;
      }, 150);
    }

    next(0);
    }); // end loadLogoDataUrl().then
  }

  function loadData() {
    return Promise.all([
      fetch('data/topics.json').then(function (r) { return r.json(); }),
      fetch('data/topic-images-manifest.json').then(function (r) { return r.json(); })
    ]).then(function (res) {
      topicsData = res[0];
      var manifest = res[1];
      manifest.forEach(function (item) {
        var key = item.subject + '|' + item.level + '|' + item.paper + '|' + item.topic;
        countByKey[key] = (countByKey[key] || 0) + 1;
        (manifestByKey[key] = manifestByKey[key] || []).push(item);
        if (dataMinYear === null || item.year < dataMinYear) dataMinYear = item.year;
        if (dataMaxYear === null || item.year > dataMaxYear) dataMaxYear = item.year;
      });
      setUpYearSlider();
      renderList();
    }).catch(function () {
      topicsData = {};
      document.getElementById('gt-list').innerHTML = '<div class="bd-empty"><strong>Could not load the topic index</strong>Try refreshing the page.</div>';
      document.getElementById('gt-count').textContent = '';
    });
  }

  // Dual-handle year-range slider (shared implementation in js/dual-slider.js,
  // the same one used on the Batch download page). Bounds come from the real
  // manifest data rather than being hard-coded, and both handles are
  // independently pointer-capture-driven, so dragging either one always works
  // no matter how close together they get.
  function setUpYearSlider() {
    if (dataMinYear === null || dataMaxYear === null) return;
    // Always reach the current exam year even if the question-image manifest
    // hasn't caught up yet — a topic with nothing there yet is just skipped
    // (see allocateEvenly), not treated as an error.
    var sliderMax = Math.max(dataMaxYear, 2026);
    document.getElementById('gt-tick-min').textContent = dataMinYear;
    document.getElementById('gt-tick-max').textContent = sliderMax;
    slider = createDualSlider({
      wrapId: 'gt-slider-wrap', minHandleId: 'gt-handle-min', maxHandleId: 'gt-handle-max',
      fillId: 'gt-slider-fill', bubbleMinId: 'gt-bubble-min', bubbleMaxId: 'gt-bubble-max',
      displayId: 'gt-year-range-display', min: dataMinYear, max: sliderMax,
      onChange: function () { renderList(); }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('gt-list')) return;
    loadData();
    document.getElementById('gt-subject').addEventListener('change', renderList);
    document.getElementById('gt-level').addEventListener('change', renderList);
    document.getElementById('gt-select-all').addEventListener('click', selectAllVisible);
    document.getElementById('gt-clear').addEventListener('click', clearSelection);
    document.getElementById('gt-generate-btn').addEventListener('click', generate);

    var countSelect = document.getElementById('gt-question-count');
    var customInput = document.getElementById('gt-question-count-custom');
    countSelect.addEventListener('change', function () {
      var isCustom = countSelect.value === 'custom';
      customInput.hidden = !isCustom;
      if (isCustom) customInput.focus();
      updateGenerateButton();
    });
    customInput.addEventListener('input', updateGenerateButton);
  });
})();
