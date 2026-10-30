/* chat.js — قراءة شات واتساب وتحليل رسايل الأوردرات (صيغ مختلفة) + اكتشاف الأوردرات اللي فيها مشاكل */
(function (g) {
  'use strict';
  var Egypt = g.Egypt;

  var INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
  var DIACRITICS = /[\u064b-\u065f\u0670\u0640]/g;
  function clean(s) { return String(s || '').replace(INVISIBLE, '').replace(/\u202f/g, ' ').replace(/\u00a0/g, ' ').replace(DIACRITICS, ''); }
  var NZMAP = { 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ڤ': 'ف', 'چ': 'ج', 'پ': 'ب', 'گ': 'ك', 'ئ': 'ي', 'ؤ': 'و', 'ک': 'ك', 'ی': 'ي', 'ە': 'ه', 'ہ': 'ه', 'ۀ': 'ه' };
  function nzChar(c) {
    if (NZMAP[c]) return NZMAP[c];
    var k = c.charCodeAt(0);
    if (k >= 0x660 && k <= 0x669) return String(k - 0x660);
    if (k >= 0x6f0 && k <= 0x6f9) return String(k - 0x6f0);
    if (k >= 65 && k <= 90) return c.toLowerCase();
    return '';
  }
  var NZRE = /[\u064b-\u065f\u0670\u0640أإآٱىةڤچپگئؤکیەہۀ\u0660-\u0669\u06f0-\u06f9A-Z]/g;
  function nz(s) { return String(s).replace(NZRE, nzChar).toLowerCase(); }
  function lat(s) { return nz(s); }
  function lev(a, b) {
    var m = a.length, n = b.length, i, j, d = [];
    for (i = 0; i <= m; i++) d[i] = [i];
    for (j = 1; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }

  /* ---------- 1) تقسيم الشات لرسائل ---------- */
  var D = '[\\d\\u0660-\\u0669\\u06f0-\\u06f9]';
  var HEAD = new RegExp('^\\[?' + D + '{1,4}[\\/.\\-]' + D + '{1,2}[\\/.\\-]' + D + '{1,4}\\s*[,،]?\\s+' + D + '{1,2}[:.]' + D + '{2}(?:[:.]' + D + '{2})?' +
    '\\s*(?:[AaPp]\\.?\\s?[Mm]\\.?|[صم])?\\]?\\s*(?:[-–—]\\s*)?([\\s\\S]*)$');

  // ---- شيل علامة الفوروارد (Forwarded / معاد توجيهها / تم اعادة توجيهها / تم تحويلها ...) ----
  // المقارنة بتتم على النص بعد النورماليز (همزات، ة/ه، ى/ي، تشكيل) فبيمسك أي صيغة كتابة.
  var FWD_TAIL = '(?: (?:عده |اكتر من )?(?:مرات|مره)(?: كثيره)?)?';
  // سطر كله علامة فوروارد (أو بين أقواس)
  var FWD_WHOLE = new RegExp('^(?:forwarded(?: many times)?|forward|fwd|' +
    '(?:رساله )?(?:تم[\\u0621-\\u064a]* )?(?:اعاده )?توجيه[\\u0621-\\u064a]*|' +
    '(?:رساله )?(?:تم[\\u0621-\\u064a]* )?اعاده (?:توجيه|ارسال|تحويل)[\\u0621-\\u064a]*|' +
    '(?:رساله )?تم[\\u0621-\\u064a]* (?:ارسال|تحويل)[\\u0621-\\u064a]*|' +
    '(?:رساله )?(?:معاد|محول)[\\u0621-\\u064a]*(?: (?:توجيه|ارسال)[\\u0621-\\u064a]*)?)' + FWD_TAIL + '$');
  // بداية الرسالة قبل باقي الكلام (من غير الصيغ اللي ممكن تكون جزء من الأوردر زي "تم ارسال")
  var FWD_PREFIX = new RegExp('^(?:forwarded(?: many times)?|fwd|' +
    '(?:رساله )?(?:تم[\\u0621-\\u064a]* )?(?:اعاده )?توجيه[\\u0621-\\u064a]*|' +
    '(?:رساله )?(?:تم[\\u0621-\\u064a]* )?اعاده (?:توجيه|ارسال)[\\u0621-\\u064a]*|' +
    '(?:رساله )?معاد[\\u0621-\\u064a]*(?: توجيه[\\u0621-\\u064a]*)?)' + FWD_TAIL + '$');
  function fwdNorm(str) {
    return nz(String(str).replace(INVISIBLE, '')).replace(/[\[\](){}<>:：\-–—_*~.,،|!]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function isFwdLine(line) { var n = fwdNorm(line); return n !== '' && FWD_WHOLE.test(n); }
  // ---- شيل علامة "This message was edited / تم تعديل هذه الرسالة" بأي صيغة ----
  var EDIT_BRACKET = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]*[<\[(]\s*(?:this\s+message\s+was\s+edited|message\s+edited|edited|تم\s+تعديل\s+(?:هذه\s+)?(?:ال)?رسال[\u0629\u0647]|(?:ال)?رسال[\u0629\u0647]\s+(?:تم\s+)?(?:تعديلها|معدل[\u0629\u0647])|م[\u064b-\u065f]*عد[\u064b-\u065f]*ل[\u0629\u0647]?|معدل[\u0629\u0647]?)\s*[>\])]/gi;
  var EDIT_PLAIN = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]*(?:^|\s)(?:this\s+message\s+was\s+edited|تم\s+تعديل\s+هذه\s+(?:ال)?رسال[\u0629\u0647])(?=\s|$)/gi;
  function stripEdited(t) { return String(t).replace(EDIT_BRACKET, '').replace(EDIT_PLAIN, ' ').replace(/[ \t]+$/gm, ''); }

  function stripForward(t) {
    t = stripEdited(t).replace(/\n[ \t]*(?=\n|$)/g, function (m, off, str) { return m; });
    var lines = t.split('\n');
    // أول سطر: لو بيبدأ بعلامة فوروارد + كلام تاني في نفس السطر نشيل العلامة بس
    for (var guard = 0; guard < 3 && lines.length; guard++) {
      var first = lines[0].replace(INVISIBLE, ''), toks = first.split(/\s+/).filter(Boolean), cut = 0;
      for (var k = Math.min(6, toks.length); k >= 1; k--) {
        var cand = toks.slice(0, k).join(' ');
        if (FWD_PREFIX.test(fwdNorm(cand))) { cut = k; break; }
      }
      if (!cut) break;
      var rest = toks.slice(cut).join(' ');
      if (rest) lines[0] = rest; else lines.shift();
    }
    return lines.filter(function (ln) { return !isFwdLine(ln); }).join('\n');
  }

  function splitMessages(text) {
    var lines = String(text).replace(/^\ufeff/, '').split(/\r?\n/), msgs = [], cur = null;
    for (var i = 0; i < lines.length; i++) {
      var probe = lines[i].replace(INVISIBLE, '');
      var m = HEAD.exec(probe);
      if (m) {
        if (cur) msgs.push(cur);
        var rest = m[1], sender = null, body = rest;
        var s = /^([^:\n]{1,80}?):\s?([\s\S]*)$/.exec(rest);
        if (s) { sender = s[1].replace(INVISIBLE, '').trim(); body = s[2]; }
        cur = { sender: sender, text: stripForward(body) };
      } else if (cur) { var li = stripEdited(lines[i]); if (!isFwdLine(li) && !(li.trim() === '' && li !== lines[i])) cur.text += '\n' + li; }
    }
    if (cur) msgs.push(cur);
    return msgs;
  }

  /* ---------- 2) الشيت (البراند) ---------- */
  function wordKey(w) { return nz(clean(w)).replace(/[^a-z\u0621-\u064a]/g, ''); }
  function matchBrand(word, brands) {
    var w = wordKey(word); if (!w) return null;
    var best = null, bestD = 99, tie = false;
    brands.forEach(function (b) {
      b.aliases.forEach(function (al) {
        var a = wordKey(al); if (!a) return;
        var d = lev(w, a), limit = a.length >= 4 ? 1 : 0;
        if (a.length === 4 && w.length < 3) limit = 0;
        if (d <= limit) {
          if (d < bestD) { best = b; bestD = d; tie = false; } else if (d === bestD && best !== b) tie = true;
        }
      });
    });
    return tie ? null : best;
  }

  /* ---------- 3) مفردات الألوان ---------- */
  var COLOR_WORDS = ('اسود ابيض احمر ازرق اخضر اصفر برتقالي بنفسجي وردي رمادي بيج بني كحلي نبيتي كافيه كشمير كشميري زيتي زيتوني جيشي موف مينت جملي بترولي سماوي مسترده فوشيا هافان جينز جنزاري لافندر شوكو رصاصي ' +
    'ذهبي فضي بيبي لبني سكري عنابي ليموني تركواز فيروزي خمري طوبي مشمشي كراميل قرفه قهوه بنفسجي زهري سلمون اوف اوفوايت بيچ كريمي بودره بودر فاتح غامق وسط شانيه جرين بلو وايت منت لون الوان الالوان ' +
    'بلاك روز رمادى بنى كحلى جملى كافية').split(/\s+/);
  var COLOR_SET = {}; COLOR_WORDS.forEach(function (w) { COLOR_SET[nz(w)] = 1; });
  var MODIFIERS = {}; 'فاتح غامق زهري جيشي بودره بودر وسط كريمي شانيه جرين بلو وايت فاتحه غامقه'.split(' ').forEach(function (w) { MODIFIERS[w] = 1; });
  var FILLER = ['الوان', 'الالوان', 'لون', 'عايزه', 'عايز', 'حسب', 'الصور', 'الصوره', 'صور', 'نفس', 'اللي', 'في', 'ف', 'مثل', 'زي', 'من', 'الاسم', 'تشكيله', 'مختلفه', 'عشوائي', 'ميكس'];
  var FILLER_SET = {}; FILLER.forEach(function (w) { FILLER_SET[w] = 1; });

  function stripArticle(w) { return w.length > 3 && w.indexOf('ال') === 0 ? w.slice(2) : w; }
  function tokOf(w) { return nz(w).replace(/[^a-z0-9\u0621-\u064a]/g, ''); }
  // توكن لون؟ (بيقبل: اسود، 2اسود، واسود، الاسود، وبيج)
  function isColorTok(t) {
    if (!t) return false;
    if (COLOR_SET[t] || COLOR_SET[stripArticle(t)]) return true;
    var m = /^(?:و)?(\d*)(.*)$/.exec(t);
    var core = m[2];
    if (core && core !== t && (COLOR_SET[core] || COLOR_SET[stripArticle(core)])) return true;
    return false;
  }
  function isNumTok(t) { return /^\+*\d+$/.test(t) || /^\+{2,}$/.test(t); }
  function colorish(line) {
    var toks = nz(line).split(/[^a-z0-9\u0621-\u064a+]+/).filter(Boolean);
    if (!toks.length) return false;
    var good = 0, color = 0;
    toks.forEach(function (t) {
      if (isColorTok(t)) { good++; color++; } else if (isNumTok(t) || t === 'و' || FILLER_SET[t] || FILLER_SET[stripArticle(t)]) good++;
    });
    return color > 0 && good / toks.length >= 0.7;
  }
  function fillerOnly(line) {
    var toks = nz(line).split(/[^a-z0-9\u0621-\u064a]+/).filter(Boolean);
    return toks.length > 0 && toks.every(function (t) { return FILLER_SET[t] || FILLER_SET[stripArticle(t)] || t === 'و'; });
  }

  // تفكيك نص ألوان لقائمة عناصر
  function splitColors(text) {
    var s = text.replace(/[\u0660-\u0669]/g, function (c) { return String(c.charCodeAt(0) - 0x660); });
    s = s.replace(/\+{2,}/g, ' ,, ');
    s = s.replace(/(^|\s)و(?=\d)/g, '$1,, ');                       // و2 زيتي
    s = s.replace(/(^|[\s،,.\/\\\-–])و(?=\s)/g, '$1,, ');           // " و "
    s = s.replace(/(^|\s)و(?=[\u0621-\u064a]{3,})/g, function (m0, p, off, all) { // وبيج
      var rest = all.slice(off + m0.length).split(/[^a-z0-9\u0621-\u064a]/)[0];
      return isColorTok(tokOf(rest)) ? p + ',, ' : m0;
    });
    s = s.replace(/[،,]+|\/\/+|\\+|\/|\s[-–]+\s|\.{1,}|\|/g, ',,').replace(/\s{2,}/g, ' ');
    var chunks = s.split(',,').map(function (c) { return c.trim(); }).filter(Boolean);
    var items = [];
    chunks.forEach(function (chunk) {
      var toks = chunk.split(/\s+/).filter(Boolean), i = 0;
      while (i < toks.length) {
        var t = toks[i], qty = '';
        var mq = /^(\d+)(.+)$/.exec(t);
        if (/^\d+$/.test(t) && i + 1 < toks.length) { qty = t; i++; t = toks[i]; }
        else if (mq && isColorTok(tokOf(mq[2]))) { qty = mq[1]; t = mq[2]; }
        var item = t; i++;
        while (i < toks.length && (MODIFIERS[tokOf(toks[i])] || (tokOf(t) === 'اوف' || tokOf(item) === 'اوف') && tokOf(toks[i]) === 'وايت')) { item += ' ' + toks[i]; i++; }
        if (tokOf(item) === 'اوفوايت') item = 'اوف وايت';
        items.push((qty ? qty + ' ' : '') + item);
      }
    });
    return items.filter(function (it) { return !FILLER_SET[tokOf(it)] && !FILLER_SET[stripArticle(tokOf(it))]; });
  }

  /* ---------- 4) الأرقام ---------- */
  var R_MOBILE = /(?<![\d])(?:(?:\+|00)?20[ \-.]*)?0?1[0125](?:[ \-.]*\d){8}(?![\d])/g;
  var R_LANDLINE = /(?<![\d])0[2-9](?:[ \-.]*\d){7,8}(?![\d])/g;
  function normPhone(s) {
    var d = s.replace(/\D/g, '');
    if (d.indexOf('0020') === 0) d = d.slice(4); else if (d.indexOf('20') === 0 && d.length >= 12) d = d.slice(2);
    if (d.charAt(0) !== '0') d = '0' + d;
    return d;
  }
  // رقم أرضي: "ارضي 24181759" (8 أرقام = القاهرة/الجيزة 02) أو بكود المحافظة
  var R_LAND_LBL = /(?:(?:تليفون|تلفون|رقم|ت)\s*)?(?:ارضي|ارضيه|landline|land\s*line)(?![\u0621-\u064a])\s*(?:رقم\s*)?[:.\/\-–=)(،,\s]*((?:\+|00)?(?:[ \-.]*\d){7,12})(?!\d)/g;
  function normLand(raw) {
    var d = raw.replace(/\D/g, '');
    if (/^(?:\+|00)/.test(raw.trim()) && /^(?:0020|20)/.test(d)) d = d.replace(/^(?:0020|20)/, '');
    if (d.charAt(0) === '0') return d.length >= 9 && d.length <= 11 ? d : '';
    if (d.length === 8) return '02' + d;
    if (d.length === 9 || d.length === 10) return '0' + d;
    if (d.length === 7) return d;
    return '';
  }
  function extractPhones(L) {
    var phones = [];
    L.forEach(function (ln) {
      if (ln.dead) return;
      var n = nz(ln.raw), m, spans = [];
      R_MOBILE.lastIndex = 0;
      while ((m = R_MOBILE.exec(n))) {
        var p = normPhone(m[0]);
        if (p.length === 11 && phones.indexOf(p) === -1) phones.push(p);
        spans.push([m.index, m.index + m[0].length]);
      }
      R_LAND_LBL.lastIndex = 0;
      while ((m = R_LAND_LBL.exec(n))) {
        var lp = normLand(m[1]);
        if (lp && phones.indexOf(lp) === -1) phones.push(lp);
        spans.push([m.index, m.index + m[0].length]);
      }
      R_LANDLINE.lastIndex = 0;
      while ((m = R_LANDLINE.exec(n))) {
        var lp2 = normLand(m[0]);
        if (lp2 && lp2.length >= 9 && phones.indexOf(lp2) === -1) phones.push(lp2);
        spans.push([m.index, m.index + m[0].length]);
      }
      // أرقام دولية تانية (+249...)
      var re = /\+\d{2,3}(?:[ \-.]*\d){7,11}/g;
      while ((m = re.exec(n))) { spans.push([m.index, m.index + m[0].length]); }
      spans.sort(function (a, b) { return b[0] - a[0]; });
      spans.forEach(function (sp) { ln.raw = ln.raw.slice(0, sp[0]) + ' ' + ln.raw.slice(sp[1]); });
      if (spans.length) { ln.raw = ln.raw.replace(/\s{2,}/g, ' '); ln.hadPhone = true; }
    });
    return phones;
  }

  var LABEL_WORDS = 'التواصل|التليفون|تليفون|الهاتف|هاتف|موبيل|الموبيل|موبايل|الموبايل|المحمول|الفون|فون|واتس\\s*اب|واتساب|واتس|للتواصل|التلفون|تلفون|ت|tel|phone|mobile|whatsapp';
  var PH_QUAL = '(?:اخر|اخري|اخرى|تاني|تانى|تانيه|ثاني|ثانى|التاني|الثاني|اضافي|اضافى|الاضافي|بديل|احتياطي|احتياطى|رئيسي|اساسي|الاساسي|الاول|اول|\\d)';
  var PH_LABEL = new RegExp('^\\s*(?:(?:رقمين|رقم|ارقام)(?![\\u0621-\\u064a])\\s*)?(?:(?:' + PH_QUAL + ')(?![\\u0621-\\u064a\\d])\\s*)?(?:(?:' + LABEL_WORDS + ')(?![\\u0621-\\u064a])\\s*)?(?:(?:' + PH_QUAL + ')(?![\\u0621-\\u064a\\d])\\s*)?(?:(?:مكتوب|مكتوبه)\\s*(?:بالانجليزي|بالانجليزى|انجليزي)\\s*)?(?:(?:ده|دي)\\s*(?:واتساب|واتس اب|واتس)\\s*(?:فقط)?\\s*)?[:.\\/\\-–)(،,\\s]*');

  // كلمة التليفون (+ اخر/تاني..) اللي فضلت في آخر السطر بعد شيل الرقم: "عماره 256 تليفون اخر 010..."
  var PH_TRAIL = new RegExp('\\s(?:(?:' + PH_QUAL + ')(?![\\u0621-\\u064a\\d])\\s*)?(?:' + LABEL_WORDS + '|رقمين|رقم|ارقام)(?![\\u0621-\\u064a])\\s*(?:(?:' + PH_QUAL + ')(?![\\u0621-\\u064a\\d])\\s*)?[:.\\/\\-–)(،,\\s]*$');

  /* ---------- 5) الأسعار ---------- */
  var NUMRE = /\d+(?:[.,]\d+)?/g;
  function nums(s) { return (nz(s).match(NUMRE) || []).map(function (x) { return parseFloat(x.replace(',', '.')); }); }
  function extractPrices(L) {
    var price = null, ship = null, total = null;
    L.forEach(function (ln) {
      if (ln.dead) return;
      var n = nz(ln.raw).replace(/[\u200b-\u200f]/g, ''), t = n.trim();
      if (!t) return;
      var hasTotal = /(^|[\s*_~(\-])(اجمالي|الاجمالي|اجمالى|اجمال|مجموع|المجموع|الكلي|المطلوب|الحساب)(?![\u0621-\u064a])/.test(n);
      var hasPrice = /^[\s*_~(\-]*(السعر|سعر|بسعر|المبلغ)(?![\u0621-\u064a])/.test(n);
      var hasShip = /(^|[\s*_~(+\-])(شحن|الشحن|توصيل|التوصيل|مصاريف|المصاريف)/.test(n);
      var numsIn = nums(n);
      var pureNum = /^[\s*+\-=:.]*\d+(?:[.,]\d+)?\s*(?:ج|جنيه|جم|egp|le)?\s*[.*]*$/.test(t);
      var plusShip = /^[\s*]*\+\s*\d+/.test(t);
      var pair = /^[\s*]*(\d+(?:[.,]\d+)?)\s*\+\s*(\d+(?:[.,]\d+)?)\s*(?:ج|جنيه)?[\s*]*$/.exec(t);
      if (pair && price == null) { price = parseFloat(pair[1]); ship = parseFloat(pair[2]); ln.dead = true; ln.kind = 'price'; return; }
      if (hasTotal && numsIn.length) { total = numsIn[0]; ln.dead = true; ln.kind = 'total'; return; }
      if (hasPrice && numsIn.length) {
        price = numsIn[0];
        if (numsIn.length > 1 && (hasShip || /\+/.test(n))) ship = numsIn[1];
        ln.dead = true; ln.kind = 'price'; return;
      }
      if (hasShip && numsIn.length && !/(\d{3,}\s*(قطع|قطعه))/.test(n) && t.length < 40) { ship = numsIn[0]; ln.dead = true; ln.kind = 'ship'; return; }
      if (plusShip && numsIn.length) { ship = numsIn[0]; ln.dead = true; ln.kind = 'ship'; return; }
      if (pureNum && price == null && numsIn[0] >= 20) { price = numsIn[0]; ln.dead = true; ln.kind = 'price'; return; }
    });
    return { price: price, ship: ship, total: total };
  }

  /* ---------- 6) بقية الدوال ---------- */
  var R_FOOT = /(بواسطه|بواسطة)/;
  var R_HDR = /تم\s*(?:ال)?\s*(?:تسجيل|تاكيد|تسجل)\s*(?:ال)?\s*(?:او?ردر|طلب|اوردر)?/;
  var R_NOTE = /^[\s]*(?:[*•]|ملحوظ|ملاحظ|note|\+{2,}|[-_=]{2,})/;
  var R_EDITED = /<this message was edited>|<تم تعديل هذه الرساله>|‎?<.*edited.*>/i;
  var ADDR_KW = /(^|\s)(شارع|ش|ميدان|عماره|عمارة|برج|دور|الدور|شقه|شقة|امام|بجوار|خلف|بجانب|بالقرب|قرب|متفرع|تقاطع|حي|مدينه|مركز|قريه|عزبه|كفر|نجع|مساكن|منطقه|محافظه|كمبوند|طريق|حاره|عطفه|مبني|مبنى|فيلا|فيلل|مول|بوابه|مجموعه|الحي|المنطقه|ناصيه|محل|مستشفي|مسجد|جامع|مدرسه|ابراج|روف|بدروم|اخر|اول)(\s|$)/;
  var R_L_NAME = /^\s*(?:\(\s*\d+\s*\)\s*)?(?:ال)?(?:اسم|إسم)(?:\s*(?:العميل|الشخص|المستلم|الكامل|بالكامل))?(?![\u0621-\u064a])\s*[:.\/\-–)(،,]*\s*/;
  var R_L_ADDR = /^\s*(?:ال)?(?:عنوان)(?:\s*(?:بالتفصيل|التفصيلي))?(?![\u0621-\u064a])\s*[:.\/\-–)(،,]*\s*/;
  var R_L_GOV = /^\s*(?:ال)?محافظ[هة]?(?![\u0621-\u064a])\s*[:.\/\-–)(،,]*\s*/;
  var R_L_AREA = /^\s*(?:ال)?(?:منطق[هة]|مركز)(?:\s*(?:او|\/)\s*(?:ال)?(?:مركز|منطق[هة]))?(?![\u0621-\u064a])\s*[:.\/\-–)(،,]*\s*/;
  var R_L_MARK = /^\s*(?:ال)?علام[هة](?:\s*(?:مميز[هة]|ممیزه))?(?![\u0621-\u064a])\s*[:.\/\-–)(،,]*\s*/;
  var R_L_FLOOR = /^\s*(?:ال)?دور(?:\s*(?:و|ورقم)\s*(?:ال)?(?:شق[هة]))?(?![\u0621-\u064a])\s*[:.\/\-–)(،,]*\s*/;

  function labelOf(ln) {
    var n0 = nz(ln.raw);
    var n = n0.replace(/^[\s.\-–—*•_~:،,)(\[\]]+/, '');   // نقطة أو شرطة قبل الليبل: ". الاسم ..."
    var lead = n0.length - n.length;
    var m;
    var L0 = labelOf0(n);
    return L0 ? { k: L0.k, len: L0.len + lead } : null;
  }
  function labelOf0(n) {
    var m;
    if ((m = R_L_NAME.exec(n))) return { k: 'name', len: m[0].length };
    if ((m = R_L_ADDR.exec(n))) return { k: 'addr', len: m[0].length };
    if ((m = R_L_GOV.exec(n)) && /^\s*(?:ال)?محافظ[هة]?\s*[:.\/\-–)(،,]/.test(n)) return { k: 'gov', len: m[0].length };
    if ((m = R_L_AREA.exec(n)) && /^\s*(?:ال)?(?:منطق[هة]|مركز)(?:\s*(?:او|\/)\s*(?:ال)?(?:مركز|منطق[هة]))?\s*[:.\/\-–)(،,]/.test(n)) return { k: 'area', len: m[0].length };
    if ((m = R_L_MARK.exec(n))) return { k: 'mark', len: m[0].length };
    if ((m = R_L_FLOOR.exec(n)) && /[:.\/\-–]/.test(n.slice(0, m[0].length + 1))) return { k: 'floor', len: m[0].length };
    return null;
  }

  function isPlaceOnly(line) { return Egypt.isPlaceOnly(line); }
  function nameLike(line) {
    var t = clean(line).replace(/[()\[\]{}"'*_~`.:،,؛;!?\-–—\/\\|=+]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t || t.length < 2 || /\d/.test(t)) return false;
    var toks = t.split(' ');
    if (toks.length > 6) return false;
    if (!/^[A-Za-z\u0621-\u064a\s]+$/.test(t)) return false;
    var n = nz(t);
    if (ADDR_KW.test(' ' + n + ' ')) return false;
    if (isPlaceOnly(t)) return false;
    if (colorish(t) || fillerOnly(t)) return false;
    return true;
  }

  function parseOrder(rawBody, brands, opts) {
    opts = opts || {};
    var issues = [], notes = [];
    var body = clean(rawBody).replace(R_EDITED, '').replace(/\u{1F4CC}\ufe0f?/gu, ' ');
    var L = body.split('\n').map(function (l, i) { return { raw: l.replace(/\s+$/, ''), orig: l.replace(/\s+$/, ''), idx: i, dead: false }; });

    // فوتر + ملاحظات
    L.forEach(function (ln) {
      var n = nz(ln.raw);
      if (R_FOOT.test(n) && /تم|بواسطه|بواسطة/.test(n)) ln.dead = true;
      else if (R_NOTE.test(ln.raw) && !/(سعر|شحن|اجمالي)/.test(n)) ln.dead = true;
      else if (/^[\s\p{P}\p{S}\p{Emoji_Presentation}\uFE0F]*$/u.test(ln.raw) && ln.raw.trim()) ln.dead = true;
    });

    // أول سطر فيه "تم تسجيل الاوردر"
    var hi = -1;
    for (var i = 0; i < L.length; i++) { if (!L[i].dead && R_HDR.test(nz(L[i].raw))) { hi = i; break; } }

    // البراند: الكلمات اللي قبل/في سطر الهيدر
    var brandWords = [], foundBrands = [];
    var zoneEnd = hi >= 0 ? hi : Math.min(L.length - 1, 1);
    for (var z = 0; z <= zoneEnd && z < L.length; z++) {
      var ln = L[z]; if (ln.dead) continue;
      var rawLine = ln.raw, nline = nz(rawLine), hm = R_HDR.exec(nline);
      var limit = (z === hi && hm) ? hm.index : rawLine.length;
      var zone = rawLine.slice(0, limit), rest = rawLine.slice(limit);
      var out = zone.replace(/\S+/g, function (w) {
        var b = matchBrand(w, brands);
        if (b) { if (foundBrands.indexOf(b.sheet) === -1) foundBrands.push(b.sheet); brandWords.push(w); return ' '; }
        if (/^واتس(?:اب|آب)?$/.test(nz(clean(w)))) return ' ';
        return w;
      });
      ln.raw = (out + rest).replace(/\s{2,}/g, ' ');
      if (z !== hi && !ln.raw.replace(/[\s،,.\-–]+/g, '')) ln.dead = true;
    }
    if (hi >= 0 && !L[hi].raw.trim()) { L[hi].dead = true; }
    var brand = null;
    if (foundBrands.length === 1) brand = foundBrands[0];
    else if (foundBrands.length > 1) issues.push('مكتوب اسم أكتر من شيت (' + foundBrands.join(' / ') + ')');
    else if (opts.defaultBrand) { brand = opts.defaultBrand; }
    else issues.push('مفيش اسم شيت في الرسالة');

    // الأسعار والأرقام
    var phones = extractPhones(L);
    var pr = extractPrices(L);
    L.forEach(function (ln) { if (ln.dead) return; var n = nz(ln.raw), m = PH_LABEL.exec(n); if (m && m[0].trim()) { if (!n.slice(m[0].length).trim()) ln.dead = true; else if (ln.hadPhone) ln.raw = ln.raw.slice(m[0].length); }
      if (!ln.dead && ln.hadPhone) { var tr = PH_TRAIL.exec(nz(ln.raw)); if (tr && tr.index > 0 && tr[0].trim()) ln.raw = ln.raw.slice(0, tr.index).replace(/\s+$/, ''); } });

    // أول سطر حي بعد إزالة اللي اتشال
    var live = function () { return L.filter(function (l) { return !l.dead && l.raw.trim(); }); };
    // سطر الهيدر: نفصل العبارة
    var descLines = [], hdrRest = '';
    var hdrLine = (hi >= 0 && !L[hi].dead) ? L[hi] : null;
    var detailsIdx = {};
    var PRODUCT = /(قطع|قطعه|قطعتين|عرض|عرضين|تلبيس|بندان|طرح|طرحه|طباقي|ايزي|سكارف|اسكارف|وشاح|شال|حجاب|\d+\s*(?:ق|قطع))/;
    if (!hdrLine) {
      // مفيش "تم تسجيل": أول سطر فيه كلمة منتج (مش ليبل ولا عنوان)، وإلا أول سطر مش اسم/عنوان
      var liveLines = L.filter(function (l) { return !l.dead && l.raw.trim(); });
      var pick = liveLines.filter(function (l) { var n3 = nz(l.raw); return !labelOf(l) || /^\s*(?:ال)?الوان/.test(n3) ? PRODUCT.test(n3) && !(ADDR_KW.test(' ' + n3 + ' ') && !/قطع|عرض/.test(n3)) : false; })[0]
        || liveLines.filter(function (l) { return !labelOf(l) && !nameLike(l.raw) && !ADDR_KW.test(' ' + nz(l.raw) + ' ') && !isPlaceOnly(l.raw); })[0]
        || liveLines[0];
      hdrLine = pick || null;
      if (hdrLine) hdrRest = hdrLine.raw.trim().replace(/^\s*(?:ال)?[اأ]لوان\s*[:\/\-.]*\s*/, '');
    } else {
      var nh = nz(hdrLine.raw), mh = R_HDR.exec(nh);
      hdrRest = hdrLine.raw.slice(mh.index + mh[0].length).replace(/^\s*[:\-–.،,]*\s*/, '');
      if (opts.stripRegPhrase === false) hdrRest = hdrLine.raw.slice(mh.index).trim();
      var before = hdrLine.raw.slice(0, mh.index).trim();
      if (before.replace(/[\s،,.\-–]+/g, '')) { /* نص قبل العبارة في نفس السطر: نسيبه عميل */ hdrLine.pre = before; }
    }
    // كتلة التفاصيل: الأسطر التالية بدون فراغ
    var hdrPos = hdrLine ? L.indexOf(hdrLine) : -1;
    var contLines = [];
    if (hdrLine) {
      detailsIdx[hdrPos] = true;
      var j = hdrPos + 1, blankSeen = false, stopped = false;
      while (j < L.length && !stopped) {
        var cl = L[j];
        if (cl.dead && cl.kind) { j++; if (blankSeen) { } continue; }
        if (cl.dead) { j++; continue; }
        if (!cl.raw.trim()) { blankSeen = true; j++; continue; }
        var lab = labelOf(cl);
        var n2 = nz(cl.raw);
        var addrish = ADDR_KW.test(' ' + n2 + ' ') || isPlaceOnly(cl.raw);
        var isCol = colorish(cl.raw) || fillerOnly(cl.raw);
        var isProd = PRODUCT.test(n2) && !(addrish && !/قطع|عرض/.test(n2));
        if (lab || (addrish && !isCol && !isProd)) break;
        if (!isCol && !isProd && nameLike(cl.raw)) break;
        if (!blankSeen || isCol || isProd) { contLines.push(cl); detailsIdx[j] = true; j++; blankSeen = false; continue; }
        break;
      }
    }
    // لو الهيدر ملوش باقي في نفس السطر، والأسطر دي مفيهاش حاجة
    // ----- تجهيز نص التفاصيل
    var detailsText = '';
    // التفاصيل = اللي بعد "تم تسجيل الاوردر" زي ما هو بالظبط (من غير أي parsing أو تغيير في الألوان/الأرقام/الكلمات)
    (function () {
      var parts = [];
      var d = hdrRest.replace(/\s+$/, '').trim();
      if (d) parts.push(d);
      contLines.forEach(function (cl) {
        var t = (cl.hadPhone ? cl.raw : (cl.orig != null ? cl.orig : cl.raw)).replace(/\s+$/, '').trim();
        if (t) parts.push(t);
      });
      detailsText = parts.join('\n').trim();
    })();

    // العميل: كل الأسطر اللي مش تفاصيل ومش ميتة
    var cust = [];
    L.forEach(function (ln, ix) { if (!ln.dead && !detailsIdx[ix] && ln.raw.trim()) cust.push(ln); });
    if (hdrLine && hdrLine.pre) cust.unshift({ raw: hdrLine.pre, dead: false });

    var name = '', govLabel = '', areaLabel = '', addrParts = [], used = [];
    // نقسم الأسطر اللي فيها ليبل جوه السطر (اسم .. العنوان .. المحافظة ..)
    (function () {
      var out = [];
      cust.forEach(function (ln) {
        var n = nz(ln.raw), cuts = [], re = /(?:^|\s)((?:ال)?(?:عنوان|محافظ[هة])(?![\u0621-\u064a])|(?:ال)?(?:منطق[هة]|مركز|علام[هة])(?![\u0621-\u064a])(?=\s*[:\-]))/g, m;
        while ((m = re.exec(n))) { var at = m.index + (m[0].length - m[1].length); if (at > 0 && n.slice(0, at).trim()) cuts.push(at); }
        if (!cuts.length) { out.push(ln); return; }
        var prev = 0;
        cuts.concat([ln.raw.length]).forEach(function (cpos) { var part = ln.raw.slice(prev, cpos).trim(); if (part) out.push({ raw: part, dead: false }); prev = cpos; });
      });
      cust = out;
    })();
    // الليبلز
    for (var c = 0; c < cust.length; c++) {
      var cl2 = cust[c], lb = labelOf(cl2);
      if (!lb) continue;
      var val = cl2.raw.slice(lb.len).trim().replace(/^[:.\-–/،,\s]+/, '');
      if (!val) {
        var nx = cust[c + 1];
        if (nx && !labelOf(nx) && (lb.k === 'name' || lb.k === 'addr' || lb.k === 'gov' || lb.k === 'area')) { val = nx.raw.trim(); used.push(nx); }
      }
      used.push(cl2);
      if (lb.k === 'name') {
        var tk = val.split(/\s+/), cutAt = -1;
        if (tk.length > 2) for (var q = 1; q < tk.length; q++) { var w1 = nz(tk[q]).replace(/[^a-z0-9\u0621-\u064a]/g, ''); if (ADDR_KW.test(' ' + w1 + ' ') || Egypt.isPlaceOnly(tk[q])) { cutAt = q; break; } }
        if (cutAt > 1 && /^[A-Za-z\u0621-\u064a\s.]+$/.test(tk.slice(0, cutAt).join(' '))) { addrParts.push(tk.slice(cutAt).join(' ')); val = tk.slice(0, cutAt).join(' '); }
        if (!name) name = val; else addrParts.push(val);
      }
      else if (lb.k === 'gov') { govLabel = val; addrParts.push(val); }
      else if (lb.k === 'area') { areaLabel = val; addrParts.push(val); }
      else if (lb.k === 'addr') { if (val) addrParts.push(val); }
      else if (lb.k === 'mark') { if (val) addrParts.push('علامة مميزة: ' + val); }
      else if (lb.k === 'floor') { if (val) addrParts.push('الدور: ' + val); }
    }
    // الاسم بدون ليبل
    var others = cust.filter(function (x) { return used.indexOf(x) === -1; });
    if (!name) {
      var nl = others.filter(function (x) { return nameLike(x.raw); });
      if (nl.length) {
        name = nl[0].raw.trim(); used.push(nl[0]);
        if (nl.length > 1) notes.push('فيه أكتر من سطر شبه اسم، اخترت الأول');
      }
    }
    name = clean(name).replace(/^\s*\(\s*\d+\s*\)\s*/, '').replace(/[()\[\]*_~]+/g, ' ').replace(/\s+/g, ' ').replace(/[.:\-–،,\s]+$/, '').trim();
    // باقي الأسطر عنوان
    cust.forEach(function (x) {
      if (used.indexOf(x) !== -1) return;
      var t = x.raw.trim().replace(/^[:.\-–/،,\s]+|[\s.\-–،,]+$/g, '');
      t = t.replace(/^(?:و|and)\s+/i, '').replace(/\s+(?:و|and)$/i, '');
      if (t && !/^(?:و|and)$/i.test(t) && !/^[()\[\]{}.,\s]+$/.test(t)) addrParts.push(t);
    });
    var address = addrParts.filter(Boolean).join(' - ').replace(/\s{2,}/g, ' ').trim();

    // المحافظة والمنطقة
    var rs = Egypt.resolve({ govLabel: govLabel, areaLabel: areaLabel, address: address });
    rs.issues.forEach(function (x) { issues.push(x); });

    // الأرقام
    var price = pr.price, ship = pr.ship, total = pr.total;
    if (price == null && total != null && ship != null) { price = total - ship; notes.push('السعر اتحسب من الإجمالي - الشحن'); }
    if (price != null && ship == null && total != null) { ship = total - price; }
    if (price == null) issues.push('السعر مش موجود');
    if (ship == null) issues.push('الشحن مش موجود');
    if (total == null && price != null && ship != null) { /* مقبول: الإجمالي بيتحسب */ }
    if (price != null && ship != null && total != null && Math.abs(price + ship - total) > 0.001)
      issues.push('الحساب مش مظبوط: السعر ' + price + ' + الشحن ' + ship + ' ≠ الإجمالي ' + total);

    // رقم أرضي من 7 أرقام (من غير كود): نضيف كود المحافظة بعد ما اتحددت
    var LAND_CODES = { 'الاسكندريه': '03', 'البحيره': '045', 'الغربيه': '040', 'الدقهليه': '050', 'الشرقيه': '055', 'المنوفيه': '048', 'كفر الشيخ': '047', 'دمياط': '057', 'بورسعيد': '066', 'الاسماعيليه': '064', 'السويس': '062', 'الفيوم': '084', 'بني سويف': '082', 'المنيا': '086', 'اسيوط': '088', 'سوهاج': '093', 'قنا': '096', 'الاقصر': '095', 'اسوان': '097', 'مطروح': '046', 'البحر الاحمر': '065', 'شمال سيناء': '068', 'جنوب سيناء': '069', 'الوادي الجديد': '092' };
    var landCode = LAND_CODES[nz(rs.gov || '').trim()];
    if (landCode) phones = phones.map(function (p) { return /^\d{7}$/.test(p) ? landCode + p : p; });

    var o = {
      brand: brand || '', brandWords: brandWords.join(' '), name: name, phone: phones.join(' / '), gov: rs.gov, area: rs.area,
      address: address, details: detailsText, price: price, shipping: ship, total: total, govSource: rs.source,
      issues: issues, notes: notes, raw: rawBody
    };
    return validate(o, opts);
  }

  // بيراجع الأوردر (بيتنادى تاني بعد تعديل المستخدم)
  // المحافظات اللي لازم فيها منطقة (باقي المحافظات مش لازم). عدّل القايمة دي لو احتجت.
  var AREA_REQUIRED = { 'القاهره': 1, 'الجيزه': 1, 'الاسكندريه': 1 };

  function validate(o, opts) {
    opts = opts || {};
    var keepIssues = (o._parseIssues || o.issues || []).filter(function (x) { return /(المحافظة|محافظة|المنطقة|مفيش اسم شيت|اسم أكتر من شيت|مقدرتش أعرف)/.test(x); });
    if (!o._parseIssues) o._parseIssues = o.issues.slice();
    var out = [];
    var gov = (o.gov || '').trim();
    if (!(o.name || '').trim()) out.push('الاسم مش موجود');
    else if (/\d/.test(o.name)) out.push('الاسم فيه أرقام');
    var phones = String(o.phone || '').split(/[\/\n،,]+/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (!phones.length) out.push('رقم الموبايل مش موجود');
    phones.forEach(function (p) { if (!/^01[0125]\d{8}$/.test(p) && !/^0[2-9]\d{7,9}$/.test(p)) out.push('رقم غلط: ' + p); });   // موبايل أو أرضي (كود المحافظة + الرقم)
    if (!(o.address || '').trim()) out.push('العنوان مش موجود');
    else if (!(o.area || '').trim() && AREA_REQUIRED[nz(gov).trim()]) out.push('المنطقة / المركز مش موجودة');   // مطلوبة بس في المحافظات الكبيرة؛ باقي المحافظات ممكن من غيرها (أو بنفس اسم المحافظة)
    if (!(o.details || '').trim()) out.push('تفاصيل الأوردر مش موجودة');
    if (!gov) out.push('المحافظة مش معروفة');
    if (!o.brand) out.push('الشيت مش متحدد');
    if (typeof o.price !== 'number' || isNaN(o.price)) out.push('السعر مش موجود');
    if (typeof o.shipping !== 'number' || isNaN(o.shipping)) out.push('الشحن مش موجود');
    if (typeof o.total === 'number' && typeof o.price === 'number' && typeof o.shipping === 'number' && Math.abs(o.price + o.shipping - o.total) > 0.001)
      out.push('الحساب مش مظبوط: السعر ' + o.price + ' + الشحن ' + o.shipping + ' ≠ الإجمالي ' + o.total);
    // مشاكل التحليل الأصلية اللي لسه صالحة (تعارض محافظة/منطقة، اسم شيت ...)
    (o._parseIssues || []).forEach(function (x) {
      if (/(تابعة|أكتر من محافظة|اسم أكتر من شيت)/.test(x) && out.indexOf(x) === -1) out.push(x);
    });
    // نشيل المكرر
    var seen = {}; o.issues = out.filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; });
    return o;
  }

  /* ---------- 7) كل الشات ---------- */
  function isOrderMessage(text) {
    var t = clean(text), n = nz(t);
    if (t.length < 25) return false;
    var marker = R_HDR.test(n) || t.indexOf('\u{1F4CC}') !== -1;
    var priceKw = /(سعر|السعر|شحن|اجمالي|الاجمالي|توصيل)/.test(n);
    var phone = (function () { R_MOBILE.lastIndex = 0; return R_MOBILE.test(n); })();
    return marker && (priceKw || phone);
  }

  function parseChat(text, brands, opts) {
    var msgs = splitMessages(text), orders = [], seen = {}, ignored = 0;
    msgs.forEach(function (m) {
      if (!m.sender || !isOrderMessage(m.text)) { ignored++; return; }
      var o = parseOrder(m.text, brands, opts);
      o.sender = m.sender;
      var key = [o.phone, o.details, o.price].join('|');
      o.duplicate = !!seen[key] && !!o.phone && !!o.details;
      seen[key] = true;
      if (o.duplicate) o.issues.push('مكرر: نفس الرقم والتفاصيل اتسجل قبل كده');
      o.ok = o.issues.length === 0;
      o.include = o.ok;
      orders.push(o);
    });
    return { totalMessages: msgs.length, ignored: ignored, orders: orders };
  }

  /* ---------- 8) فلترة بالتاريخ والوقت (مستقلة تمامًا عن التحليل — بتقص نص الشات بس قبل التحليل) ---------- */
  var HEADT = new RegExp('^\\[?(' + D + '{1,4})[\\/.\\-](' + D + '{1,2})[\\/.\\-](' + D + '{1,4})\\s*[,،]?\\s+(' + D + '{1,2})[:.](' + D + '{2})(?:[:.]' + D + '{2})?\\s*(?:([AaPp])\\.?\\s?[Mm]\\.?|([صم]))?');
  function dnum(s) { return parseInt(String(s).replace(/[\u0660-\u0669]/g, function (c) { return c.charCodeAt(0) - 0x660; }).replace(/[\u06f0-\u06f9]/g, function (c) { return c.charCodeAt(0) - 0x6f0; }), 10); }
  function chatStamps(text) {
    var lines = String(text).replace(/^\ufeff/, '').split(/\r?\n/), raw = [], bMax = 0, i, m;
    for (i = 0; i < lines.length; i++) {
      m = HEADT.exec(lines[i].replace(INVISIBLE, '')); if (!m) continue;
      var r = { i: i, a: dnum(m[1]), b: dnum(m[2]), c: dnum(m[3]), h: dnum(m[4]), mi: dnum(m[5]), ap: m[6] || m[7] || '' };
      if (r.a <= 31 && r.b > bMax) bMax = r.b; raw.push(r);
    }
    var mdy = bMax > 12, list = [], tmap = {};
    raw.forEach(function (r) {
      var y, mo, d, h = r.h;
      if (r.a > 31) { y = r.a; mo = r.b; d = r.c; } else { y = r.c < 100 ? 2000 + r.c : r.c; if (mdy) { mo = r.a; d = r.b; } else { d = r.a; mo = r.b; } }
      if (r.ap && h <= 12) h = h % 12 + (/[Pp]|م/.test(r.ap) ? 12 : 0);
      var t = new Date(y, mo - 1, d, h, r.mi).getTime(); if (isNaN(t)) return;
      list.push({ i: r.i, t: t }); tmap[r.i] = t;
    });
    var ts = list.map(function (x) { return x.t; });
    return { lines: lines, list: list, tmap: tmap, first: ts.length ? Math.min.apply(null, ts) : null, last: ts.length ? Math.max.apply(null, ts) : null };
  }
  // يرجّع نص الشات من أول رسالة وقتها >= ms (أي رسالة قبلها تتمسح). سطور الرسالة الواحدة بتتبع هيدرها.
  function cutFrom(st, ms) {
    var keep = false, out = [], n = 0;
    for (var i = 0; i < st.lines.length; i++) {
      if (st.tmap[i] !== undefined) { keep = st.tmap[i] >= ms; if (keep) n++; }
      if (keep) out.push(st.lines[i]);
    }
    return { text: out.join('\n'), count: n };
  }

  g.Chat = { chatStamps: chatStamps, cutFrom: cutFrom, splitMessages: splitMessages, parseOrder: parseOrder, parseChat: parseChat, validate: validate, matchBrand: matchBrand, isOrderMessage: isOrderMessage, nz: nz, clean: clean, splitColors: splitColors };
})(typeof window !== 'undefined' ? window : globalThis);
