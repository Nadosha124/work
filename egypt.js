/* egypt.js — محافظات مصر + المراكز/المدن/الأحياء، وربط العنوان بالمحافظة والمنطقة
   تقدر تزوّد أي مركز/منطقة في الليستة اللي تحت (كل سطر: "المحافظة": ["مركز", "مدينة", ...]). */
(function (g) {
  'use strict';

  var DATA = {
    'القاهرة': ['جسر السويس', 'حي السفارات', 'السفارات', 'حلمية الزيتون', 'حلمية الزتون', 'التجمع الاول', 'التجمع التالت', 'التجمع الثالث', 'التجمع الخامس', 'القاهرة الجديدة', 'مدينتي', 'التجمع الخامس', 'التجمع الاول', 'التجمع الثالث', 'القاهرة الجديدة', 'الرحاب', 'مدينتي', 'الشروق', 'بدر', 'مدينة نصر', 'مصر الجديدة', 'هليوبوليس', 'النزهة', 'النزهة الجديدة', 'المعادي', 'حدائق المعادي', 'زهراء المعادي', 'دار السلام', 'البساتين', 'المقطم', 'حلوان', '15 مايو', 'التبين', 'طره', 'المعصرة', 'مصر القديمة', 'السيدة زينب', 'الخليفة', 'الدرب الاحمر', 'الجمالية', 'الازبكية', 'الموسكي', 'باب الشعرية', 'وسط البلد', 'عابدين', 'بولاق ابو العلا', 'الزمالك', 'المنيل', 'شبرا', 'روض الفرج', 'الشرابية', 'الزيتون', 'المطرية', 'عين شمس', 'حدائق القبة', 'الوايلي', 'العباسية', 'الاميرية', 'السلام', 'مدينة السلام', 'المرج', 'الزاوية الحمراء', 'الف مسكن', 'القطامية', 'منشية ناصر', 'اول مدينة نصر', 'ثان مدينة نصر', 'مساكن الزلزال', 'عزبة النخل', 'الماظة', 'كوبري القبة', 'مدينة بدر', 'الشروق', 'العاصمة الادارية', 'الحي الثامن', 'الحي العاشر', 'الدويقة', 'الجبل الاخضر', 'منشية الصدر', 'الدمرداش', 'مصر الجديده', 'القبه', 'ح القبه', 'غمره', 'م نصر', 'مساكن شيراتون', 'شيراتون', 'رمسيس', 'ارض الجولف', 'الف مسكن'],
    'الجيزة': ['هضبة الاهرام', 'هضبه الاهرام', 'الهرم', 'فيصل', 'العجوزة', 'الدقي', 'المهندسين', 'الجيزة', 'امبابة', 'بولاق الدكرور', 'الوراق', 'الشيخ زايد', 'السادس من اكتوبر', '6 اكتوبر', 'اكتوبر', 'حدائق الاهرام', 'حدايق الاهرام', 'حدايق اهرام', 'حدائق اكتوبر', 'العمرانية', 'الطالبية', 'المنيب', 'ابو النمرس', 'اوسيم', 'كرداسة', 'البدرشين', 'العياط', 'الصف', 'اطفيح', 'الحوامدية', 'الواحات البحرية', 'منشأة القناطر', 'ساقية مكي', 'ناهيا', 'كفر طهرمس', 'الكيت كات', 'ميت عقبة', 'المنصورية', 'نزلة السمان', 'ارض اللواء', 'وراق العرب', 'الحي المتميز', 'دريم لاند', 'الرماية', 'الشيخ زايد', 'بشتيل', 'الجيزه', 'سقارة', 'القرية الذكية', 'الحصري', 'المريوطية', 'ترسا', 'الطوابق', 'كعبيش', 'الهرم الجديد'],
    'الإسكندرية': ['المنتزه', 'سيدي بشر', 'العصافرة', 'ميامي', 'المندرة', 'العجمي', 'الدخيلة', 'العامرية', 'برج العرب', 'برج العرب الجديدة', 'محرم بك', 'كرموز', 'اللبان', 'الجمرك', 'الورديان', 'القباري', 'الابراهيمية', 'سموحة', 'كفر عبده', 'رشدي', 'جليم', 'سيدي جابر', 'الشاطبي', 'الازاريطة', 'باكوس', 'محطة الرمل', 'ستانلي', 'سان ستيفانو', 'فليمنج', 'زيزينيا', 'لوران', 'كليوباترا', 'بولكلي', 'الظاهرية', 'ابو قير', 'المعمورة', 'الهانوفيل', 'البيطاش', 'مصطفى كامل', 'السيوف', 'الحضرة', 'كامب شيزار', 'سيدي كرير', 'النزهة', 'وسط الاسكندرية', 'اسكندرية'],
    'القليوبية': ['بنها', 'شبرا الخيمة', 'الخانكة', 'قليوب', 'القناطر الخيرية', 'شبين القناطر', 'طوخ', 'كفر شكر', 'العبور', 'الخصوص', 'ابو زعبل', 'مسطرد', 'قها', 'ميت نما', 'العبور الجديدة', 'كفر الجزار', 'الخلفاوي', 'بهتيم', 'ترعة بنها'],
    'الدقهلية': ['المنصورة', 'طلخا', 'ميت غمر', 'دكرنس', 'اجا', 'السنبلاوين', 'المنزلة', 'بلقاس', 'شربين', 'المطرية', 'الجمالية', 'منية النصر', 'بني عبيد', 'تمي الامديد', 'نبروه', 'ميت سلسيل', 'جمصة', 'الكردي', 'محلة دمنة', 'منية سمنود', 'اجا', 'الجمالية', 'ميت ابو غالب', 'بلقاس', 'المنصوره الجديدة', 'طلخا'],
    'الغربية': ['طنطا', 'المحلة الكبرى', 'المحلة', 'كفر الزيات', 'زفتى', 'السنطة', 'بسيون', 'قطور', 'سمنود', 'محلة روح', 'محلة مرحوم'],
    'المنوفية': ['شبين الكوم', 'مدينة السادات', 'السادات', 'منوف', 'اشمون', 'الباجور', 'قويسنا', 'بركة السبع', 'تلا', 'الشهداء', 'سرس الليان', 'منوف'],
    'البحيرة': ['دمنهور', 'كفر الدوار', 'رشيد', 'ادكو', 'ابو المطامير', 'ابو حمص', 'الدلنجات', 'المحمودية', 'الرحمانية', 'ايتاي البارود', 'حوش عيسى', 'شبراخيت', 'كوم حمادة', 'بدر', 'وادي النطرون', 'النوبارية', 'النوبارية الجديدة', 'كفر الدوار'],
    'كفر الشيخ': ['كفر الشيخ', 'دسوق', 'فوه', 'مطوبس', 'بيلا', 'الحامول', 'بلطيم', 'سيدي سالم', 'قلين', 'الرياض', 'برج البرلس', 'مصيف بلطيم', 'البرلس'],
    'دمياط': ['دمياط', 'دمياط الجديدة', 'فارسكور', 'كفر سعد', 'الزرقا', 'راس البر', 'كفر البطيخ', 'السرو', 'عزبة البرج', 'الروضة'],
    'بورسعيد': ['بورفؤاد', 'بور فؤاد', 'بورسعيد'],
    'الإسماعيلية': ['الاسماعيلية', 'فايد', 'القنطرة شرق', 'القنطرة غرب', 'التل الكبير', 'ابو صوير', 'القصاصين', 'التل الكبير'],
    'السويس': ['السويس', 'الاربعين', 'عتاقة', 'الجناين', 'راس سدر'],
    'الشرقية': ['الزقازيق', 'العاشر من رمضان', 'بلبيس', 'منيا القمح', 'ابو كبير', 'فاقوس', 'ههيا', 'ديرب نجم', 'الحسينية', 'كفر صقر', 'ابو حماد', 'مشتول السوق', 'الابراهيمية', 'القنايات', 'صان الحجر', 'الصالحية الجديدة', 'القرين', 'الصالحية', 'الاسماعيلية الجديدة', 'اولاد صقر', 'ههيا'],
    'شمال سيناء': ['العريش', 'الشيخ زويد', 'رفح', 'بئر العبد', 'الحسنة', 'نخل'],
    'جنوب سيناء': ['شرم الشيخ', 'الطور', 'دهب', 'نويبع', 'طابا', 'سانت كاترين', 'راس سدر', 'ابو زنيمة', 'ابو رديس'],
    'الفيوم': ['الفيوم', 'سنورس', 'طامية', 'ابشواي', 'اطسا', 'يوسف الصديق', 'الفيوم الجديدة', 'كيمان فارس'],
    'بني سويف': ['بني سويف', 'الواسطى', 'اهناسيا', 'ببا', 'الفشن', 'سمسطا', 'بني سويف الجديدة', 'ببا'],
    'المنيا': ['المنيا', 'المنيا الجديدة', 'العدوة', 'مغاغة', 'بني مزار', 'مطاي', 'سمالوط', 'ابو قرقاص', 'ملوي', 'دير مواس', 'ديرمواس'],
    'أسيوط': ['اسيوط', 'ديروط', 'القوصية', 'ابنوب', 'ابو تيج', 'الغنايم', 'ساحل سليم', 'البداري', 'صدفا', 'منفلوط', 'اسيوط الجديدة'],
    'سوهاج': ['سوهاج', 'اخميم', 'اولاد طوق', 'البلينا', 'المراغة', 'المنشاة', 'دار السلام', 'جرجا', 'جهينة', 'ساقلتة', 'طما', 'طهطا', 'الكوثر', 'سوهاج الجديدة'],
    'قنا': ['قنا', 'ابو تشت', 'نجع حمادي', 'دشنا', 'الوقف', 'قفط', 'نقادة', 'فرشوط', 'قوص', 'نجع حماد'],
    'الأقصر': ['الاقصر', 'الاقصر الجديدة', 'ارمنت', 'الطود', 'اسنا', 'البياضية', 'القرنة', 'الزينية', 'طيبة الجديدة'],
    'أسوان': ['اسوان', 'ادفو', 'كوم امبو', 'دراو', 'نصر النوبة', 'كلابشة', 'ابو سمبل', 'اسوان الجديدة', 'البصيلية', 'الرديسية', 'كلح', 'السباعية'],
    'البحر الأحمر': ['الغردقة', 'راس غارب', 'سفاجا', 'القصير', 'مرسى علم', 'الشلاتين', 'حلايب', 'الجونة'],
    'الوادي الجديد': ['الخارجة', 'الداخلة', 'الفرافرة', 'باريس', 'بلاط', 'موط'],
    'مطروح': ['مرسى مطروح', 'الحمام', 'العلمين', 'الضبعة', 'النجيلة', 'سيدي براني', 'السلوم', 'سيوة', 'راس الحكمة', 'مطروح']
  };

  // أسماء إضافية للمحافظة نفسها (اللي بتتكتب في العنوان)
  var GOV_ALIAS = {
    'القاهرة': ['القاهره', 'قاهره', 'كايرو'],
    'الجيزة': ['الجيزه', 'جيزه'],
    'الإسكندرية': ['الاسكندريه', 'اسكندريه', 'الاسكندرية', 'اسكندرية', 'اسكندريه', 'الاسكنديه', 'اسكنديه'],
    'القليوبية': ['القليوبيه', 'قليوبيه'], 'الدقهلية': ['الدقهليه', 'دقهليه', 'الدقهلية'], 'الغربية': ['الغربيه', 'غربيه'],
    'المنوفية': ['المنوفيه', 'منوفيه'], 'البحيرة': ['البحيره', 'بحيره'], 'كفر الشيخ': ['كفر الشيخ', 'كفرالشيخ'],
    'دمياط': ['دمياط'], 'بورسعيد': ['بورسعيد', 'بور سعيد'], 'الإسماعيلية': ['الاسماعيليه', 'اسماعيليه', 'الاسماعيلية'],
    'السويس': ['السويس'], 'الشرقية': ['الشرقيه', 'شرقيه'], 'شمال سيناء': ['شمال سيناء'], 'جنوب سيناء': ['جنوب سيناء'],
    'الفيوم': ['الفيوم'], 'بني سويف': ['بني سويف', 'بنى سويف'], 'المنيا': ['المنيا'], 'أسيوط': ['اسيوط'], 'سوهاج': ['سوهاج'],
    'قنا': ['قنا'], 'الأقصر': ['الاقصر'], 'أسوان': ['اسوان'], 'البحر الأحمر': ['البحر الاحمر'],
    'الوادي الجديد': ['الوادي الجديد', 'الوادى الجديد'], 'مطروح': ['مطروح', 'مرسي مطروح']
  };
  // أسماء المحافظات اللي ممكن تكون صفة عادية في العنوان (المنطقة الغربية) — مش بنعتمدها غير لو مكتوبة صريحة
  var RISKY_GOV = { 'الغربية': 1, 'الشرقية': 1 };
  // أسماء بتتكرر كثير كأسماء شوارع/ميادين — بنتجاهلها لو جاية بعد كلمة شارع/ميدان
  var STREET_CTX = { 'شارع': 1, 'ش': 1, 'ميدان': 1, 'حاره': 1, 'عطفه': 1, 'كوبري': 1, 'طريق': 1, 'نفق': 1, 'مسجد': 1, 'جامع': 1, 'مدرسه': 1, 'مستشفي': 1, 'صيدليه': 1, 'كنيسه': 1, 'بنك': 1, 'محل': 1, 'سوبر': 1, 'كافيه': 1, 'مخبز': 1, 'عمارات': 1, 'عماره': 1, 'ابراج': 1, 'ماركت': 1, 'معرض': 1, 'مكتب': 1, 'هايبر': 1, 'فرن': 1, 'مطعم': 1, 'جمعيه': 1, 'ستي': 1, 'سيتي': 1, 'جسر': 1, 'قناه': 1, 'ترعه': 1, 'محور': 1, 'مترو': 1, 'ساحه': 1 };
  // أماكن/مؤسسات (مش شوارع): "ارض الجمعية امبابة" — لو مفيش أي دليل تاني نعتمد اسم المنطقة اللي بعدها
  var SOFT_CTX = { 'جمعيه': 1, 'عمارات': 1, 'ابراج': 1, 'ماركت': 1, 'معرض': 1, 'مكتب': 1, 'هايبر': 1, 'فرن': 1, 'مطعم': 1, 'محل': 1, 'سوبر': 1, 'كافيه': 1, 'مخبز': 1, 'بنك': 1, 'صيدليه': 1, 'مدرسه': 1, 'مستشفي': 1, 'كنيسه': 1, 'مسجد': 1, 'جامع': 1, 'ستي': 1, 'سيتي': 1 };
  var RELAX_STREET = false;
  var AREA_KW = { 'مركز': 1, 'مدينه': 1, 'حي': 1, 'قسم': 1, 'منطقه': 1 };

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
  // كلمات من غير "ال" التعريف
  function words(s) {
    var ws = nz(s).replace(/([\u0621-\u064a])(\d)/g, '$1 $2').replace(/(\d)([\u0621-\u064a])/g, '$1 $2').replace(/([a-z])([\u0621-\u064a])/g, '$1 $2').replace(/([\u0621-\u064a])([a-z])/g, '$1 $2').replace(/[^a-z0-9\u0621-\u064a]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    // حرف لوحده (ي/ه) اتفصل عن آخر الكلمة: "المعاد ى" -> "المعادي"
    var merged = [];
    ws.forEach(function (w) {
      if ((w === 'ي' || w === 'ه') && merged.length && /^[\u0621-\u064a]{3,}$/.test(merged[merged.length - 1])) merged[merged.length - 1] += w;
      else merged.push(w);
    });
    merged = merged.filter(function (w) { return !(w === 'el' || w === 'al'); });
    return merged.map(function (w) {
      w = w.replace(/^(?:بال|وال|فال|كال|لل)(?=[\u0621-\u064a]{3})/, '');
      // حرف متكرر (تطويل): "القاااهره" -> "القاهره" (للحروف العربي بس)
      w = w.replace(/([\u0621-\u064a])\1+/g, '$1');
      return w.length > 3 && w.indexOf('ال') === 0 ? w.slice(2) : w;
    });
  }

  // فهرس: كلمات -> [{gov, label}]

  // ======== أماكن إضافية: بتتحمّل من places-extra.js ========
  (function mergeExtra() {
    var keyOf = function (t) { return words(t).join(' '); };
    var seen = {};   // مفتاح -> مجموعة المحافظات
    Object.keys(DATA).forEach(function (g) { DATA[g].forEach(function (p) { var k = keyOf(p); if (k) (seen[k] = seen[k] || {})[g] = 1; }); });
    var add = [];
    var X = g.EXTRA_PLACES || { EXTRA: {}, EXTRA_LATIN: {}, EXTRA_GOV_ALIAS: {} };
    [X.EXTRA, X.EXTRA_LATIN].forEach(function (src) {
      Object.keys(src).forEach(function (gv) { src[gv].forEach(function (p) { var k = keyOf(p); if (!k) return; add.push([gv, p, k]); (seen[k] = seen[k] || {})[gv] = 1; }); });
    });
    add.forEach(function (a) {
      var govs = Object.keys(seen[a[2]]);
      if (govs.length > 1) return;                       // اسم بيتكرر بين محافظتين: مش بنضيفه (بيفضل للمراجعة)
      if (DATA[a[0]].indexOf(a[1]) === -1) DATA[a[0]].push(a[1]);
    });
    Object.keys(X.EXTRA_GOV_ALIAS).forEach(function (gv) { GOV_ALIAS[gv] = (GOV_ALIAS[gv] || []).concat(X.EXTRA_GOV_ALIAS[gv]); });
  })();

  var PLACES = {}, GOVS = {}, GOV_LABELS = Object.keys(DATA);
  function addEntry(map, text, gov, label, kind) {
    var ws = words(text), key = ws.join(' '); if (!key) return;
    var keys = [key]; if (ws.length > 1 && ws.length <= 3 && ws[0] !== '6') keys.push(ws.join(''));
    keys.forEach(function (k) {
      var arr = map[k] || (map[k] = []);
      if (!arr.some(function (e) { return e.gov === gov; })) arr.push({ gov: gov, label: label || text, kind: kind });
    });
  }
  GOV_LABELS.forEach(function (gv) {
    DATA[gv].forEach(function (p) { addEntry(PLACES, p, gv, p, 'place'); });
    (GOV_ALIAS[gv] || []).concat([gv]).forEach(function (a) { addEntry(GOVS, a, gv, gv, 'gov'); });
  });
  // الأسماء الإنجليزي بتظهر في خانة المنطقة بالعربي
  var LL = (g.EXTRA_PLACES && g.EXTRA_PLACES.LATIN_LABEL) || {};
  Object.keys(LL).forEach(function (lat) { var arr = PLACES[words(lat).join(' ')]; if (arr) arr.forEach(function (e) { e.label = LL[lat]; }); });
  var MAXN = 4;
  var WORDSET = {};
  Object.keys(PLACES).concat(Object.keys(GOVS)).forEach(function (k) { k.split(' ').forEach(function (w) { WORDSET[w] = 1; }); });
  // ---- تصحيح الأخطاء الإملائية: كلمة قريبة (غلطة حرف واحد) من اسم مكان معروف ----
  var FUZZ_SKIP = {};
  ('شارع ميدان عماره عمارتي شقه الدور دور برج منزل فيلا مدينه مركز محافظه منطقه قسم بجوار بجانب امام خلف مقابل تقاطع متفرع علامه مميزه عنوان تفصيل طابق اسانسير محمول تليفون موبايل رقم ' +
    'محمد احمد محمود مصطفي ابراهيم عبدالله عبدالرحمن حسن حسين علي خالد سعيد عمرو ياسر رمضان اسماء ايمان منال هبه سارا سلمي نورا مروه شيماء رحمه فاطمه زينب مريم ' +
    'مسجد جامع كنيسه مدرسه مستشفي صيدليه سوبر ماركت محل مخبز كافيه كافية بنزينه مول سنتر').split(/\s+/).forEach(function (w) { FUZZ_SKIP[nz(w)] = 1; });
  var FUZZ_LIST = Object.keys(WORDSET).filter(function (w) { return w.length >= 4 && /^[\u0621-\u064a]+$/.test(w); });
  function editLE1(a, b) {
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    var i = 0; while (i < la && i < lb && a[i] === b[i]) i++;
    if (i === la && i === lb) return true;
    if (la === lb) {
      if (a.slice(i + 1) === b.slice(i + 1)) return true;                       // حرف مختلف
      if (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)) return true; // حرفين متبدلين
      return false;
    }
    return la > lb ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);  // حرف زيادة/ناقص
  }
  var fuzzCache = {}, FUZZY_ON = false;
  function fuzzyWord(w) {
    if (w in fuzzCache) return fuzzCache[w];
    var res = null;
    if (w.length >= 4 && /^[\u0621-\u064a]+$/.test(w) && !FUZZ_SKIP[w]) {
      var hits = [];
      for (var i = 0; i < FUZZ_LIST.length; i++) {
        var c = FUZZ_LIST[i];
        if (c.length >= 4 && c.charAt(0) === w.charAt(0) && editLE1(w, c)) { hits.push(c); if (hits.length > 1) break; }
      }
      if (hits.length === 1 && !FUZZ_SKIP[hits[0]]) res = hits[0];
    }
    return (fuzzCache[w] = res);
  }
  function fixTokens(ws) {
    var out = [];
    ws.forEach(function (w) {
      if (FUZZY_ON && !WORDSET[w]) { var fz = fuzzyWord(w); if (fz) w = fz; }
      if (!WORDSET[w] && w.length > 3 && 'بوفل'.indexOf(w.charAt(0)) !== -1 && WORDSET[w.slice(1)]) w = w.slice(1);
      if (!WORDSET[w] && /^[\u0621-\u064a]{6,}$/.test(w)) {
        for (var k = 3; k <= w.length - 3; k++) {
          var a = w.slice(0, k), b = w.slice(k).replace(/^ال(?=...)/, '');
          if (WORDSET[a] && WORDSET[b]) { out.push(a, b); return; }
        }
      }
      out.push(w);
    });
    return out;
  }
  var PLACE_SET = {};
  Object.keys(PLACES).concat(Object.keys(GOVS)).forEach(function (k) { PLACE_SET[k] = 1; });
  function isPlaceOnly(text) { var ws = words(text); return ws.length > 0 && !!PLACE_SET[ws.join(' ')]; }

  // بيدوّر على كل التطابقات في قائمة كلمات
  function scan(ws, map, skipStreet) {
    var out = [];
    for (var i = 0; i < ws.length; i++) {
      for (var n = Math.min(MAXN, ws.length - i); n >= 1; n--) {
        var key = ws.slice(i, i + n).join(' ');
        if (map[key]) {
          var prev = i > 0 ? ws[i - 1] : '';
          var street = skipStreet && n === 1 && STREET_CTX[prev] && !(RELAX_STREET && SOFT_CTX[prev]);
          var kw = AREA_KW[prev] ? true : false;
          out.push({ key: key, pos: i, len: n, entries: map[key], street: !!street, kw: kw });
          i += n - 1; break;
        }
      }
    }
    return out;
  }

  /**
   * resolve({ govLabel, areaLabel, address }) →
   * { gov, area, issues:[], source }
   */
  function resolveCore(inp) {
    var issues = [], gov = '', area = '', source = '';
    var govLabelText = (inp.govLabel || '').trim(), areaLabelText = (inp.areaLabel || '').trim();
    var addr = inp.address || '';

    // 1) محافظة مكتوبة صراحة (ليبل أو سطر لوحده)
    var strong = [];
    var gl = scan(words(govLabelText), GOVS, false);
    gl.forEach(function (m) { m.entries.forEach(function (e) { if (strong.indexOf(e.gov) === -1) strong.push(e.gov); }); });
    // محافظة بعد كلمة "محافظة" في العنوان
    var aw = fixTokens(words(addr));
    for (var i = 0; i < aw.length - 1; i++) {
      if (aw[i] === 'محافظه' || aw[i] === 'محافظ') {
        var sub = scan(aw.slice(i + 1, i + 4), GOVS, false);
        if (sub.length && sub[0].pos === 0) sub[0].entries.forEach(function (e) { if (strong.indexOf(e.gov) === -1) strong.push(e.gov); });
      }
    }
    function govsOf(ms) { var s2 = []; ms.forEach(function (m) { m.entries.forEach(function (e) { if (s2.indexOf(e.gov) === -1) s2.push(e.gov); }); }); return s2; }
    var addrPlacesAll = scan(aw, PLACES, true).filter(function (m) { return !m.street; });
    // محافظة مكتوبة لوحدها كجزء منفصل في العنوان (بعد شرطة أو فاصلة أو بين شرطات)
    String(addr).split(/\s+-\s+|[،,\/\n]|\s*-\s*/).forEach(function (part) {
      var pw = words(part).filter(function (w) { return w !== 'محافظه'; });
      if (pw.length && pw.length <= 3) {
        var gm = GOVS[pw.join(' ')];
        if (gm) gm.forEach(function (e) { if (strong.indexOf(e.gov) === -1) strong.push(e.gov); });
      }
    });
    // 2) أسماء محافظات في العنوان (ضعيفة)
    var weakGov = [];
    scan(aw, GOVS, true).forEach(function (m) {
      if (m.street) return;
      m.entries.forEach(function (e) {
        if (RISKY_GOV[e.gov] && !(aw[m.pos - 1] === 'محافظه') && !AREA_KW[aw[m.pos + m.len]] && govsOf(addrPlacesAll).indexOf(e.gov) === -1) return;
        if (weakGov.indexOf(e.gov) === -1) weakGov.push(e.gov);
      });
    });
    // 3) مراكز/مناطق
    var areaWords = words(areaLabelText);
    var labeledPlaces = scan(areaWords, PLACES, false);
    var addrPlaces = scan(aw, PLACES, true).filter(function (m) { return !m.street; });
    var kwPlaces = addrPlaces.filter(function (m) { return m.kw; });


    if (strong.length > 1) { issues.push('أكتر من محافظة مكتوبة (' + strong.join(' / ') + ')'); }
    var reliableCenters = labeledPlaces.concat(kwPlaces);
    if (strong.length) {
      gov = strong[0]; source = 'مكتوبة';
      // تعارض مع المنطقة المكتوبة صراحة
      reliableCenters.forEach(function (m) {
        var gs = govsOf([m]);
        if (gs.length && gs.indexOf(gov) === -1) issues.push('المنطقة «' + m.key + '» تابعة لـ ' + gs.join(' / ') + ' مش ' + gov);
      });
    } else {
      var cand = govsOf(reliableCenters);
      if (cand.length === 1) { gov = cand[0]; source = 'من المنطقة'; }
      else if (weakGov.length === 1) { gov = weakGov[0]; source = 'اسم محافظة في العنوان'; }
      else if (weakGov.length > 1) {
        // لو واحدة منهم مؤكدة بمركز ينتمي ليها
        var both = weakGov.filter(function (gv) { return govsOf(addrPlaces).indexOf(gv) !== -1; });
        if (both.length === 1) { gov = both[0]; source = 'اسم محافظة + منطقة'; }
        else issues.push('أكتر من محافظة ممكنة (' + weakGov.join(' / ') + ')');
      } else {
        var weakC = govsOf(addrPlaces);
        if (cand.length > 1) {
          issues.push('المنطقة تابعة لأكتر من محافظة (' + cand.join(' / ') + ') ومفيش محافظة مكتوبة');
        } else if (weakC.length === 1) { gov = weakC[0]; source = 'من اسم منطقة في العنوان'; }
        else if (weakC.length > 1) {
          var sc = {}, prior = { 'القاهرة': 0.4, 'الجيزة': 0.3, 'الإسكندرية': 0.2 };
          addrPlaces.forEach(function (m) { m.entries.forEach(function (e) { sc[e.gov] = (sc[e.gov] || 0) + m.len * 2 / m.entries.length + (m.pos + m.len >= aw.length - 1 ? 0.5 : 0) + (m.pos === 0 ? 1.5 : 0); }); });
          var best = Object.keys(sc).sort(function (a, b) { return (sc[b] + (prior[b] || 0)) - (sc[a] + (prior[a] || 0)); });
          if (sc[best[0]] - sc[best[1]] >= 1) { gov = best[0]; source = 'من اسم منطقة في العنوان'; }
          else issues.push('المنطقة تابعة لأكتر من محافظة (' + weakC.join(' / ') + ') ومفيش محافظة مكتوبة');
        }
      }
    }

    // القاهرة الكبرى: الناس بتكتب "القاهرة" لأي حاجة (المهندسين = الجيزة، شبرا الخيمة = القليوبية...).
    // لو مفيش ولا مكان في العنوان تابع للمحافظة المكتوبة، ومكان واضح تابع لمحافظة تانية من التلاتة، نعتمد محافظة المكان.
    var GC = { 'القاهرة': 1, 'الجيزة': 1, 'القليوبية': 1 };
    if (gov === 'القاهرة' && strong.length <= 1 && (source === 'مكتوبة' || source === 'اسم محافظة في العنوان')) {   // "القاهرة" هي اللي الناس بتكتبها لأي حاجة حواليها؛ الجيزة/القليوبية المكتوبة صراحة بنثق فيها
      var mine = addrPlaces.concat(reliableCenters).some(function (m) { return govsOf([m]).indexOf(gov) !== -1; });
      if (!mine) {
        var oth = [];
        addrPlaces.concat(reliableCenters).forEach(function (m) { var gs = govsOf([m]); if (gs.length === 1 && GC[gs[0]] && oth.indexOf(gs[0]) === -1) oth.push(gs[0]); });
        if (oth.length === 1) { gov = oth[0]; source = 'من المنطقة (القاهرة الكبرى)'; }
      }
    }

    // المنطقة/المركز
    if (areaLabelText) {
      area = areaLabelText.replace(/\s+/g, ' ').replace(/[.\s]+$/, '');
    } else {
      var pool = (kwPlaces.length ? kwPlaces : addrPlaces).filter(function (m) { return !gov || govsOf([m]).indexOf(gov) !== -1; });
      // أطول/أخص تطابق
      var gn = nz(gov || '');
      var isGovName = function (m) { return m.entries.some(function (e) { return nz(e.label) === gn; }); };
      pool.sort(function (a, b) { return (b.len - a.len) || ((isGovName(a) ? 1 : 0) - (isGovName(b) ? 1 : 0)); });
      if (pool.length) {
        var m0 = pool[0], rawWords = addr.split(/\s+/);
        area = m0.entries[0].label.replace(/^ال/, 'ال') ;
        area = m0.entries.filter(function (e) { return !gov || e.gov === gov; })[0].label;
      }
    }
    if (!gov && !issues.length) issues.push('مقدرتش أعرف المحافظة من العنوان');
    return { gov: gov, area: area, issues: issues, source: source };
  }


  // أول مرة بدون تصحيح إملائي (عشان منغلطش في اللي مظبوط)، ولو المحافظة مطلعتش نجرب مع التصحيح التقريبي
  function resolve(inp) {
    FUZZY_ON = false;
    var r = resolveCore(inp);
    if (!r.gov) {            // مرحلة تانية: نسمح بأسماء المناطق اللي بعد كلمة مؤسسة (جمعية/مدرسة/محل...)
      RELAX_STREET = true;
      try { var rs = resolveCore(inp); if (rs.gov && !rs.issues.length) { rs.source = (rs.source || '') + ' (سياق ضعيف)'; return rs; } }
      finally { RELAX_STREET = false; }
    }
    if (r.gov && !r.area && !r.issues.length) {   // المحافظة معروفة والمنطقة فاضية: نجرب تصحيح إملائي (السيده زنيب = السيدة زينب)
      FUZZY_ON = true;
      try { var ra = resolveCore(inp); if (ra.gov === r.gov && ra.area && !ra.issues.length) { ra.source = (ra.source || '') + ' (مع تصحيح إملائي)'; return ra; } }
      finally { FUZZY_ON = false; }
    }
    if (!r.gov && !r.area) {
      FUZZY_ON = true;
      try {
        var r2 = resolveCore(inp);
        if (r2.gov && !r2.issues.length) { r2.source = (r2.source || '') + ' (مع تصحيح إملائي)'; return r2; }
      } finally { FUZZY_ON = false; }
    }
    return r;
  }

  g.Egypt = { DATA: DATA, resolve: resolve, words: words, nz: nz, isPlaceOnly: isPlaceOnly };
})(typeof window !== 'undefined' ? window : globalThis);
