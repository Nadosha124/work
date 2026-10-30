/* render.js — قراءة ملف إكسيل (أي ملف) وعرض كل شيت كصفحة A4 HTML */
(function (g) {
  'use strict';
  var X = g.XlsxCore;
  var byLocal = X.byLocal, firstLocal = X.firstLocal;
  var FONT = "Arial, 'Noto Sans Arabic Bundled', 'Liberation Sans', sans-serif";
  var PX_A4_W = 793.7, PX_A4_H = 1122.5;
  var EMU = 9525;

  /* ---------- ألوان ---------- */
  var INDEXED = ['000000', 'FFFFFF', 'FF0000', '00FF00', '0000FF', 'FFFF00', 'FF00FF', '00FFFF'];
  function hex2rgb(h) { return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function applyTint(hex, tint) {
    if (!tint) return hex;
    var c = hex2rgb(hex).map(function (v) {
      return Math.round(tint < 0 ? v * (1 + tint) : v * (1 - tint) + 255 * tint);
    });
    return c.map(function (v) { return ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2); }).join('');
  }
  function colorOf(el, theme) {
    if (!el) return null;
    var rgb = el.getAttribute('rgb'), th = el.getAttribute('theme'), ix = el.getAttribute('indexed');
    var tint = parseFloat(el.getAttribute('tint') || '0');
    if (rgb) return '#' + applyTint(rgb.slice(-6), tint);
    if (th != null) { var map = [1, 0, 3, 2, 4, 5, 6, 7, 8, 9], t = theme[map[parseInt(th, 10)]]; return t ? '#' + applyTint(t, tint) : null; }
    if (ix != null) { var i = parseInt(ix, 10); return '#' + (INDEXED[i] || '000000'); }
    return null;
  }

  /* ---------- أرقام ---------- */
  function fmtNumber(v, code, id) {
    if (isNaN(v)) return String(v);
    var builtin = { 1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%' };
    if (!code && builtin[id]) code = builtin[id];
    if (!code || code === 'General') {
      var s = String(Math.round(v * 1e10) / 1e10);
      return s;
    }
    var main = code.split(';')[0].replace(/\[[^\]]*\]/g, '').replace(/\\(.)/g, '$1').replace(/"/g, '');
    if (/^0+$/.test(main)) { var z = String(Math.round(v)); while (z.length < main.length) z = '0' + z; return z; }
    if (/[dmy]/i.test(main) && !/[#0]/.test(main)) {
      var d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
      return d.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
    }
    var pct = /%$/.test(main), m = /0\.(0+)/.exec(main), dec = m ? m[1].length : 0, val = pct ? v * 100 : v;
    var out = val.toFixed(dec);
    if (/#,##/.test(main)) out = out.replace(/\B(?=(\d{3})+(?!\d))/g, ',').replace(/(\.\d*)/, function (x) { return x; });
    return out + (pct ? '%' : '');
  }

  /* ---------- قراءة الملف ---------- */
  async function readModel(bytes) {
    var zip = await JSZip.loadAsync(bytes);
    var rootRels = X.parseXml(await X.readText(zip, '_rels/.rels'));
    var wbRel = byLocal(rootRels, 'Relationship').filter(function (r) { return /officeDocument$/.test(r.getAttribute('Type')); })[0];
    var wbPath = wbRel ? X.resolve('x', wbRel.getAttribute('Target')) : 'xl/workbook.xml';
    var wbDoc = X.parseXml(await X.readText(zip, wbPath));
    var wbRels = X.relsMap(await X.readRelsDoc(zip, wbPath), wbPath);

    var theme = [];
    var themeTxt = await X.readText(zip, 'xl/theme/theme1.xml');
    if (themeTxt) {
      var cs = firstLocal(X.parseXml(themeTxt), 'clrScheme');
      if (cs) Array.prototype.slice.call(cs.children).slice(0, 12).forEach(function (e) {
        var c = e.firstElementChild;
        theme.push((c.getAttribute('val') && c.localName === 'srgbClr' ? c.getAttribute('val') : c.getAttribute('lastClr') || '000000').toUpperCase());
      });
    }
    var sst = [];
    var sstTxt = await X.readText(zip, 'xl/sharedStrings.xml');
    if (sstTxt) byLocal(X.parseXml(sstTxt), 'si').forEach(function (si) {
      sst.push(byLocal(si, 't').filter(function (t) { return !t.parentNode || t.parentNode.localName !== 'rPh'; }).map(function (t) { return t.textContent; }).join(''));
    });

    // styles
    var sd = X.parseXml(await X.readText(zip, 'xl/styles.xml'));
    var numFmts = {};
    byLocal(sd, 'numFmt').forEach(function (n) { numFmts[n.getAttribute('numFmtId')] = n.getAttribute('formatCode'); });
    var fonts = byLocal(firstLocal(sd, 'fonts'), 'font').map(function (f) {
      var sz = firstLocal(f, 'sz'), nm = firstLocal(f, 'name'), u = firstLocal(f, 'u');
      return { sz: sz ? parseFloat(sz.getAttribute('val')) : 11, b: !!firstLocal(f, 'b') && firstLocal(f, 'b').getAttribute('val') !== '0',
        i: !!firstLocal(f, 'i'), u: !!u, name: nm ? nm.getAttribute('val') : 'Arial', color: colorOf(firstLocal(f, 'color'), theme) };
    });
    var fills = byLocal(firstLocal(sd, 'fills'), 'fill').map(function (f) {
      var p = firstLocal(f, 'patternFill');
      if (!p || p.getAttribute('patternType') !== 'solid') return null;
      return colorOf(firstLocal(p, 'fgColor'), theme);
    });
    var borders = byLocal(firstLocal(sd, 'borders'), 'border').map(function (b) {
      var o = {};
      ['left', 'right', 'top', 'bottom'].forEach(function (side) {
        var e = firstLocal(b, side);
        if (e && e.getAttribute('style')) o[side] = { style: e.getAttribute('style'), color: colorOf(firstLocal(e, 'color'), theme) || '#000' };
      });
      return o;
    });
    var xfs = Array.prototype.slice.call(firstLocal(sd, 'cellXfs').children).map(function (x) {
      var al = firstLocal(x, 'alignment');
      return {
        numFmtId: parseInt(x.getAttribute('numFmtId') || '0', 10), font: fonts[parseInt(x.getAttribute('fontId') || '0', 10)] || fonts[0],
        fill: fills[parseInt(x.getAttribute('fillId') || '0', 10)] || null, border: borders[parseInt(x.getAttribute('borderId') || '0', 10)] || {},
        h: al ? al.getAttribute('horizontal') : null, v: al ? al.getAttribute('vertical') : null,
        wrap: !!(al && al.getAttribute('wrapText') === '1'), shrink: !!(al && al.getAttribute('shrinkToFit') === '1'),
        indent: al ? parseInt(al.getAttribute('indent') || '0', 10) : 0, ro: al ? parseInt(al.getAttribute('readingOrder') || '0', 10) : 0
      };
    });
    var normalFont = fonts[0] || { sz: 11, name: 'Arial' };

    // الشيتات
    var sheets = [];
    var sheetEls = byLocal(firstLocal(wbDoc, 'sheets'), 'sheet');
    for (var si = 0; si < sheetEls.length; si++) {
      var el = sheetEls[si];
      var state = el.getAttribute('state');
      if (state === 'hidden' || state === 'veryHidden') continue;
      var path = wbRels[el.getAttributeNS(X.NS_R, 'id')].target;
      var doc = X.parseXml(await X.readText(zip, path));
      var sh = { name: el.getAttribute('name'), cells: {}, rows: {}, colW: {}, merges: [], images: [], maxR: 1, maxC: 1 };
      var fmt = firstLocal(doc, 'sheetFormatPr');
      sh.defColW = fmt && fmt.getAttribute('defaultColWidth') ? parseFloat(fmt.getAttribute('defaultColWidth')) : (fmt && fmt.getAttribute('baseColWidth') ? parseFloat(fmt.getAttribute('baseColWidth')) + 0.71 : 8.43);
      sh.defRowH = fmt && fmt.getAttribute('defaultRowHeight') ? parseFloat(fmt.getAttribute('defaultRowHeight')) : 15;
      var colsEl = firstLocal(doc, 'cols');
      if (colsEl) byLocal(colsEl, 'col').forEach(function (c) {
        var mn = parseInt(c.getAttribute('min'), 10), mx = Math.min(parseInt(c.getAttribute('max'), 10), 300);
        for (var i = mn; i <= mx; i++) sh.colW[i] = { w: parseFloat(c.getAttribute('width')), hidden: c.getAttribute('hidden') === '1' };
      });
      byLocal(firstLocal(doc, 'sheetData'), 'row').forEach(function (r) {
        var rn = parseInt(r.getAttribute('r'), 10);
        sh.rows[rn] = { ht: r.getAttribute('ht') ? parseFloat(r.getAttribute('ht')) : null, hidden: r.getAttribute('hidden') === '1' };
        byLocal(r, 'c').forEach(function (c) {
          var ref = X.parseRef(c.getAttribute('r')), t = c.getAttribute('t'), v = firstLocal(c, 'v'), val = null, isNum = false;
          if (t === 's' && v) val = sst[parseInt(v.textContent, 10)];
          else if (t === 'inlineStr') val = byLocal(c, 't').map(function (x) { return x.textContent; }).join('');
          else if (t === 'str' && v) val = v.textContent;
          else if (t === 'b' && v) val = v.textContent === '1' ? 'TRUE' : 'FALSE';
          else if (t === 'e' && v) val = v.textContent;
          else if (v && v.textContent !== '') { val = parseFloat(v.textContent); isNum = true; }
          sh.cells[ref.r + ',' + ref.c] = { s: parseInt(c.getAttribute('s') || '0', 10), v: val, num: isNum };
          sh.maxR = Math.max(sh.maxR, rn); sh.maxC = Math.max(sh.maxC, ref.c);
        });
      });
      byLocal(doc, 'mergeCell').forEach(function (m) {
        var p = m.getAttribute('ref').split(':'), a = X.parseRef(p[0]), b = X.parseRef(p[1] || p[0]);
        sh.merges.push({ c1: a.c, r1: a.r, c2: b.c, r2: b.r });
        sh.maxR = Math.max(sh.maxR, b.r); sh.maxC = Math.max(sh.maxC, b.c);
      });
      var ps = firstLocal(doc, 'pageSetup'), pm = firstLocal(doc, 'pageMargins'), pp = firstLocal(doc, 'pageSetUpPr'), po = firstLocal(doc, 'printOptions'), sv = firstLocal(doc, 'sheetView');
      sh.page = {
        landscape: ps && ps.getAttribute('orientation') === 'landscape', scale: ps && ps.getAttribute('scale') ? parseInt(ps.getAttribute('scale'), 10) : 100,
        fit: !!(pp && pp.getAttribute('fitToPage') === '1'), hcenter: !!(po && po.getAttribute('horizontalCentered') === '1'),
        m: pm ? { l: parseFloat(pm.getAttribute('left')), r: parseFloat(pm.getAttribute('right')), t: parseFloat(pm.getAttribute('top')), b: parseFloat(pm.getAttribute('bottom')) } : { l: 0.7, r: 0.7, t: 0.75, b: 0.75 },
        rtl: !!(sv && sv.getAttribute('rightToLeft') === '1')
      };
      // الصور
      var relsDoc = await X.readRelsDoc(zip, path), rels = X.relsMap(relsDoc, path);
      var dRid = firstLocal(doc, 'drawing'); dRid = dRid && dRid.getAttributeNS(X.NS_R, 'id');
      if (dRid && rels[dRid]) {
        var dp = rels[dRid].target, dDoc = X.parseXml(await X.readText(zip, dp)), dRels = X.relsMap(await X.readRelsDoc(zip, dp), dp);
        var anchors = byLocal(dDoc, 'twoCellAnchor').concat(byLocal(dDoc, 'oneCellAnchor'), byLocal(dDoc, 'absoluteAnchor'));
        for (var ai = 0; ai < anchors.length; ai++) {
          var a = anchors[ai], blip = firstLocal(a, 'blip'); if (!blip) continue;
          var rid = blip.getAttributeNS(X.NS_R, 'embed'), tgt = dRels[rid] && dRels[rid].target; if (!tgt || !zip.file(tgt)) continue;
          var ext = tgt.split('.').pop().toLowerCase(), mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' }[ext] || 'image/png';
          var blob = new Blob([await zip.file(tgt).async('uint8array')], { type: mime });
          var rd = function (e) { return e ? { col: parseInt(firstLocal(e, 'col').textContent, 10), colOff: parseInt(firstLocal(e, 'colOff').textContent, 10), row: parseInt(firstLocal(e, 'row').textContent, 10), rowOff: parseInt(firstLocal(e, 'rowOff').textContent, 10) } : null; };
          var im = { kind: a.localName, url: URL.createObjectURL(blob), from: rd(firstLocal(a, 'from')), to: rd(firstLocal(a, 'to')) };
          var ex = Array.prototype.slice.call(a.children).filter(function (c) { return c.localName === 'ext'; })[0];
          if (ex) { im.cx = parseInt(ex.getAttribute('cx'), 10); im.cy = parseInt(ex.getAttribute('cy'), 10); }
          var pos = firstLocal(a, 'pos'); if (pos) { im.x = parseInt(pos.getAttribute('x'), 10); im.y = parseInt(pos.getAttribute('y'), 10); }
          sh.images.push(im);
          if (im.to) { sh.maxR = Math.max(sh.maxR, im.to.row + (im.to.rowOff ? 1 : 0)); sh.maxC = Math.max(sh.maxC, im.to.col + (im.to.colOff ? 1 : 0)); }
        }
      }
      sheets.push(sh);
    }
    return { sheets: sheets, xfs: xfs, numFmts: numFmts, normalFont: normalFont };
  }

  function revokeModel(model) { model.sheets.forEach(function (s) { s.images.forEach(function (i) { URL.revokeObjectURL(i.url); }); }); }

  /* ---------- رسم ---------- */
  var BSTYLE = { thin: '1px solid', hair: '1px dotted', dotted: '1px dotted', dashed: '1px dashed', mediumDashed: '2px dashed', medium: '2px solid', thick: '3px solid', double: '3px double' };
  function borderCss(b) { if (!b) return 'none'; return (BSTYLE[b.style] || '1px solid') + ' ' + b.color; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function colPxOf(sh, c) {
    var cw = sh.colW[c]; if (cw && cw.hidden) return 0;
    var w = cw ? cw.w : sh.defColW; return Math.floor(w * 7 + 5);
  }
  function rowPxOf(sh, r) {
    var rw = sh.rows[r]; if (rw && rw.hidden) return 0;
    return (rw && rw.ht != null ? rw.ht : sh.defRowH) * 96 / 72;
  }

  function buildTable(sh, model) {
    var covered = {}, mergeAt = {};
    sh.merges.forEach(function (m) {
      mergeAt[m.r1 + ',' + m.c1] = m;
      for (var r = m.r1; r <= m.r2; r++) for (var c = m.c1; c <= m.c2; c++) if (r !== m.r1 || c !== m.c1) covered[r + ',' + c] = true;
    });
    var cell = function (r, c) { return sh.cells[r + ',' + c]; };
    var xfOf = function (r, c) { var x = cell(r, c); return x ? model.xfs[x.s] || model.xfs[0] : model.xfs[0]; };
    var tw = 0, c, r, html = '<colgroup>';
    for (c = 1; c <= sh.maxC; c++) { var w = colPxOf(sh, c); tw += w; html += '<col style="width:' + w + 'px">'; }
    html += '</colgroup>';
    for (r = 1; r <= sh.maxR; r++) {
      var rp = rowPxOf(sh, r);
      if (rp === 0) continue;
      html += '<tr style="height:' + rp.toFixed(2) + 'px">';
      for (c = 1; c <= sh.maxC; c++) {
        if (covered[r + ',' + c] || colPxOf(sh, c) === 0) continue;
        var m = mergeAt[r + ',' + c], cl = cell(r, c), xf = xfOf(r, c);
        var r2 = m ? m.r2 : r, c2 = m ? m.c2 : c;
        // الحدود: كل خط بيترسم مرة واحدة (فوق/شمال بس) من الخانة نفسها أو الجار، وأطراف الجدول من الخانة نفسها
        var anyBorder = function (rows, cols, side) {
          for (var rr = rows[0]; rr <= rows[1]; rr++) for (var cc = cols[0]; cc <= cols[1]; cc++) {
            if (rr < 1 || cc < 1) continue;
            var b = xfOf(rr, cc).border[side]; if (b) return b;
          }
          return null;
        };
        var bTop = anyBorder([r, r], [c, c2], 'top') || anyBorder([r - 1, r - 1], [c, c2], 'bottom');
        var bLeft = anyBorder([r, r2], [c, c], 'left') || anyBorder([r, r2], [c - 1, c - 1], 'right');
        var bRight = (c2 >= sh.maxC) ? anyBorder([r, r2], [c2, c2], 'right') : null;
        var bBottom = (r2 >= sh.maxR) ? anyBorder([r2, r2], [c, c2], 'bottom') : null;
        var f = xf.font, ro = xf.ro, v = cl ? cl.v : null, txt = '';
        if (v != null) txt = (cl.num) ? fmtNumber(v, model.numFmts[xf.numFmtId], xf.numFmtId) : String(v);
        if (!xf.wrap) txt = txt.replace(/\s+$/, '');
        var dir = ro === 2 ? 'rtl' : (ro === 1 ? 'ltr' : (/[\u0590-\u08ff]/.test(txt) ? 'rtl' : 'ltr'));
        var h = xf.h;
        if (!h || h === 'general') h = (cl && cl.num) ? 'right' : (dir === 'rtl' ? 'right' : 'left');
        if (h === 'centerContinuous') h = 'center';
        var va = xf.v === 'top' ? 'top' : (xf.v === 'center' ? 'middle' : (xf.v === 'bottom' || !xf.v ? 'bottom' : 'middle'));
        var st = 'font:' + (f.i ? 'italic ' : '') + (f.b ? 'bold ' : '') + (f.sz * 96 / 72).toFixed(2) + 'px ' + FONT + ';' +
          'color:' + (f.color || '#000') + ';' + (xf.fill ? 'background:' + xf.fill + ';' : '') + (f.u ? 'text-decoration:underline;' : '') +
          'text-align:' + h + ';vertical-align:' + va + ';direction:' + dir + ';' +
          'border-top:' + borderCss(bTop) + ';border-left:' + borderCss(bLeft) + ';border-right:' + borderCss(bRight) + ';border-bottom:' + borderCss(bBottom) + ';' +
          'white-space:' + (xf.wrap ? 'pre-wrap' : 'pre') + ';' + (xf.indent ? 'padding-' + (h === 'right' ? 'right' : 'left') + ':' + (xf.indent * 9) + 'px;' : '');
        html += '<td' + (m && m.c2 > m.c1 ? ' colspan="' + (m.c2 - m.c1 + 1) + '"' : '') + (m && m.r2 > m.r1 ? ' rowspan="' + (m.r2 - m.r1 + 1) + '"' : '') +
          (xf.wrap ? '' : ' data-nw="1"') + ' data-r="' + r + '" style="' + st + '">' + (txt ? '<div class="x">' + esc(txt) + '</div>' : '') + '</td>';
      }
      html += '</tr>';
    }
    return { html: '<table class="xs" style="width:' + tw + 'px">' + html + '</table>', width: tw };
  }

  function placeImages(sh, wrap, table) {
    var left = [0], top = {}, c;
    for (c = 1; c <= sh.maxC + 60; c++) left[c] = (left[c - 1] || 0) + colPxOf(sh, c);   // left[c] = بداية العمود c+1 (index صفر)
    var trs = table.querySelectorAll('tr'), idx = 0, rr;
    var tops = {};
    for (rr = 1; rr <= sh.maxR; rr++) {
      if (rowPxOf(sh, rr) === 0) { tops[rr - 1] = idx ? tops[rr - 2] : 0; continue; }
      tops[rr - 1] = trs[idx] ? trs[idx].offsetTop : 0; idx++;
    }
    var lastTop = trs.length ? trs[trs.length - 1].offsetTop + trs[trs.length - 1].offsetHeight : 0;
    var rowTop = function (i) { return tops[i] != null ? tops[i] : lastTop + (i - sh.maxR) * (sh.defRowH * 96 / 72); };
    sh.images.forEach(function (im) {
      var x, y, w, h;
      if (im.kind === 'absoluteAnchor') { x = im.x / EMU; y = im.y / EMU; w = im.cx / EMU; h = im.cy / EMU; }
      else {
        x = left[im.from.col] + im.from.colOff / EMU; y = rowTop(im.from.row) + im.from.rowOff / EMU;
        if (im.kind === 'oneCellAnchor' || !im.to) { w = im.cx / EMU; h = im.cy / EMU; }
        else { w = left[im.to.col] + im.to.colOff / EMU - x; y = y; h = rowTop(im.to.row) + im.to.rowOff / EMU - y; }
      }
      var img = document.createElement('img');
      img.src = im.url; img.className = 'xi'; img.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px';
      wrap.appendChild(img);
    });
  }

  function waitImages(root) {
    var imgs = Array.prototype.slice.call(root.querySelectorAll('img'));
    return Promise.all(imgs.map(function (i) { return i.complete ? Promise.resolve() : new Promise(function (res) { i.onload = i.onerror = res; }); }));
  }

  /**
   * بيرسم كل الشيتات كصفحات A4 جوه container (لازم يكون ظاهر في الـ DOM حتى لو برا الشاشة)
   * بترجّع [{name, el, scale}]
   */
  async function renderPages(model, container) {
    if (document.fonts && document.fonts.load) {
      try { await Promise.all([document.fonts.load('400 16px "Noto Sans Arabic Bundled"'), document.fonts.load('700 16px "Noto Sans Arabic Bundled"')]); } catch (e) { /* ignore */ }
    }
    var out = [];
    for (var i = 0; i < model.sheets.length; i++) {
      var sh = model.sheets[i];
      var W = sh.page.landscape ? PX_A4_H : PX_A4_W, H = sh.page.landscape ? PX_A4_W : PX_A4_H;
      var page = document.createElement('div');
      page.className = 'xpage' + (sh.page.landscape ? ' land' : '');
      page.style.cssText = 'width:' + (sh.page.landscape ? '297mm' : '210mm') + ';height:' + (sh.page.landscape ? '210mm' : '297mm');
      page.dataset.sheet = sh.name;
      var wrap = document.createElement('div'); wrap.className = 'xwrap';
      var t = buildTable(sh, model);
      wrap.innerHTML = t.html;
      page.appendChild(wrap); container.appendChild(page);
      var table = wrap.firstChild;
      // تصغير النص الواسع (shrink to fit)
      Array.prototype.forEach.call(table.querySelectorAll('td[data-nw] .x'), function (d) {
        var k = d.clientWidth / (d.scrollWidth || 1);
        if (k < 0.995) d.style.fontSize = (parseFloat(getComputedStyle(d).fontSize) * k * 0.97).toFixed(2) + 'px';
      });
      placeImages(sh, wrap, table);
      await waitImages(wrap);
      var cw = table.offsetWidth, ch = table.offsetHeight;
      var pm = sh.page.m, mL = pm.l * 96, mR = pm.r * 96, mT = pm.t * 96, mB = pm.b * 96;
      var aw = W - mL - mR, ah = H - mT - mB;
      var base = sh.page.fit ? 1 : Math.min(1, (sh.page.scale || 100) / 100);
      var s = Math.min(base, aw / cw, ah / ch);
      var x = mL + (aw - cw * s) / 2, y = mT;
      wrap.style.transform = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px) scale(' + s.toFixed(5) + ')';
      out.push({ name: sh.name, el: page, scale: s, landscape: sh.page.landscape });
    }
    return out;
  }

  g.Render = { readModel: readModel, renderPages: renderPages, revokeModel: revokeModel };
})(typeof window !== 'undefined' ? window : globalThis);
