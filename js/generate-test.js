// Generate Test — pick a subject, level and topics; build a printable,
// watermarked PDF worksheet from real past-paper question images.
(function () {
  var topicsData = null;    // data/topics.json
  var countByKey = {};      // "subject|level|paper|topic" -> image count
  var manifestByKey = {};   // "subject|level|paper|topic" -> [images]
  var selected = new Set(); // selected topic keys

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

  function relevantTopics() {
    var subject = currentSubject();
    var level = currentLevel();
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
            count: countByKey[key] || 0
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
    var totalImages = 0;
    selected.forEach(function (k) { totalImages += (countByKey[k] || 0); });
    btn.disabled = selected.size === 0;
    label.textContent = selected.size
      ? 'Generate PDF · ' + totalImages + ' question' + (totalImages === 1 ? '' : 's') + ' available'
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

  function buildQuestionSet() {
    var pool = [];
    selected.forEach(function (key) {
      (manifestByKey[key] || []).forEach(function (img) { pool.push(img); });
    });

    var order = document.getElementById('gt-order').value;
    if (order === 'year-desc') pool.sort(function (a, b) { return b.year - a.year; });
    else if (order === 'year-asc') pool.sort(function (a, b) { return a.year - b.year; });
    else shuffle(pool);

    var countSel = document.getElementById('gt-question-count').value;
    if (countSel !== 'all') {
      var n = parseInt(countSel, 10);
      pool = pool.slice(0, n);
    }
    return pool;
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

  function setProgress(pct, text) {
    var wrap = document.getElementById('gt-progress');
    var fill = document.getElementById('gt-progress-fill');
    var label = document.getElementById('gt-progress-text');
    wrap.hidden = false;
    fill.style.width = pct + '%';
    label.textContent = text;
  }

  function addWatermark(doc, pageW) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(178, 188, 205);
    doc.text('examindex', 15, 10);
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
    var topicLabels = [];
    selected.forEach(function (key) {
      var parts = key.split('|');
      var found = (manifestByKey[key] || [])[0];
      topicLabels.push((found ? found.topicLabel : parts[3]) + ' (' + levelLabel(parts[1]) + ')');
    });

    setProgress(2, 'Preparing your test…');

    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4' });
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();
    var marginL = 15, marginTop = 22, marginBottom = 16;
    var maxW = pageW - marginL * 2;
    var maxH = pageH - marginTop - marginBottom;

    // Cover page
    addWatermark(doc, pageW);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(20, 28, 45);
    doc.text('examindex practice set', marginL, 40);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 72, 94);
    doc.text(subjectLabel(subject) + ' · ' + (levelSel === 'all' ? 'Mixed levels' : levelLabel(levelSel)), marginL, 50);
    doc.setFontSize(10);
    doc.setTextColor(110, 122, 140);
    doc.text(questions.length + ' question' + (questions.length === 1 ? '' : 's') + ' · generated ' + new Date().toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' }), marginL, 57);

    doc.setFontSize(10.5);
    doc.setTextColor(80, 92, 112);
    doc.text('Topics covered:', marginL, 70);
    var y = 77;
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
        addWatermark(doc, pageW);

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
      });
      renderList();
    }).catch(function () {
      topicsData = {};
      document.getElementById('gt-list').innerHTML = '<div class="bd-empty"><strong>Could not load the topic index</strong>Try refreshing the page.</div>';
      document.getElementById('gt-count').textContent = '';
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
  });
})();
