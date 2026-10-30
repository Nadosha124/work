/* app.js — الواجهة: رفع القالب والشات، مراجعة الأوردرات، إنشاء الشيتات، تنزيل Excel/PDF */
(function () {
  'use strict';
  var X = window.XlsxCore, R = window.Render, C = window.Chat;
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    tplBytes: null, tplName: '', tplSheets: [],   // [{name, slots}]
    orders: [], xlsxBytes: null, pages: [], model: null, busy: false
  };
  var DEFAULT_ALIAS = { layal: 'ليال', lana: 'لانا' };
  var settings = loadSettings();

  /* ---------- أدوات ---------- */
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function toast(msg, ms) {
    var t = $('toast'); t.textContent = msg; t.className = 'show';
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = ''; }, ms || 3200);
  }
  function setBusy(on, msg) {
    state.busy = on; document.body.classList.toggle('busy', on); if (!on) progress(null);
    $('busyMsg').textContent = msg || 'ثانية واحدة...';
  }
  function setStep(n) { document.querySelectorAll('#steps li').forEach(function (li) { var k = +li.dataset.s; li.className = k === n ? 'on' : (k < n ? 'done' : ''); }); document.body.classList.toggle('res', n === 3); }
  function progress(p) { var pg = $('prog'); pg.classList.toggle('on', p != null); if (p != null) $('busyBar').style.width = Math.round(p * 100) + '%'; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function loadSettings() {
    try { return Object.assign({ aliases: {}, stripReg: true, dropEmpty: true, defaultSheet: null }, JSON.parse(localStorage.getItem('settings') || '{}')); }
    catch (e) { return { aliases: {}, stripReg: true, dropEmpty: true }; }
  }
  function saveSettings() { try { localStorage.setItem('settings', JSON.stringify(settings)); } catch (e) { /* ignore */ } }

  // تنظيف أي مسودة قديمة كانت متخزنة (ميزة "كمّل آخر مراجعة" اتشالت)
  try { indexedDB.deleteDatabase('invoices-app'); } catch (e) { /* ignore */ }

  /* ---------- القالب ---------- */
  async function inspectTemplate(bytes) {
    var zip = await JSZip.loadAsync(bytes);
    var wb = X.parseXml(await X.readText(zip, 'xl/workbook.xml'));
    var rels = X.relsMap(await X.readRelsDoc(zip, 'xl/workbook.xml'), 'xl/workbook.xml');
    var sstTxt = await X.readText(zip, 'xl/sharedStrings.xml'), sst = [];
    if (sstTxt) X.byLocal(X.parseXml(sstTxt), 'si').forEach(function (si) { sst.push(X.byLocal(si, 't').map(function (t) { return t.textContent; }).join('')); });
    var styles = X.parseStyles(X.parseXml(await X.readText(zip, 'xl/styles.xml')));
    var out = [], els = X.byLocal(X.firstLocal(wb, 'sheets'), 'sheet');
    for (var i = 0; i < els.length; i++) {
      var path = rels[els[i].getAttributeNS(X.NS_R, 'id')].target;
      var ctx = new X.SheetCtx(X.parseXml(await X.readText(zip, path)), sst, styles);
      out.push({ name: els[i].getAttribute('name'), slots: X.analyzeSheet(ctx).blocks.length });
    }
    return out;
  }

  async function setTemplate(bytes, name) {
    var sheets = await inspectTemplate(bytes);
    state.tplBytes = bytes; state.tplName = name; state.tplSheets = sheets;
    renderTemplateInfo();
  }

  function aliasesFor(sheet) {
    var v = settings.aliases[sheet];
    if (v == null) v = DEFAULT_ALIAS[sheet.toLowerCase()] || sheet;
    return v;
  }
  function brands() {
    return state.tplSheets.map(function (s) {
      return { sheet: s.name, aliases: aliasesFor(s.name).split(/[,،\n]/).map(function (x) { return x.trim(); }).filter(Boolean).concat([s.name]) };
    });
  }

  function renderTemplateInfo() {
    var box = $('tplInfo'); box.innerHTML = '';
    if (!state.tplBytes) { box.appendChild(el('p', { class: 'muted', text: 'لسه مفيش ملف. اختار ملف الإكسيل اللي فيه الشيتات (مرة واحدة وهيتحفظ في الموبايل).' })); $('btnAnalyze').disabled = true; $('brandBox').hidden = true; return; }
    box.appendChild(el('p', { class: 'ok', text: state.tplName }));
    var ul = el('ul', { class: 'sheets' });
    state.tplSheets.forEach(function (s) {
      ul.appendChild(el('li', {}, [el('b', { text: s.name }), ' — ' + (s.slots ? s.slots + ' فواتير في الشيت' : 'مش لاقي خانات الفاتورة (إسم العميل ...)')]));
    });
    box.appendChild(ul);
    $('btnAnalyze').disabled = !state.chatText;
    var bl = $('brandList'); bl.innerHTML = ''; $('brandBox').hidden = false;
    var ds = $('optDefault'); ds.innerHTML = '';
    ds.appendChild(el('option', { value: '', text: '— اسأل (يتعتبر مشكلة) —' }));
    state.tplSheets.forEach(function (s) { ds.appendChild(el('option', { value: s.name, text: s.name })); });
    if (settings.defaultSheet == null) { var lana = state.tplSheets.filter(function (s) { return /lana/i.test(s.name); })[0]; settings.defaultSheet = lana ? lana.name : ''; }
    ds.value = settings.defaultSheet;
    ds.onchange = function () { settings.defaultSheet = ds.value; saveSettings(); };
    state.tplSheets.forEach(function (s) {
      var inp = el('input', { type: 'text', value: aliasesFor(s.name), dir: 'rtl' });
      inp.addEventListener('change', function () { settings.aliases[s.name] = inp.value; saveSettings(); });
      bl.appendChild(el('label', { class: 'row' }, [el('span', { text: 'الشيت «' + s.name + '» يظهر في الشات بكلمة:' }), inp]));
    });
  }

  /* ---------- الشات ---------- */
  async function readChatFile(file) {
    var name = file.name || '';
    var buf = await file.arrayBuffer();
    var u8 = new Uint8Array(buf);
    var isZip = u8[0] === 0x50 && u8[1] === 0x4b;
    if (!isZip) return new TextDecoder('utf-8').decode(u8);
    var zip = await JSZip.loadAsync(buf);
    var names = Object.keys(zip.files).filter(function (n) { return !zip.files[n].dir && /\.txt$/i.test(n) && !/^__MACOSX/.test(n); });
    if (!names.length) throw new Error('مفيش ملف txt جوه الـ zip');
    names.sort(function (a, b) { return (/_chat\.txt$/i.test(b) ? 1 : 0) - (/_chat\.txt$/i.test(a) ? 1 : 0); });
    return await zip.file(names[0]).async('string');
  }

  async function onChat(file) {
    try {
      setBusy(true, 'بقرا الشات...');
      state.chatText = await readChatFile(file);
      var n = C.splitMessages(state.chatText).length;
      state.st = C.chatStamps(state.chatText);
      $('chatInfo').textContent = (file.name || 'الشات') + ' — ' + n + ' رسالة';
      $('chatInfo').className = 'ok';
      $('btnAnalyze').disabled = !state.tplBytes;
      $('chatCard').classList.remove('fold');
      setupRange();
    } catch (e) { toast('مشكلة في ملف الشات: ' + e.message, 5000); $('chatInfo').textContent = ''; }
    finally { setBusy(false); }
  }

  /* ---------- تحديد بداية الاحتساب (تاريخ ووقت) ---------- */
  function p2(n) { return ('0' + n).slice(-2); }
  function toLocalInput(ms) { var d = new Date(ms); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes()); }
  function fmtDt(ms) { return new Date(ms).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }); }
  function fromMs() { var v = $('fromDt').value, t = v ? new Date(v).getTime() : NaN; return isNaN(t) ? -Infinity : t; }
  // بداية الاحتساب الافتراضية: أول رسالة في السنة الحالية (مش أول رسالة في الشات لو قديمة)
  function yearStart(st) {
    var y0 = new Date(new Date().getFullYear(), 0, 1).getTime();
    var inYear = st.list.filter(function (x) { return x.t >= y0; }).map(function (x) { return x.t; });
    return inYear.length ? Math.min.apply(null, inYear) : st.first;
  }
  function setupRange() {
    var st = state.st, ok = !!(st && st.list.length); $('rangeBox').hidden = !ok; if (!ok) return;
    $('fromDt').value = toLocalInput(yearStart(st)); updateRange();
  }
  function updateRange() {
    var st = state.st; if (!st || !st.list.length) return;
    var ms = fromMs(), c = st.list.filter(function (x) { return x.t >= ms; }).length;
    $('rangeInfo').textContent = c + ' رسالة من ' + st.list.length + ' • الشات من ' + fmtDt(st.first) + ' إلى ' + fmtDt(st.last);
    $('btnAnalyze').disabled = !state.tplBytes || !c;
  }

  function analyze() {
    if (!state.tplBytes || !state.chatText) return;
    var txt = state.chatText;
    if (state.st && state.st.list.length) { var cut = C.cutFrom(state.st, fromMs()); if (!cut.count) { toast('مفيش رسايل من الوقت ده'); return; } txt = cut.text; }
    var res = C.parseChat(txt, brands(), { stripRegPhrase: settings.stripReg, defaultBrand: settings.defaultSheet || null });
    state.orders = res.orders; state.totalMsgs = res.totalMessages;
    $('chatCard').classList.add('fold'); $('review').dataset.f = 'all'; setStep(2); document.body.classList.remove('res');
    renderReview(res.totalMessages);
    $('review').hidden = false; $('result').hidden = true;
    setTimeout(function () { $('review').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
  }

  /* ---------- مراجعة الأوردرات ---------- */
  var PAGE = 120;
  function renderReview(totalMsgs) {
    var list = state.orders;
    var bad = list.filter(function (o) { return o.issues.length; }), good = list.filter(function (o) { return !o.issues.length; });
    $('reviewSummary').textContent = list.length
      ? list.length + ' أوردر من ' + totalMsgs + ' رسالة'
      : 'مفيش أوردرات في الفترة دي.';
    fillList($('problems'), bad, $('probTitle'));
    fillList($('orders'), good, $('okTitle'));
    $('btnCopyProb').hidden = !bad.length;
    $('btnNext').hidden = !bad.length;
    updateBuildBtn();
  }
  function fillList(box, arr, title) {
    box.innerHTML = ''; title.hidden = !arr.length;
    var shown = 0;
    function more() {
      var next = arr.slice(shown, shown + PAGE);
      next.forEach(function (o) { box.insertBefore(orderCard(o, state.orders.indexOf(o)), box.lastChild && box.lastChild.className === 'more' ? box.lastChild : null); });
      shown += next.length;
      var btn = box.querySelector('.more'); if (btn) btn.remove();
      if (shown < arr.length) box.appendChild(el('button', { class: 'secondary more', text: 'عرض المزيد (' + (arr.length - shown) + ')', onclick: more }));
    }
    more();
  }

  function orderCard(o, idx) {
    var card = el('div', { class: 'order' + (o.issues.length ? ' bad' : '') });
    var chk = el('input', { type: 'checkbox' });
    var badge = el('span', { class: 'badge' });
    var warnBox = el('ul', { class: 'warn' });
    var sel = el('select', {}, [el('option', { value: '', text: '— اختار الشيت —' })].concat(state.tplSheets.map(function (s) { return el('option', { value: s.name, text: s.name }); })));
    sel.value = o.brand || '';
    var total = el('b', { class: 'total' });
    function refresh() {
      C.validate(o);
      var has = o.issues.length > 0;
      chk.disabled = has; if (has) { o.include = false; chk.checked = false; } else if (o.include === false && !o.userOff) { o.include = true; chk.checked = true; }
      card.classList.toggle('bad', has); card.classList.toggle('fixed', !has && !!o._wasBad);
      if (has) o._wasBad = true;
      badge.textContent = has ? 'مشكلة' : (o._wasBad ? 'اتصلح' : 'تمام'); badge.className = 'badge' + (has ? '' : ' ok');
      warnBox.innerHTML = ''; o.issues.forEach(function (w) { warnBox.appendChild(el('li', { text: w })); });
      nameEl.textContent = o.name || 'بدون اسم'; subEl.textContent = [o.phone, o.gov].filter(Boolean).join(' • ') || '—'; warnEl.textContent = has ? o.issues[0] + (o.issues.length > 1 ? ' (+' + (o.issues.length - 1) + ')' : '') : '';
      total.textContent = 'الإجمالي: ' + ((o.price || 0) + (o.shipping || 0));
      updateBuildBtn();
    }
    chk.checked = !!o.include;
    chk.addEventListener('change', function () { o.include = chk.checked; o.userOff = !chk.checked; updateBuildBtn(); });
    sel.addEventListener('change', function () { o.brand = sel.value; o._parseIssues = (o._parseIssues || []).filter(function (x) { return !/شيت/.test(x); }); refresh(); });
    var nameEl = el('b'), subEl = el('small'), warnEl = el('small', { class: 'w' });
    var body = el('div', { class: 'obody' });
    var sum = el('div', { class: 'osum', role: 'button', tabindex: '0' }, [el('label', { class: 'inc' }, [chk]), el('div', { class: 'omain' }, [nameEl, subEl, warnEl]), badge, el('span', { class: 'go', 'aria-hidden': 'true' })]);
    function toggle() { card.classList.toggle('open'); }
    sum.addEventListener('click', function (e) { if (e.target.closest('label')) return; toggle(); });
    sum.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === sum) { e.preventDefault(); toggle(); } });
    card._open = function () { card.classList.add('open'); };
    card.appendChild(sum);
    body.appendChild(el('div', { class: 'ohead' }, [sel, total]));
    function field(label, key, kind) {
      var inp = kind === 'area' ? el('textarea', { rows: 3, dir: 'rtl' }) : el('input', { type: kind === 'num' ? 'number' : 'text', inputmode: kind === 'num' ? 'decimal' : null, dir: kind === 'tel' ? 'ltr' : 'rtl' });
      inp.value = o[key] == null ? '' : o[key];
      inp.addEventListener('input', function () {
        if (kind === 'num') { var n = parseFloat(inp.value); o[key] = isNaN(n) ? null : n; o.total = null; } else o[key] = inp.value;
        if (key === 'gov' || key === 'area') o._parseIssues = (o._parseIssues || []).filter(function (x) { return !/(تابعة|محافظة|مقدرتش)/.test(x); });
        refresh();
      });
      return el('label', { class: 'f' + (kind === 'tel' || kind === 'wide' ? ' wide' : '') }, [el('span', { text: label }), inp]);
    }
    body.appendChild(el('div', { class: 'grid' }, [
      field('الاسم', 'name', 'wide'), field('التليفون (لو اتنين افصل بينهم /)', 'phone', 'tel'), field('المحافظة', 'gov'), field('المنطقة / المركز', 'area'),
      field('السعر', 'price', 'num'), field('الشحن', 'shipping', 'num')
    ]));
    body.appendChild(field('العنوان بالتفصيل', 'address', 'area'));
    body.appendChild(field('تفاصيل الأوردر', 'details', 'area'));
    body.appendChild(warnBox);
    body.appendChild(el('details', { class: 'raw' }, [el('summary', { text: 'الرسالة الأصلية' + (o.sender ? ' — ' + o.sender : '') }), el('pre', { text: o.raw })]));
    card.appendChild(body);
    refresh();
    return card;
  }

  function updateBuildBtn() {
    var inc = state.orders.filter(function (o) { return o.include && !o.issues.length; });
    var bad = state.orders.filter(function (o) { return o.issues.length; }).length;
    $('btnBuild').disabled = !inc.length; $('fBad').textContent = 'للمراجعة (' + bad + ')'; $('fOk').textContent = 'جاهزة (' + state.orders.filter(function (o) { return !o.issues.length; }).length + ')'; $('btnNext').hidden = !bad; 
    $('buildHint').textContent = inc.length ? inc.length + ' فاتورة' + (bad ? ' • ' + bad + ' مش هتتسجل' : '') : 'مفيش أوردرات جاهزة';
  }

  function copyProblems() {
    var lines = state.orders.filter(function (o) { return o.issues.length; }).map(function (o, i) {
      return (i + 1) + ') ' + (o.name || '—') + ' | ' + (o.phone || '—') + ' | ' + o.issues.join(' ، ');
    });
    var txt = 'أوردرات محتاجة مراجعة (' + lines.length + '):\n' + lines.join('\n');
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast('اتنسخت القائمة ✔'); }, function () { download(new Blob([txt], { type: 'text/plain;charset=utf-8' }), 'problems-' + today() + '.txt'); });
  }

  /* ---------- إنشاء الشيتات ---------- */
  async function build() {
    var cnt = state.orders.filter(function (o) { return o.include && !o.issues.length; }).length;
    if (cnt > 300 && !confirm('فيه ' + cnt + ' فاتورة جاهزة (حوالي ' + Math.ceil(cnt / 4) + ' صفحة). ده كتير ممكن يهنّج الموبايل. تكمل؟')) return;
    try {
      setBusy(true, 'بعمل الشيتات...');
      var plan = state.tplSheets.map(function (s) {
        return { sheet: s.name, orders: state.orders.filter(function (o) { return o.include && !o.issues.length && o.brand === s.name; }) };
      });
      var res = await X.buildWorkbook(state.tplBytes, plan, { dropEmpty: settings.dropEmpty });
      state.xlsxBytes = res.bytes;
      res.warnings.forEach(function (w) { toast(w, 5000); });
      await showResult('الشيتات اللي اتعملت: ' + res.report.map(function (r) { return r.name + ' (' + r.count + ')'; }).join(' • '));
    } catch (e) { console.error(e); toast('حصلت مشكلة: ' + e.message, 6000); }
    finally { setBusy(false); }
  }

  async function showResult(summary) {
    if (state.model) R.revokeModel(state.model);
    state.model = await R.readModel(state.xlsxBytes);
    var off = $('offscreen'); off.innerHTML = '';
    state.pages = await R.renderPages(state.model, off);
    $('resultSummary').textContent = summary + ' — ' + state.pages.length + ' صفحة A4 — اضغط «حفظ Excel».';
    $('result').hidden = false; setStep(3);
    drawPreview();
    setTimeout(function () { $('result').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
  }

  function drawPreview() {
    var box = $('preview'); box.innerHTML = '';
    var avail = Math.min((box.clientWidth || window.innerWidth - 24) * 0.88, 420);
    state.pages.forEach(function (p, i) {
      var W = p.landscape ? 1122.5 : 793.7, H = p.landscape ? 793.7 : 1122.5, ps = avail / W;
      var holder = el('div', { class: 'pv', style: 'width:' + (W * ps) + 'px;height:' + (H * ps) + 'px' });
      var clone = p.el.cloneNode(true); clone.style.transform = 'scale(' + ps + ')'; clone.style.transformOrigin = '0 0';
      holder.appendChild(clone);
      box.appendChild(el('div', { class: 'pvwrap' }, [el('div', { class: 'pvlabel', text: 'صفحة ' + (i + 1) + ' — ' + p.name }), holder]));
    });
  }
  window.addEventListener('resize', function () { if (state.pages.length) { clearTimeout(drawPreview._t); drawPreview._t = setTimeout(drawPreview, 150); } });

  /* ---------- التصدير ---------- */
  function downloadXlsx() {
    download(new Blob([state.xlsxBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'invoices-' + today() + '.xlsx');
  }

  /* ---------- ربط الأحداث ---------- */
  function bind() {
    $('chatFile').addEventListener('change', function (e) { var f = e.target.files[0]; if (f) onChat(f); e.target.value = ''; });
    $('btnAnalyze').addEventListener('click', analyze);
    $('fromDt').addEventListener('input', updateRange);
    document.querySelectorAll('#rangeBox .chip[data-q]').forEach(function (c) { c.addEventListener('click', function () {
      var st = state.st; if (!st || !st.list.length) return; var d = new Date(); d.setHours(0, 0, 0, 0);
      var q = c.dataset.q; $('fromDt').value = toLocalInput(q === 'all' ? yearStart(st) : (q === 'yest' ? d.getTime() - 864e5 : d.getTime())); updateRange(); }); });
    $('btnTheme').addEventListener('click', function () {
      var n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = n; document.querySelector('meta[name=theme-color]').content = n === 'dark' ? '#201b1d' : '#9b5560';
      try { localStorage.setItem('theme', n); } catch (e) { /* ignore */ } });
    $('btnBuild').addEventListener('click', build);
    $('btnCopyProb').addEventListener('click', copyProblems);
    $('btnXlsx').addEventListener('click', downloadXlsx);
    document.querySelectorAll('#filters .chip[data-f]').forEach(function (c) { c.addEventListener('click', function () {
      $('review').dataset.f = c.dataset.f; document.querySelectorAll('#filters .chip[data-f]').forEach(function (x) { x.classList.toggle('on', x === c); }); }); });
    $('btnNext').addEventListener('click', function () {
      $('review').dataset.f = $('review').dataset.f === 'ok' ? 'all' : $('review').dataset.f;
      var list = Array.prototype.slice.call(document.querySelectorAll('#problems .order.bad')); if (!list.length) return;
      var next = list.filter(function (c) { return c.getBoundingClientRect().top > 140; })[0] || list[0];
      next._open && next._open(); next.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $('chatCard').querySelector('h2').addEventListener('click', function () { $('chatCard').classList.toggle('fold'); });
    $('optStrip').checked = settings.stripReg; $('optDrop').checked = settings.dropEmpty;
    $('optStrip').addEventListener('change', function () { settings.stripReg = $('optStrip').checked; saveSettings(); if (state.chatText && !$('review').hidden && confirm('أعيد تحليل الشات بالإعداد الجديد؟ (التعديلات اليدوية هتضيع)')) analyze(); });
    $('optDrop').addEventListener('change', function () { settings.dropEmpty = $('optDrop').checked; saveSettings(); });

    window.addEventListener('online', netPill); window.addEventListener('offline', netPill); netPill();
    var deferred = null;
    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; $('btnInstall').hidden = false; });
    $('btnInstall').addEventListener('click', function () { if (deferred) { deferred.prompt(); deferred = null; $('btnInstall').hidden = true; } });
  }
  function netPill() { var p = $('net'); p.textContent = navigator.onLine ? 'أونلاين' : 'أوفلاين'; p.className = 'pill ' + (navigator.onLine ? '' : 'off'); }

  /* ---------- تشغيل ---------- */
  // تحديث إجباري: نمسح كل الكاشات ونشيل الـ Service Worker ونعمل ريلود
  async function forceUpdate() {
    try {
      if ('serviceWorker' in navigator) { var regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(function (r) { return r.unregister(); })); }
      if (window.caches) { var ks = await caches.keys(); await Promise.all(ks.filter(function (k) { return k !== 'shared-files'; }).map(function (k) { return caches.delete(k); })); }
    } catch (e) { console.warn(e); }
    location.href = location.pathname + '?v=' + Date.now();
  }

  async function init() {
    bind();
    $('verTxt').textContent = 'نسخة ' + (window.APP_VERSION || '?');
    $('btnForceUpdate').addEventListener('click', forceUpdate);
    if ('serviceWorker' in navigator) {
      var hadController = !!navigator.serviceWorker.controller, reloaded = false;
      // أول ما نسخة جديدة تشتغل نعمل ريلود مرة واحدة عشان الصفحة تاخد الملفات الجديدة
      navigator.serviceWorker.addEventListener('controllerchange', function () { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
      try {
        var reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
        reg.update().catch(function () {});
        document.addEventListener('visibilitychange', function () { if (!document.hidden) reg.update().catch(function () {}); });
      } catch (e) { console.warn('SW', e); }
    }
    try {
      // القالب ثابت ومتخزّن جوه التطبيق (template-data.js = invoices_template.xlsx) ومفيش رفع قالب
      var bt = window.BUILTIN_TEMPLATE;
      var bin = atob(bt.b64), u8 = new Uint8Array(bin.length);
      for (var bi = 0; bi < bin.length; bi++) u8[bi] = bin.charCodeAt(bi);
      await setTemplate(u8.buffer, bt.name);
    } catch (e) { console.warn(e); renderTemplateInfo(); }
    // ملف جاي من "مشاركة" واتساب (Share Target)
    if (/[?&]shared=1/.test(location.search) && 'caches' in window) {
      try {
        var cache = await caches.open('shared-files'), resp = await cache.match('shared-chat');
        if (resp) { var blob = await resp.blob(); await cache.delete('shared-chat'); history.replaceState(null, '', location.pathname); await onChat(new File([blob], resp.headers.get('x-filename') || 'chat.zip')); }
      } catch (e) { console.warn(e); }
    }
  }
  document.addEventListener('DOMContentLoaded', init);
  window.__app = { state: state, build: build, analyze: analyze, setTemplate: setTemplate, onChat: onChat };
})();
