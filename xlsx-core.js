/* xlsx-core.js — تعبئة قالب الإكسيل (نسخ الشيتات + كتابة الأوردرات + ضبط الارتفاعات) */
(function (g) {
  'use strict';

  var NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  var NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  var NS_PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
  var NS_CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
  var NS_XML = 'http://www.w3.org/XML/1998/namespace';
  var T_SHEET = 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';
  var T_DRAW = 'application/vnd.openxmlformats-officedocument.drawing+xml';
  var REL_DRAWING = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing';
  var DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

  var parser = new DOMParser();
  var serializer = new XMLSerializer();
  function parseXml(s) { return parser.parseFromString(s, 'application/xml'); }
  function toXml(doc) { return DECL + serializer.serializeToString(doc.documentElement); }
  function byLocal(root, name) { return Array.prototype.slice.call(root.getElementsByTagNameNS('*', name)); }
  function firstLocal(root, name) { return root.getElementsByTagNameNS('*', name)[0] || null; }

  function colToNum(s) { var n = 0; for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64); return n; }
  function numToCol(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function parseRef(ref) { var m = /^([A-Z]+)(\d+)$/.exec(ref); return { c: colToNum(m[1]), r: parseInt(m[2], 10) }; }
  function mkRef(c, r) { return numToCol(c) + r; }

  function dirname(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
  function basename(p) { return p.slice(p.lastIndexOf('/') + 1); }
  function resolve(base, target) {
    if (target.charAt(0) === '/') return target.slice(1);
    var parts = dirname(base).split('/').filter(Boolean);
    target.split('/').forEach(function (seg) {
      if (seg === '..') parts.pop(); else if (seg !== '.' && seg !== '') parts.push(seg);
    });
    return parts.join('/');
  }
  function relsPath(part) { return dirname(part) + (dirname(part) ? '/' : '') + '_rels/' + basename(part) + '.rels'; }

  function readText(zip, p) { var f = zip.file(p); return f ? f.async('string') : Promise.resolve(null); }

  async function readRelsDoc(zip, part) {
    var t = await readText(zip, relsPath(part));
    return t ? parseXml(t) : null;
  }
  function relsMap(doc, part) {
    var out = {};
    if (!doc) return out;
    byLocal(doc, 'Relationship').forEach(function (r) {
      var mode = r.getAttribute('TargetMode');
      out[r.getAttribute('Id')] = {
        id: r.getAttribute('Id'), type: r.getAttribute('Type'),
        target: mode === 'External' ? r.getAttribute('Target') : resolve(part, r.getAttribute('Target'))
      };
    });
    return out;
  }

  /* ---------- نص عربي مطبّع للمقارنة ---------- */
  function normLabel(s) {
    return String(s || '').replace(/[\u064b-\u065f\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .replace(/[\s:：\u200b-\u200f]/g, '').toLowerCase();
  }
  var LABELS = {
    'اسمالعميل': 'name', 'المحافظه': 'gov', 'المنطقه': 'area', 'العنوانبالتفصيل': 'address',
    'تفاصيلالاوردر': 'details', 'قيمهالاوردر': 'price', 'الشحن': 'shipping', 'التليفون': 'phone',
    'الاجمالي': 'total'
  };

  /* ---------- قياس النص (عدد الأسطر) ---------- */
  var _ctx = null;
  function getCtx() {
    if (_ctx) return _ctx;
    var cv = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
    _ctx = cv ? cv.getContext('2d') : null;
    return _ctx;
  }
  var FONT_STACK = 'Arial, "Noto Sans Arabic Bundled", "Liberation Sans", sans-serif';

  function countLines(text, fontPx, bold, widthPx) {
    var ctx = getCtx();
    var lines = 0;
    String(text).split('\n').forEach(function (para) {
      if (!para.trim()) { lines += 1; return; }
      var words = para.split(/\s+/), cur = '', n = 1;
      var w = function (t) {
        return ctx ? (ctx.font = (bold ? 'bold ' : '') + fontPx + 'px ' + FONT_STACK, ctx.measureText(t).width)
          : t.length * fontPx * 0.55;
      };
      words.forEach(function (word) {
        var test = cur ? cur + ' ' + word : word;
        if (w(test) <= widthPx) { cur = test; return; }
        if (cur) { n++; cur = ''; }
        // كلمة أطول من السطر: نكسّرها حروف
        if (w(word) > widthPx) {
          var piece = '';
          for (var i = 0; i < word.length; i++) {
            if (w(piece + word[i]) > widthPx && piece) { n++; piece = ''; }
            piece += word[i];
          }
          cur = piece;
        } else cur = word;
      });
      lines += n;
    });
    return lines;
  }

  /* ---------- styles ---------- */
  function parseStyles(doc) {
    var fonts = byLocal(firstLocal(doc, 'fonts'), 'font').map(function (f) {
      var sz = firstLocal(f, 'sz'), nm = firstLocal(f, 'name');
      return { sz: sz ? parseFloat(sz.getAttribute('val')) : 11, bold: !!firstLocal(f, 'b'), name: nm ? nm.getAttribute('val') : 'Arial' };
    });
    var xfsRoot = firstLocal(doc, 'cellXfs');
    var xfs = Array.prototype.slice.call(xfsRoot.children).map(function (x) {
      var al = firstLocal(x, 'alignment');
      return { font: fonts[parseInt(x.getAttribute('fontId') || '0', 10)] || fonts[0], wrap: !!(al && al.getAttribute('wrapText') === '1') };
    });
    return { fonts: fonts, xfs: xfs };
  }

  /* ---------- سياق الشيت ---------- */
  function SheetCtx(doc, sst, styles) {
    this.doc = doc; this.sst = sst; this.styles = styles;
    this.sheetData = firstLocal(doc, 'sheetData');
    this.rows = {}; this.cells = {};
    var self = this;
    byLocal(this.sheetData, 'row').forEach(function (r) {
      self.rows[parseInt(r.getAttribute('r'), 10)] = r;
      byLocal(r, 'c').forEach(function (c) { self.cells[c.getAttribute('r')] = c; });
    });
    this.merges = byLocal(doc, 'mergeCell').map(function (m) {
      var p = m.getAttribute('ref').split(':'), a = parseRef(p[0]), b = parseRef(p[1] || p[0]);
      return { c1: a.c, r1: a.r, c2: b.c, r2: b.r };
    });
    // أعمدة
    this.colW = {};
    var fmt = firstLocal(doc, 'sheetFormatPr');
    this.defColW = fmt && fmt.getAttribute('defaultColWidth') ? parseFloat(fmt.getAttribute('defaultColWidth')) : 8.43;
    this.defRowH = fmt && fmt.getAttribute('defaultRowHeight') ? parseFloat(fmt.getAttribute('defaultRowHeight')) : 15;
    var colsEl = firstLocal(doc, 'cols');
    if (colsEl) byLocal(colsEl, 'col').forEach(function (c) {
      var mn = parseInt(c.getAttribute('min'), 10), mx = Math.min(parseInt(c.getAttribute('max'), 10), 200);
      for (var i = mn; i <= mx; i++) self.colW[i] = parseFloat(c.getAttribute('width'));
    });
  }
  SheetCtx.prototype.colPx = function (c) { var w = this.colW[c] != null ? this.colW[c] : this.defColW; return Math.floor(w * 7 + 5); };
  SheetCtx.prototype.rowPt = function (r) {
    var el = this.rows[r]; var h = el && el.getAttribute('ht');
    return h ? parseFloat(h) : this.defRowH;
  };
  SheetCtx.prototype.regionAt = function (r, c) {
    for (var i = 0; i < this.merges.length; i++) {
      var m = this.merges[i];
      if (r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2) return m;
    }
    return { c1: c, r1: r, c2: c, r2: r };
  };
  SheetCtx.prototype.ensureRow = function (r) {
    if (this.rows[r]) return this.rows[r];
    var el = this.doc.createElementNS(NS, 'row'); el.setAttribute('r', String(r));
    var before = null;
    Object.keys(this.rows).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k) { if (!before && k > r) before = this.rows[k]; }, this);
    this.sheetData.insertBefore(el, before);
    this.rows[r] = el; return el;
  };
  SheetCtx.prototype.ensureCell = function (ref) {
    if (this.cells[ref]) return this.cells[ref];
    var p = parseRef(ref), row = this.ensureRow(p.r), before = null;
    byLocal(row, 'c').forEach(function (c) { if (!before && parseRef(c.getAttribute('r')).c > p.c) before = c; });
    var el = this.doc.createElementNS(NS, 'c'); el.setAttribute('r', ref);
    row.insertBefore(el, before);
    this.cells[ref] = el; return el;
  };
  SheetCtx.prototype.cellText = function (c) {
    var t = c.getAttribute('t'), v = firstLocal(c, 'v');
    if (t === 's' && v) return this.sst[parseInt(v.textContent, 10)] || '';
    if (t === 'inlineStr') return byLocal(c, 't').map(function (x) { return x.textContent; }).join('');
    return null;
  };
  SheetCtx.prototype.setValue = function (ref, val) {
    var c = this.ensureCell(ref), hasF = !!firstLocal(c, 'f');
    if (!hasF) { while (c.firstChild) c.removeChild(c.firstChild); c.removeAttribute('t'); }
    else { byLocal(c, 'v').forEach(function (v) { c.removeChild(v); }); c.removeAttribute('t'); }
    if (val === null || val === undefined || val === '') return;
    if (typeof val === 'number') {
      var v = this.doc.createElementNS(NS, 'v'); v.textContent = String(val); c.appendChild(v);
    } else {
      c.setAttribute('t', 'inlineStr');
      var is = this.doc.createElementNS(NS, 'is'), t = this.doc.createElementNS(NS, 't');
      t.setAttributeNS(NS_XML, 'xml:space', 'preserve'); t.textContent = String(val);
      is.appendChild(t); c.appendChild(is);
    }
  };
  SheetCtx.prototype.setRowHeight = function (r, pt) {
    var row = this.ensureRow(r);
    row.setAttribute('ht', String(Math.round(pt * 100) / 100)); row.setAttribute('customHeight', '1');
  };

  /* تحليل الشيت: مين الخانات بتاعة كل فاتورة؟ */
  function analyzeSheet(ctx) {
    var labels = [];
    Object.keys(ctx.cells).forEach(function (ref) {
      var txt = ctx.cellText(ctx.cells[ref]);
      if (txt == null) return;
      var key = LABELS[normLabel(txt)];
      if (key) { var p = parseRef(ref); labels.push({ key: key, r: p.r, c: p.c }); }
    });
    var starts = labels.filter(function (l) { return l.key === 'name'; }).map(function (l) { return l.r; }).sort(function (a, b) { return a - b; });
    var blocks = starts.map(function () { return {}; });
    labels.forEach(function (l) {
      var bi = -1;
      for (var i = 0; i < starts.length; i++) if (l.r >= starts[i]) bi = i;
      if (bi < 0) return;
      var reg = ctx.regionAt(l.r, l.c - 1);       // الخانة اللي على شمال الليبل (الاتجاه من اليمين)
      if (!blocks[bi][l.key]) blocks[bi][l.key] = reg;
    });
    return { blocks: blocks, starts: starts };
  }

  var FIELD_ORDER = ['name', 'phone', 'gov', 'area', 'address', 'details'];

  var capWarn = [];
  function fitRegion(ctx, reg, text) {
    var fontPx, bold, wrap;
    var tl = ctx.cells[mkRef(reg.c1, reg.r1)];
    var si = tl ? parseInt(tl.getAttribute('s') || '0', 10) : 0;
    var xf = ctx.styles.xfs[si] || ctx.styles.xfs[0];
    fontPx = xf.font.sz * 96 / 72; bold = xf.font.bold; wrap = xf.wrap;
    var wpx = 0, c;
    for (c = reg.c1; c <= reg.c2; c++) wpx += ctx.colPx(c);
    var usable = (wpx - 10) * 0.9;                 // هامش أمان لاختلاف الخطوط
    var lines = wrap ? countLines(text, fontPx, bold, usable) : String(text).split('\n').length;
    var needPt = lines * xf.font.sz * 1.3 + 8;
    var have = 0, r;
    for (r = reg.r1; r <= reg.r2; r++) have += ctx.rowPt(r);
    if (needPt > 409 + have - ctx.rowPt(reg.r2)) capWarn.push('نص طويل جدًا في الخانة ' + mkRef(reg.c1, reg.r1) + ' — إكسيل مش بيسمح بصف أطول من 409، فممكن يتقص في ملف الإكسيل (الـ PDF سليم).');
    if (needPt > have + 0.5) {
      ctx.setRowHeight(reg.r2, Math.min(409, ctx.rowPt(reg.r2) + (needPt - have)));
      return true;
    }
    return false;
  }

  function fillBlock(ctx, fields, o) {
    FIELD_ORDER.forEach(function (k) {
      var reg = fields[k]; if (!reg) return;
      var v = (o[k] == null ? '' : String(o[k])).trim();
      if (k === 'phone') v = v.replace(/\s*[\/،,]\s*/g, '\n');
      ctx.setValue(mkRef(reg.c1, reg.r1), v);
      if (v) fitRegion(ctx, reg, v);
    });
    var price = (typeof o.price === 'number' && isFinite(o.price)) ? o.price : null;
    var ship = (typeof o.shipping === 'number' && isFinite(o.shipping)) ? o.shipping : null;
    if (fields.price) ctx.setValue(mkRef(fields.price.c1, fields.price.r1), price);
    if (fields.shipping) ctx.setValue(mkRef(fields.shipping.c1, fields.shipping.r1), ship);
    if (fields.total) {
      var ref = mkRef(fields.total.c1, fields.total.r1), cell = ctx.ensureCell(ref);
      var tot = (price || 0) + (ship || 0);
      if (firstLocal(cell, 'f')) {
        var v = firstLocal(cell, 'v');
        if (!v) { v = ctx.doc.createElementNS(NS, 'v'); cell.appendChild(v); }
        v.textContent = String(tot);
      } else ctx.setValue(ref, tot);
    }
  }

  /* الصور: نخليها بحجمها الأصلي حتى لو الصفوف كبرت */
  function fixDrawing(doc) {
    var changed = 0;
    byLocal(doc, 'twoCellAnchor').forEach(function (a) {
      var pic = firstLocal(a, 'pic'); if (!pic) return;
      var ext = null;
      byLocal(pic, 'ext').forEach(function (e) { if (e.getAttribute('cx')) ext = ext || e; });
      if (!ext) return;
      var XDR = a.namespaceURI, one = doc.createElementNS(XDR, a.prefix ? a.prefix + ':oneCellAnchor' : 'oneCellAnchor');
      var from = firstLocal(a, 'from');
      one.appendChild(from.cloneNode(true));
      var e2 = doc.createElementNS(XDR, a.prefix ? a.prefix + ':ext' : 'ext');
      e2.setAttribute('cx', ext.getAttribute('cx')); e2.setAttribute('cy', ext.getAttribute('cy'));
      one.appendChild(e2);
      Array.prototype.slice.call(a.children).forEach(function (ch) {
        var ln = ch.localName; if (ln !== 'from' && ln !== 'to') one.appendChild(ch.cloneNode(true));
      });
      a.parentNode.replaceChild(one, a); changed++;
    });
    return changed;
  }

  function safeName(base, used) {
    base = base.replace(/[\\\/\?\*\[\]:]/g, '').slice(0, 28);
    var n = 2, nm;
    do { nm = base + ' ' + n; n++; } while (used.indexOf(nm) !== -1);
    return nm;
  }
  function nextFree(zip, prefix, ext) {
    var i = 1; while (zip.file(prefix + i + ext)) i++;
    return prefix + i + ext;
  }

  /**
   * plan = [{ sheet:'Layal', orders:[{name,phone,gov,area,address,details,price,shipping}...] }, ...]
   * opts = { dropEmpty:true }
   * بترجّع { blob/uint8, sheets:[{name,count}], zip }
   */
  async function buildWorkbook(templateBuf, plan, opts) {
    opts = opts || {};
    var zip = await JSZip.loadAsync(templateBuf);
    // من غير مدخلات فولدرات في الـ zip (إكسيل بيعتبرها ملف تالف ويطلب "إصلاح")
    var _zipFile = zip.file.bind(zip);
    zip.file = function (name, data, o) {
      if (arguments.length < 2) return _zipFile(name);
      return _zipFile(name, data, Object.assign({ createFolders: false }, o || {}));
    };

    // الـ workbook
    var rootRels = parseXml(await readText(zip, '_rels/.rels'));
    var wbRel = byLocal(rootRels, 'Relationship').filter(function (r) { return /officeDocument$/.test(r.getAttribute('Type')); })[0];
    var wbPath = wbRel ? resolve('_rels/.rels'.replace('_rels/', ''), wbRel.getAttribute('Target')) : 'xl/workbook.xml';
    var wbDoc = parseXml(await readText(zip, wbPath));
    var wbRelsDoc = await readRelsDoc(zip, wbPath);
    var wbRels = relsMap(wbRelsDoc, wbPath);
    var ctDoc = parseXml(await readText(zip, '[Content_Types].xml'));

    var sstText = await readText(zip, 'xl/sharedStrings.xml');
    var sst = [];
    if (sstText) byLocal(parseXml(sstText), 'si').forEach(function (si) { sst.push(byLocal(si, 't').map(function (t) { return t.textContent; }).join('')); });
    var styles = parseStyles(parseXml(await readText(zip, 'xl/styles.xml')));

    var sheetsEl = firstLocal(wbDoc, 'sheets');
    var sheetEls = byLocal(sheetsEl, 'sheet');
    var tpl = sheetEls.map(function (el) {
      var rid = el.getAttributeNS(NS_R, 'id');
      return { el: el, name: el.getAttribute('name'), rid: rid, path: wbRels[rid].target };
    });
    var usedNames = tpl.map(function (t) { return t.name; });
    var maxSheetId = Math.max.apply(null, sheetEls.map(function (e) { return parseInt(e.getAttribute('sheetId'), 10) || 0; }));
    var maxRid = Math.max.apply(null, Object.keys(wbRels).map(function (k) { return parseInt(k.replace(/\D/g, ''), 10) || 0; }));
    var anyOrders = plan.some(function (p) { return p.orders.length; });

    var outSheets = [];          // {name, ctx, sheetPath, drawingPath, el}
    var report = [];
    var warnings = [];
    capWarn = [];

    for (var ti = 0; ti < tpl.length; ti++) {
      var t = tpl[ti];
      var entry = plan.filter(function (p) { return p.sheet === t.name; })[0];
      var orders = entry ? entry.orders : [];
      var origXml = await readText(zip, t.path);
      var probe = new SheetCtx(parseXml(origXml), sst, styles);
      var an = analyzeSheet(probe);
      var slots = an.blocks.length;
      if (!orders.length && opts.dropEmpty !== false && anyOrders) {
        // نشيل الشيت الفاضي
        t.el.parentNode.removeChild(t.el);
        await removeSheetParts(zip, ctDoc, t.path, t.rid, wbRelsDoc);
        continue;
      }
      if (!slots && orders.length) { warnings.push('الشيت «' + t.name + '» مفيهوش خانات معروفة (إسم العميل ...) — اتجاهل.'); }
      var copies = slots ? Math.max(1, Math.ceil(orders.length / slots)) : 1;
      var prevEl = t.el;
      for (var k = 0; k < copies; k++) {
        var name = t.name, sheetPath = t.path, el = t.el, xml = origXml;
        if (k > 0) {
          name = safeName(t.name, usedNames); usedNames.push(name);
          sheetPath = nextFree(zip, 'xl/worksheets/sheet', '.xml');
          zip.file(sheetPath, xml);   // نحجز الاسم فورًا (قبل كده الشيتات المنسوخة كانت بتاخد نفس الملف وتكرر نفس الأوردر)
          // rels + drawing
          var origRelsDoc = await readRelsDoc(zip, t.path);
          var newRels = origRelsDoc ? parseXml(serializer.serializeToString(origRelsDoc)) : null;
          if (newRels) {
            byLocal(newRels, 'Relationship').forEach(function (rr) {
              var type = rr.getAttribute('Type');
              if (/printerSettings$/.test(type)) rr.parentNode.removeChild(rr);
            });
            var drRel = byLocal(newRels, 'Relationship').filter(function (rr) { return rr.getAttribute('Type') === REL_DRAWING; })[0];
            if (drRel) {
              var srcDraw = resolve(t.path, drRel.getAttribute('Target'));
              var newDraw = nextFree(zip, 'xl/drawings/drawing', '.xml');
              zip.file(newDraw, await readText(zip, srcDraw));
              var dr = await readText(zip, relsPath(srcDraw));
              if (dr) zip.file(relsPath(newDraw), dr);
              drRel.setAttribute('Target', '../drawings/' + basename(newDraw));
              addOverride(ctDoc, '/' + newDraw, T_DRAW);
            }
            zip.file(relsPath(sheetPath), toXml(newRels));
          }
          addOverride(ctDoc, '/' + sheetPath, T_SHEET);
          maxRid++; maxSheetId++;
          var rid = 'rId' + maxRid;
          var rel = wbRelsDoc.createElementNS(NS_PR, 'Relationship');
          rel.setAttribute('Id', rid);
          rel.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet');
          rel.setAttribute('Target', 'worksheets/' + basename(sheetPath));
          wbRelsDoc.documentElement.appendChild(rel);
          el = wbDoc.createElementNS(NS, 'sheet');
          el.setAttribute('name', name); el.setAttribute('sheetId', String(maxSheetId));
          el.setAttributeNS(NS_R, 'r:id', rid);
          prevEl.parentNode.insertBefore(el, prevEl.nextSibling);
        }
        prevEl = el;
        var doc = parseXml(xml);
        // نظافة: مفيش تحديد متعدد، ومفيش printerSettings
        byLocal(doc, 'sheetView').forEach(function (sv) {
          sv.removeAttribute('tabSelected'); sv.removeAttribute('topLeftCell');
          byLocal(sv, 'selection').forEach(function (s) { s.parentNode.removeChild(s); });
        });
        if (k > 0) byLocal(doc, 'pageSetup').forEach(function (ps) { ps.removeAttributeNS(NS_R, 'id'); ps.removeAttribute('r:id'); });
        byLocal(doc, 'row').forEach(function (r) { r.removeAttribute('spans'); });
        var ctx = new SheetCtx(doc, sst, styles);
        var chunk = slots ? orders.slice(k * slots, (k + 1) * slots) : [];
        var an2 = analyzeSheet(ctx);
        chunk.forEach(function (o, bi) { fillBlock(ctx, an2.blocks[bi], o); });
        outSheets.push({ name: name, ctx: ctx, path: sheetPath, el: el, count: chunk.length });
        report.push({ name: name, count: chunk.length, slots: slots });
      }
    }
    if (!outSheets.length) throw new Error('مفيش شيتات في القالب.');

    // أول شيت يكون المحدد
    var first = firstLocal(outSheets[0].ctx.doc, 'sheetView'); if (first) first.setAttribute('tabSelected', '1');
    for (var oi = 0; oi < outSheets.length; oi++) {
      zip.file(outSheets[oi].path, toXml(outSheets[oi].ctx.doc));
      // الصور
      var relDoc = await readRelsDoc(zip, outSheets[oi].path);
      if (relDoc) {
        var dRel = byLocal(relDoc, 'Relationship').filter(function (rr) { return rr.getAttribute('Type') === REL_DRAWING; })[0];
        if (dRel) {
          var dp = resolve(outSheets[oi].path, dRel.getAttribute('Target'));
          var dDoc = parseXml(await readText(zip, dp));
          if (fixDrawing(dDoc)) zip.file(dp, toXml(dDoc));
        }
      }
    }

    // calcChain
    if (zip.file('xl/calcChain.xml')) {
      zip.remove('xl/calcChain.xml');
      byLocal(ctDoc, 'Override').forEach(function (o) { if (o.getAttribute('PartName') === '/xl/calcChain.xml') o.parentNode.removeChild(o); });
      byLocal(wbRelsDoc, 'Relationship').forEach(function (r) { if (/calcChain$/.test(r.getAttribute('Type'))) r.parentNode.removeChild(r); });
    }
    // workbook: calc + تنظيف
    var calc = firstLocal(wbDoc, 'calcPr');
    if (calc) calc.setAttribute('fullCalcOnLoad', '1');
    byLocal(wbDoc, 'definedName').forEach(function (d) { if (/#REF!/.test(d.textContent)) d.parentNode.removeChild(d); });
    var dn = firstLocal(wbDoc, 'definedNames'); if (dn && !dn.children.length) dn.parentNode.removeChild(dn);
    var bv = firstLocal(wbDoc, 'workbookView'); if (bv) { bv.removeAttribute('activeTab'); bv.removeAttribute('firstSheet'); }

    // docProps/app.xml
    if (zip.file('docProps/app.xml')) {
      var names = byLocal(sheetsEl, 'sheet').map(function (e) { return e.getAttribute('name'); });
      var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
      zip.file('docProps/app.xml', DECL + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Microsoft Excel</Application><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>' + names.length + '</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="' + names.length + '" baseType="lpstr">' + names.map(function (n) { return '<vt:lpstr>' + esc(n) + '</vt:lpstr>'; }).join('') + '</vt:vector></TitlesOfParts></Properties>');
    }
    // علاقات بتشاور على ملفات مش موجودة (زي Target="NULL" اللي بيحطها WPS) — إكسيل بيعتبرها تلف ويطلب إصلاح
    byLocal(wbRelsDoc, 'Relationship').forEach(function (r) {
      if (r.getAttribute('TargetMode') === 'External') return;
      var tp = resolve(wbPath, r.getAttribute('Target') || '');
      if (!zip.file(tp)) r.parentNode.removeChild(r);
    });
    zip.file(wbPath, toXml(wbDoc));
    zip.file(relsPath(wbPath), toXml(wbRelsDoc));
    zip.file('[Content_Types].xml', toXml(ctDoc));

    var bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    return { bytes: bytes, report: report, warnings: warnings.concat(capWarn.filter(function (w, i, a) { return a.indexOf(w) === i; })) };
  }

  function addOverride(ctDoc, part, type) {
    var o = ctDoc.createElementNS(NS_CT, 'Override');
    o.setAttribute('PartName', part); o.setAttribute('ContentType', type);
    ctDoc.documentElement.appendChild(o);
  }
  async function removeSheetParts(zip, ctDoc, path, rid, wbRelsDoc) {
    // الـ drawing + الصور المرتبطة بالشيت المحذوف
    var rd = await readRelsDoc(zip, path);
    if (rd) {
      var rm = relsMap(rd, path);
      Object.keys(rm).forEach(function (k) {
        var r = rm[k];
        if (r.type === REL_DRAWING || /printerSettings$/.test(r.type)) {
          if (r.type === REL_DRAWING) {
            zip.remove(relsPath(r.target));
            byLocal(ctDoc, 'Override').forEach(function (o) { if (o.getAttribute('PartName') === '/' + r.target) o.parentNode.removeChild(o); });
          }
          zip.remove(r.target);
        }
      });
      zip.remove(relsPath(path));
    }
    zip.remove(path);
    byLocal(ctDoc, 'Override').forEach(function (o) { if (o.getAttribute('PartName') === '/' + path) o.parentNode.removeChild(o); });
    byLocal(wbRelsDoc, 'Relationship').forEach(function (r) { if (r.getAttribute('Id') === rid) r.parentNode.removeChild(r); });
  }

  g.XlsxCore = {
    buildWorkbook: buildWorkbook, analyzeSheet: analyzeSheet, SheetCtx: SheetCtx, parseXml: parseXml, byLocal: byLocal,
    firstLocal: firstLocal, readText: readText, readRelsDoc: readRelsDoc, relsMap: relsMap, resolve: resolve,
    relsPath: relsPath, parseRef: parseRef, mkRef: mkRef, numToCol: numToCol, parseStyles: parseStyles, countLines: countLines,
    normLabel: normLabel, LABELS: LABELS, NS: NS, NS_R: NS_R, FONT_STACK: FONT_STACK
  };
})(typeof window !== 'undefined' ? window : globalThis);
