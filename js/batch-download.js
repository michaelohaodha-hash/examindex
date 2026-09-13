// Batch Download page — lets a visitor tick several real papers from the
// manifest and download them all at once as a single .zip file.
// Uses JSZip (loaded via CDN on batch-download.html only) to build the
// archive client-side; no backend involved.

(function () {
  var manifest = [];
  var selected = new Set();

  function currentFilters() {
    return {
      subject: document.getElementById('bd-subject').value,
      level: document.getElementById('bd-level').value,
      type: document.getElementById('bd-type').value,
    };
  }

  function filteredManifest() {
    var f = currentFilters();
    return manifest.filter(function (item) {
      if (f.subject !== 'all' && item.subject !== f.subject) return false;
      if (f.level !== 'all' && item.level !== f.level) return false;
      if (f.type !== 'all' && item.type !== f.type) return false;
      return true;
    });
  }

  function updateDownloadButton() {
    var btn = document.getElementById('bd-download-btn');
    btn.textContent = 'Download selected (' + selected.size + ')';
    btn.disabled = selected.size === 0;
  }

  function renderList() {
    var container = document.getElementById('bd-list');

    if (manifest.length === 0) {
      container.innerHTML =
        '<div class="empty-state"><strong>No papers filed yet</strong>' +
        'Papers will appear here as they\u2019re added to the archive.</div>';
      updateDownloadButton();
      return;
    }

    var items = filteredManifest();

    if (items.length === 0) {
      container.innerHTML =
        '<div class="empty-state"><strong>No papers match these filters</strong>' +
        'Try a different subject, level or type.</div>';
      updateDownloadButton();
      return;
    }

    container.innerHTML = items.map(function (item) {
      var checked = selected.has(item.path) ? ' checked' : '';
      return (
        '<label class="bd-item">' +
          '<input type="checkbox" value="' + item.path + '"' + checked + '>' +
          '<span>' + item.label + '</span>' +
        '</label>'
      );
    }).join('');

    Array.prototype.forEach.call(container.querySelectorAll('input[type="checkbox"]'), function (cb) {
      cb.addEventListener('change', function () {
        if (this.checked) {
          selected.add(this.value);
        } else {
          selected.delete(this.value);
        }
        updateDownloadButton();
      });
    });
  }

  function selectAllVisible() {
    filteredManifest().forEach(function (item) { selected.add(item.path); });
    renderList();
    updateDownloadButton();
  }

  function clearSelection() {
    selected.clear();
    renderList();
    updateDownloadButton();
  }

  function loadManifest() {
    fetch('data/papers-manifest.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        manifest = data;
        renderList();
      })
      .catch(function () {
        manifest = [];
        renderList();
      });
  }

  function downloadSelected() {
    if (selected.size === 0) return;

    var status = document.getElementById('bd-status');
    var btn = document.getElementById('bd-download-btn');
    btn.disabled = true;

    var zip = new JSZip();
    var paths = Array.from(selected);
    var failed = [];
    var done = 0;

    function next() {
      if (done >= paths.length) {
        finish();
        return;
      }
      var path = paths[done];
      status.textContent = 'Fetching ' + (done + 1) + ' of ' + paths.length + '\u2026';

      fetch(path)
        .then(function (res) {
          if (!res.ok) throw new Error('not found');
          return res.blob();
        })
        .then(function (blob) {
          var filename = path.split('/').pop();
          zip.file(filename, blob);
        })
        .catch(function () {
          failed.push(path);
        })
        .finally(function () {
          done++;
          next();
        });
    }

    function finish() {
      var fileCount = Object.keys(zip.files).length;

      if (fileCount === 0) {
        status.textContent = 'None of the selected files could be found.';
        btn.disabled = false;
        return;
      }

      status.textContent = 'Building zip file\u2026';

      zip.generateAsync({ type: 'blob' }).then(function (content) {
        var url = URL.createObjectURL(content);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'examindex-papers.zip';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        if (failed.length > 0) {
          status.textContent =
            'Downloaded ' + (paths.length - failed.length) + ' of ' + paths.length +
            ' files (' + failed.length + ' could not be found).';
        } else {
          status.textContent =
            'Downloaded ' + paths.length + ' file' + (paths.length === 1 ? '' : 's') +
            ' as examindex-papers.zip.';
        }
        btn.disabled = false;
      });
    }

    next();
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadManifest();
    document.getElementById('bd-subject').addEventListener('change', renderList);
    document.getElementById('bd-level').addEventListener('change', renderList);
    document.getElementById('bd-type').addEventListener('change', renderList);
    document.getElementById('bd-select-all').addEventListener('click', selectAllVisible);
    document.getElementById('bd-clear').addEventListener('click', clearSelection);
    document.getElementById('bd-download-btn').addEventListener('click', downloadSelected);
  });
})();
