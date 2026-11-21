'use strict';
/* =========================================================
   ذكّرني — المنطق (JavaScript)
   ========================================================= */

/* ---------- الإعدادات ---------- */
const CONFIG = {
  // الأدمن الحقيقي يتحدد في Netlify (متغير ADMIN_EMAIL). هذا للوضع التجريبي بس
  ADMIN_EMAIL: 'khaldalmwdy88@gmail.com',
  CODE_TTL_MIN: 5,                  // صلاحية الرمز بالدقائق
  RESEND_SEC: 30,                   // كم ثانية قبل ما يقدر يعيد الإرسال
  // وضع تجريبي تلقائياً لما تفتح الملف من جهازك. على Netlify يشتغل مع السيرفر
  DEMO_MODE: location.protocol === 'file:'
};

const TYPES = {
  quiz:    { label: 'كويز',   icon: '📝', color: '#a78bfa' },
  exam:    { label: 'اختبار', icon: '🎯', color: '#f87171' },
  task:    { label: 'تاسك',   icon: '✅', color: '#34d399' },
  hw:      { label: 'واجب',   icon: '📚', color: '#22d3ee' },
  project: { label: 'مشروع',  icon: '🚀', color: '#f5c76b' },
  lab:     { label: 'لاب',    icon: '🧪', color: '#ec4899' }
};

// الجامعات (نفس القائمة في netlify/lib/unis.mjs)
const UNIS = [
  ['kau', 'جامعة الملك عبدالعزيز'], ['ksu', 'جامعة الملك سعود'], ['kfupm', 'جامعة الملك فهد للبترول والمعادن'],
  ['uqu', 'جامعة أم القرى'], ['uj', 'جامعة جدة'], ['imamu', 'جامعة الإمام محمد بن سعود الإسلامية'],
  ['iau', 'جامعة الإمام عبدالرحمن بن فيصل'], ['pnu', 'جامعة الأميرة نورة بنت عبدالرحمن'], ['kfu', 'جامعة الملك فيصل'],
  ['kku', 'جامعة الملك خالد'], ['qu', 'جامعة القصيم'], ['taibahu', 'جامعة طيبة'], ['tu', 'جامعة الطائف'],
  ['iu', 'الجامعة الإسلامية بالمدينة المنورة'], ['jazanu', 'جامعة جازان'], ['nu', 'جامعة نجران'], ['ut', 'جامعة تبوك'],
  ['uoh', 'جامعة حائل'], ['ju', 'جامعة الجوف'], ['nbu', 'جامعة الحدود الشمالية'], ['bu', 'جامعة الباحة'],
  ['ub', 'جامعة بيشة'], ['uhb', 'جامعة حفر الباطن'], ['psau', 'جامعة الأمير سطام بن عبدالعزيز'], ['mu', 'جامعة المجمعة'],
  ['su', 'جامعة شقراء'], ['ksau', 'جامعة الملك سعود بن عبدالعزيز للعلوم الصحية'], ['seu', 'الجامعة السعودية الإلكترونية'],
  ['kaust', 'جامعة الملك عبدالله للعلوم والتقنية (كاوست)'], ['tvtc', 'الكليات التقنية (التدريب التقني والمهني)'],
  ['psu', 'جامعة الأمير سلطان'], ['alfaisal', 'جامعة الفيصل'], ['pmu', 'جامعة الأمير محمد بن فهد'], ['effat', 'جامعة عفت'],
  ['dah', 'جامعة دار الحكمة'], ['ubt', 'جامعة الأعمال والتكنولوجيا'], ['yu', 'جامعة اليمامة'], ['dau', 'جامعة دار العلوم'],
  ['riyadhelm', 'جامعة رياض العلم'], ['fbsu', 'جامعة فهد بن سلطان'], ['upm', 'جامعة الأمير مقرن بن عبدالعزيز'],
  ['other', 'جامعة أخرى']
];
const UNI_NAME = Object.fromEntries(UNIS);

/* ---------- أدوات ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const DAY = 86400000;

const fmtDate = ts => new Intl.DateTimeFormat('ar-u-nu-latn', {
  weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit'
}).format(ts);
const fmtShort = ts => ts ? new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(ts) : '—';

function daysWord(d) {
  if (d === 1) return 'يوم';
  if (d === 2) return 'يومين';
  if (d <= 10) return `${d} أيام`;
  return `${d} يوم`;
}
function countdownText(ms) {
  if (ms <= 0) {
    const late = -ms, d = Math.floor(late / DAY), h = Math.floor(late / 3600000);
    return d >= 1 ? `متأخر ${daysWord(d)}` : h >= 1 ? `متأخر ${h} ساعة` : 'حان الموعد';
  }
  const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d > 0) return `باقي ${daysWord(d)}${h ? ` و${h} ساعة` : ''}`;
  if (h > 0) return `باقي ${h} ساعة${mm ? ` و${mm} دقيقة` : ''}`;
  return `باقي ${mm || 1} دقيقة`;
}

function toast(html, kind = 'ok', ms = 4000) {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.innerHTML = html;
  const box = $('#toasts');
  box.appendChild(t);
  while (box.children.length > 3) box.firstElementChild.remove(); // ما نكدّس تنبيهات
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
}

/* ---------- التخزين ---------- */
const Store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
  del(k) { try { localStorage.removeItem(k); } catch { } }
};

/* ---------- الاتصال بالسيرفر (Netlify Functions) ---------- */
async function api(path, { method = 'GET', body } = {}) {
  const s = Auth.current();
  const headers = { 'content-type': 'application/json' };
  if (s?.token) headers.authorization = 'Bearer ' + s.token;
  const res = await fetch('/api/' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch { }
  if (res.status === 401 && path !== 'verify-code' && path !== 'session') {
    Auth.logout();
    showScreen('auth');
  }
  if (!res.ok) throw new Error(data.error || 'صار خطأ، جرّب مرة ثانية');
  return data;
}

/* =========================================================
   المصادقة (Auth)
   على Netlify: الرمز يتولد في السيرفر ويوصل على الإيميل.
   في الوضع التجريبي: يتولد في المتصفح ويطلع على الشاشة.
   ========================================================= */
const Auth = {
  async sendCode(email) {
    if (!CONFIG.DEMO_MODE) return api('send-code', { method: 'POST', body: { email } });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    sessionStorage.setItem('thk_otp', JSON.stringify({ email, code, exp: Date.now() + CONFIG.CODE_TTL_MIN * 60000 }));
    if (CONFIG.DEMO_MODE) toast(`🔐 <b>وضع تجريبي</b> — رمزك: <b dir="ltr" style="font-size:1.2em;letter-spacing:3px">${code}</b>`, 'info', 15000);
    return true;
  },
  async verifyCode(email, code) {
    if (!CONFIG.DEMO_MODE) return api('verify-code', { method: 'POST', body: { email, code } });
    let o = null;
    try { o = JSON.parse(sessionStorage.getItem('thk_otp') || 'null'); } catch { }
    if (!o || o.email !== email) throw new Error('اطلب رمز جديد');
    if (Date.now() > o.exp) throw new Error('الرمز انتهت صلاحيته، اطلب واحد جديد');
    if (o.code !== code) throw new Error('الرمز غلط، جرّب مرة ثانية');
    sessionStorage.removeItem('thk_otp');
    return { email, admin: email === CONFIG.ADMIN_EMAIL.toLowerCase(), token: null };
  },
  current() { return Store.get('thk_session', null); },
  login({ email, token, admin }) {
    Store.set('thk_session', { email, token, admin: !!admin, at: Date.now() });
    if (CONFIG.DEMO_MODE) {
      const users = Store.get('thk_users', {});
      users[email] = { joined: users[email]?.joined || Date.now(), last: Date.now() };
      Store.set('thk_users', users);
    }
  },
  logout() { Store.del('thk_session'); }
};

/* ---------- المهام ---------- */
const state = { email: null, admin: false, type: 'quiz', filter: 'all', view: 'home', profile: null };

const Tasks = {
  list: [],
  syncTimer: null,
  key(email = state.email) { return 'thk_tasks_' + email; },
  async load() {
    const cached = Store.get(this.key(), []);
    if (CONFIG.DEMO_MODE) { this.list = cached; return; }
    try {
      const r = await api('tasks');
      this.list = r.tasks;
      if (r.profile) Profile.set(r.profile);
      Store.set(this.key(), this.list);
    } catch (e) {
      this.list = cached; // بدون نت: نعرض آخر نسخة محفوظة
      toast('ما قدرنا نوصل للسيرفر، نعرض آخر نسخة محفوظة', 'err');
    }
  },
  all() { return this.list; },
  save(list) {
    this.list = list;
    Store.set(this.key(), list);
    if (CONFIG.DEMO_MODE) return;
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      api('tasks', { method: 'PUT', body: { tasks: this.list } })
        .catch(e => toast('ما انحفظ على السيرفر: ' + esc(e.message), 'err'));
    }, 400);
  },
  add(t) { this.save([...this.list, t]); },
  update(id, patch) { this.save(this.all().map(t => t.id === id ? { ...t, ...patch } : t)); },
  remove(id) { this.save(this.all().filter(t => t.id !== id)); }
};

/* =========================================================
   شاشة الدخول
   ========================================================= */
let pendingEmail = '';
let resendTimer = null;

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  window.scrollTo(0, 0);
}

function startResendTimer() {
  let s = CONFIG.RESEND_SEC;
  const btn = $('#resendBtn'), lbl = $('#resendTimer');
  btn.disabled = true;
  clearInterval(resendTimer);
  const tick = () => {
    lbl.textContent = s > 0 ? `(${s})` : '';
    if (s-- <= 0) { clearInterval(resendTimer); btn.disabled = false; }
  };
  tick();
  resendTimer = setInterval(tick, 1000);
}

$('#emailForm').addEventListener('submit', async e => {
  e.preventDefault();
  const email = $('#emailInput').value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('اكتب إيميل صحيح 🙏', 'err');
  pendingEmail = email;
  const btn = $('#emailForm button');
  btn.disabled = true;
  btn.textContent = 'جاري الإرسال...';
  try {
    await Auth.sendCode(email);
  } catch (err) {
    return toast(esc(err.message), 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = 'أرسل الرمز ✨';
  }
  if (!CONFIG.DEMO_MODE) toast('✉️ أرسلنا الرمز على إيميلك (شيّك على السبام بعد)', 'ok', 7000);
  $('#sentTo').textContent = email;
  $('#stepEmail').hidden = true;
  $('#stepCode').hidden = false;
  $$('#otpBoxes input').forEach(i => i.value = '');
  $('#otpBoxes input').focus();
  startResendTimer();
});

// خانات الرمز: تنقّل تلقائي + لصق
const otpInputs = $$('#otpBoxes input');
otpInputs.forEach((inp, i) => {
  inp.addEventListener('input', () => {
    inp.value = inp.value.replace(/\D/g, '').slice(-1);
    if (inp.value && otpInputs[i + 1]) otpInputs[i + 1].focus();
    if (otpInputs.every(x => x.value)) $('#codeForm').requestSubmit();
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Backspace' && !inp.value && otpInputs[i - 1]) otpInputs[i - 1].focus();
  });
  inp.addEventListener('paste', e => {
    const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    e.preventDefault();
    digits.split('').forEach((d, k) => { if (otpInputs[k]) otpInputs[k].value = d; });
    (otpInputs[digits.length] || otpInputs[5]).focus();
    if (digits.length === 6) $('#codeForm').requestSubmit();
  });
});

$('#codeForm').addEventListener('submit', async e => {
  e.preventDefault();
  const code = otpInputs.map(i => i.value).join('');
  if (code.length !== 6) return toast('كمّل الرمز (6 أرقام)', 'err');
  const btn = $('#codeForm button[type=submit]');
  btn.disabled = true;
  try {
    const data = await Auth.verifyCode(pendingEmail, code);
    Auth.login(data);
    toast('أهلاً فيك! 🎉', 'ok');
    await enterApp();
    checkReminders();
  } catch (err) {
    toast(err.message, 'err');
    otpInputs.forEach(i => i.value = '');
    otpInputs[0].focus();
  } finally {
    btn.disabled = false;
  }
});

$('#backBtn').addEventListener('click', () => {
  $('#stepCode').hidden = true;
  $('#stepEmail').hidden = false;
  $('#emailInput').focus();
});
$('#resendBtn').addEventListener('click', async () => {
  try {
    await Auth.sendCode(pendingEmail);
    toast('أرسلنا رمز جديد ✉️', 'ok');
    startResendTimer();
  } catch (err) {
    toast(esc(err.message), 'err');
  }
});

/* =========================================================
   التطبيق
   ========================================================= */
async function enterApp() {
  const s = Auth.current();
  if (!s) return showScreen('auth');
  state.email = s.email;
  state.admin = !!s.admin;
  const admin = state.admin;
  if (CONFIG.DEMO_MODE) Profile.set(Store.get('thk_profile_' + s.email, null) || { uni: null, wa: { ready: false } });
  await Tasks.load();
  Mist.load();
  Planner.load();
  BB.load();

  $('#userEmail').textContent = s.email;
  $('#meAvatar').textContent = s.email[0].toUpperCase();
  $('#adminBadge').hidden = !admin;
  $('#adminTab').hidden = !admin;

  const h = new Date().getHours();
  const name = s.email.split('@')[0];
  $('#greeting').textContent = `${h < 12 ? 'صباح الخير' : 'مساء الخير'}، ${name} 👋`;
  $('#todayStr').textContent = new Intl.DateTimeFormat('ar-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  // التاريخ الافتراضي = بكرة
  const tmr = new Date(Date.now() + DAY);
  $('#fDate').value = tmr.toISOString().slice(0, 10);

  updateNotifBtn();
  showScreen('app');
  render();
  if (state.profile?.uni) Library.load();
  View.go(View.fromHash(), false);
  if (state.profile && !state.profile.uni) UniPicker.open(true); // أول مرة: من أي جامعة؟
}

$('#logoutBtn').addEventListener('click', () => {
  if (!CONFIG.DEMO_MODE) fetch('/api/session', { method: 'DELETE' }).catch(() => { });
  Auth.logout();
  state.email = null;
  state.admin = false;
  Tasks.list = [];
  Admin.data = null;
  Library.reset();
  state.profile = null;
  Mist.list = [];
  Planner.reset(false);
  $('#stepCode').hidden = true;
  $('#stepEmail').hidden = false;
  $('#emailInput').value = '';
  showScreen('auth');
});

/* ---------- اختيار النوع ---------- */
function renderTypePicker() {
  $('#typePicker').innerHTML = Object.entries(TYPES).map(([k, t]) =>
    `<button type="button" data-t="${k}" style="--c:${t.color}" class="${state.type === k ? 'sel' : ''}">
       <span>${t.icon}</span>${t.label}
     </button>`).join('');
}
$('#typePicker').addEventListener('click', e => {
  const b = e.target.closest('button[data-t]');
  if (!b) return;
  state.type = b.dataset.t;
  renderTypePicker();
});

/* ---------- إضافة ---------- */
$('#taskForm').addEventListener('submit', e => {
  e.preventDefault();
  const subject = $('#fSubject').value.trim();
  const date = $('#fDate').value;
  if (!subject) return toast('اكتب اسم المادة', 'err');
  if (!date) return toast('اختر التاريخ', 'err');
  const time = $('#fTime').value || '08:00';
  const due = new Date(`${date}T${time}`).getTime();
  if (isNaN(due)) return toast('التاريخ غير صحيح', 'err');

  Tasks.add({
    id: uid(),
    type: state.type,
    subject,
    title: $('#fTitle').value.trim(),
    due,
    remind: +$('#fRemind').value,
    note: $('#fNote').value.trim(),
    grade: $('#fGrade').value.trim(),
    done: false,
    created: Date.now()
  });
  $('#fSubject').value = '';
  $('#fTitle').value = '';
  $('#fNote').value = '';
  $('#fGrade').value = '';
  toast(`${TYPES[state.type].icon} تمت إضافة ${TYPES[state.type].label} <b>${esc(subject)}</b>`, 'ok');
  AddSheet.close();
  render();
  checkReminders();
});

/* ---------- الفلاتر ---------- */
function renderFilters() {
  const f = [['all', 'الكل'], ...Object.entries(TYPES).map(([k, t]) => [k, `${t.icon} ${t.label}`]), ['done', '🏆 المنجزة']];
  $('#filters').innerHTML = f.map(([k, l]) => `<button data-f="${k}" class="${state.filter === k ? 'sel' : ''}">${l}</button>`).join('');
}
$('#filters').addEventListener('click', e => {
  const b = e.target.closest('button[data-f]');
  if (!b) return;
  state.filter = b.dataset.f;
  render();
});

/* ---------- القائمة ---------- */
function itemHTML(t) {
  const ty = TYPES[t.type] || TYPES.task;
  const left = t.due - Date.now();
  let cls = 'ok';
  if (!t.done) { if (left <= 0) cls = 'late'; else if (left < DAY) cls = 'urgent'; }
  return `
  <div class="item glass ${t.done ? 'done' : ''}" style="--c:${ty.color}">
    <div class="ico">${ty.icon}</div>
    <div>
      <div class="sub">${esc(t.subject)}</div>
      ${t.title ? `<div class="ttl">${esc(t.title)}</div>` : ''}
      <div class="meta">
        <span class="pill type">${ty.label}</span>
        ${t.grade ? `<span class="pill grade">🎯 ${esc(t.grade)}</span>` : ''}
        ${t.src === 'bb' ? `<span class="pill bb">🔗 ${t.cal === 'gc' ? 'Classroom' : 'Blackboard'}</span>` : ''}
        <span class="pill">🗓️ ${fmtDate(t.due)}</span>
        ${t.done ? '<span class="pill ok">✔ منجز</span>' : `<span class="pill ${cls}">${countdownText(left)}</span>`}
      </div>
      ${t.note ? `<div class="note">📌 ${esc(t.note)}</div>` : ''}
    </div>
    <div class="acts">
      <button data-act="done" data-id="${t.id}" title="${t.done ? 'إرجاع' : 'تم'}">${t.done ? '↩️' : '✔️'}</button>
      <button data-act="share" data-id="${t.id}" title="أرسل التذكير لأصحابك">📤</button>
      <button data-act="del" data-id="${t.id}" title="حذف">🗑️</button>
    </div>
  </div>`;
}

function render() {
  if (!state.email) return;
  renderTypePicker();
  renderFilters();

  const all = Tasks.all().filter(t => !t.hidden);
  const now = Date.now();
  const open = all.filter(t => !t.done);

  // الإحصائيات
  $('#stTotal').textContent = open.filter(t => t.due > now).length;
  $('#stToday').textContent = open.filter(t => t.due > now && t.due - now < DAY).length;
  $('#stLate').textContent = open.filter(t => t.due <= now).length;
  $('#stDone').textContent = all.filter(t => t.done).length;

  // الفلترة
  let list = all;
  if (state.filter === 'done') list = all.filter(t => t.done);
  else if (state.filter !== 'all') list = all.filter(t => t.type === state.filter && !t.done);
  else list = open;
  list.sort((a, b) => a.due - b.due);

  if (!list.length) {
    $('#list').innerHTML = `<div class="empty"><span>${state.filter === 'done' ? '🏆' : '🌙'}</span>${state.filter === 'done' ? 'ما خلّصت شي للحين' : 'ما عندك شي هنا — اضغط ＋ وضيف أول تذكير'}</div>`;
  } else if (state.filter === 'done') {
    $('#list').innerHTML = list.map(itemHTML).join('');
  } else {
    // تجميع حسب الوقت
    const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
    const groups = [
      ['⚠️ متأخرة', t => t.due <= now],
      ['🔥 اليوم', t => t.due > now && t.due <= endToday.getTime()],
      ['📅 هالأسبوع', t => t.due > endToday.getTime() && t.due <= endToday.getTime() + 6 * DAY],
      ['🗂️ بعدين', t => t.due > endToday.getTime() + 6 * DAY]
    ];
    $('#list').innerHTML = groups.map(([title, fn]) => {
      const g = list.filter(fn);
      return g.length ? `<div class="group-h">${title} (${g.length})</div>${g.map(itemHTML).join('')}` : '';
    }).join('');
  }

  renderNextUp();
}

$('#list').addEventListener('click', e => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const id = b.dataset.id;
  if (b.dataset.act === 'done') {
    const t = Tasks.all().find(x => x.id === id);
    Tasks.update(id, { done: !t.done });
    if (!t.done) toast('كفو! 💪 خلّصتها', 'ok');
  } else if (b.dataset.act === 'share') {
    const t = Tasks.all().find(x => x.id === id);
    if (t) shareSheet(t);
    return;
  } else if (b.dataset.act === 'del') {
    if (!confirm('متأكد تبي تحذفه؟')) return;
    const t = Tasks.all().find(x => x.id === id);
    // تذكيرات Blackboard نخفيها بدل ما نحذفها، عشان المزامنة ما ترجّعها
    if (t?.src === 'bb') Tasks.update(id, { hidden: true });
    else Tasks.remove(id);
    toast('انحذف 🗑️', 'info');
  }
  render();
});

/* ---------- أقرب موعد (عدّاد) ---------- */
function renderNextUp() {
  const now = Date.now();
  const next = Tasks.all().filter(t => !t.done && !t.hidden && t.due > now).sort((a, b) => a.due - b.due)[0];
  const box = $('#nextUp');
  if (!next) {
    box.innerHTML = `<div><div class="lbl">أقرب موعد</div><div class="nm">مافي شي قريب — استمتع ☕</div></div>`;
    return;
  }
  const ty = TYPES[next.type] || TYPES.task;
  const ms = next.due - now;
  const d = Math.floor(ms / DAY), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  const p = n => String(n).padStart(2, '0');
  box.innerHTML = `
    <div>
      <div class="lbl">⏳ أقرب موعد</div>
      <div class="nm">${ty.icon} ${ty.label} ${esc(next.subject)}</div>
      <div class="muted small">${fmtDate(next.due)}</div>
    </div>
    <div class="cd">
      <div><b>${p(d)}</b><small>يوم</small></div>
      <div><b>${p(h)}</b><small>ساعة</small></div>
      <div><b>${p(m)}</b><small>دقيقة</small></div>
      <div><b>${p(s)}</b><small>ثانية</small></div>
    </div>`;
}

/* =========================================================
   التذكيرات والإشعارات
   ========================================================= */
function updateNotifBtn() {
  const b = $('#notifBtn');
  const on = 'Notification' in window && Notification.permission === 'granted';
  b.classList.toggle('on', on);
  b.title = on ? 'الإشعارات مفعّلة' : 'تفعيل الإشعارات';
  const b2 = $('#notifBtn2');
  b2.textContent = on ? '✅ مفعّلة' : 'تفعيل';
  b2.disabled = on;
}
$('#notifBtn2').addEventListener('click', () => $('#notifBtn').click());
$('#notifBtn').addEventListener('click', async () => {
  if (!('Notification' in window)) return toast('متصفحك ما يدعم الإشعارات', 'err');
  const p = await Notification.requestPermission();
  updateNotifBtn();
  toast(p === 'granted' ? 'تم تفعيل الإشعارات 🔔' : 'ما تم التفعيل — بنذكرك داخل الموقع بس', p === 'granted' ? 'ok' : 'info');
});

// رسالة واتساب جاهزة (تنفتح من حساب واتساب اللي في جهازك)
// kind: 'group' لقروب الشعبة، 'friend' لصاحبك
function waLink(t, kind = 'group') {
  const ty = TYPES[t.type] || TYPES.task;
  const left = t.due > Date.now() ? `⏳ ${countdownText(t.due - Date.now())}` : null;
  const lines = kind === 'friend'
    ? [
        'هلا 👋 تذكير سريع:',
        `ترى عندنا ${ty.label} ${t.subject} ${ty.icon}`,
        t.title ? `📝 ${t.title}` : null,
        t.grade ? `🎯 عليه ${t.grade}` : null,
        `🗓️ ${fmtDate(t.due)}`,
        left,
        'لا تنساه 😉',
        '',
        `ذكّرني: ${location.origin}`
      ]
    : [
        '🔔 تذكير للشعبة',
        `${ty.icon} ${ty.label} — ${t.subject}`,
        t.title ? `📝 ${t.title}` : null,
        t.grade ? `🎯 الدرجة: ${t.grade}` : null,
        `🗓️ الموعد: ${fmtDate(t.due)}`,
        left,
        '',
        `من موقع ذكّرني: ${location.origin}`
      ];
  return 'https://wa.me/?text=' + encodeURIComponent(lines.filter(l => l !== null).join('\n'));
}

// نافذة صغيرة: وين تبي ترسل التذكير؟
function shareSheet(t) {
  const el = document.createElement('div');
  el.className = 'sheet';
  el.innerHTML = `
    <div class="sheet-box glass">
      <b>وين تبي ترسل التذكير؟</b>
      <small class="muted">${esc(t.subject)}${t.title ? ' — ' + esc(t.title) : ''}</small>
      <a class="btn primary full" href="${waLink(t, 'group')}" target="_blank" rel="noopener">👥 قروب الشعبة</a>
      <a class="btn ghost full" href="${waLink(t, 'friend')}" target="_blank" rel="noopener">💬 صاحبي</a>
      <button class="btn ghost full" type="button">إلغاء</button>
    </div>`;
  el.addEventListener('click', e => {
    if (e.target === el || e.target.closest('button') || e.target.closest('a')) el.remove();
  });
  document.body.appendChild(el);
}

function notify(title, body, task) {
  const share = task ? `<br><a href="${waLink(task, 'group')}" target="_blank" rel="noopener" style="color:#25D366;font-weight:800">👥 للقروب</a> · <a href="${waLink(task, 'friend')}" target="_blank" rel="noopener" style="color:#25D366;font-weight:800">💬 لصاحبك</a>` : '';
  toast(`🔔 <b>${esc(title)}</b><br>${esc(body)}${share}`, 'info', task ? 20000 : 10000);
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: 'assets/logo.svg' }); } catch { }
  }
}

function checkReminders() {
  if (!state.email) return;
  const now = Date.now();
  let changed = false;
  const list = Tasks.all().map(t => {
    if (t.done || t.hidden) return t;
    const ty = TYPES[t.type] || TYPES.task;
    if (!t.n1 && now >= t.due - t.remind * 60000 && now < t.due) {
      notify(`${ty.icon} تذكير: ${ty.label} ${t.subject}`, `${countdownText(t.due - now)} — ${fmtDate(t.due)}${t.note ? `\n📌 ${t.note}` : ''}`, t);
      t.n1 = true; changed = true;
    }
    if (!t.n2 && now >= t.due && now - t.due < 3600000) {
      notify(`⏰ حان موعد ${ty.label} ${t.subject}`, t.title || 'بالتوفيق! 🍀');
      t.n2 = true; changed = true;
    }
    return t;
  });
  if (changed) { Tasks.save(list); render(); }
}

/* =========================================================
   صانع الكويز (ذكاء اصطناعي)
   ========================================================= */
const QUIZ = {
  CHUNK: 3500,        // حجم كل جزء يرسل للسيرفر
  PARALLEL: 3,        // كم جزء نرسل في نفس الوقت
  MAX_CHARS: 60000,   // تقريباً 25 صفحة
  MAX_PAGES: 40,
  MAX_FILES: 10,      // أقصى عدد ملفات مرة وحدة
  MAX_IMAGES: 20,     // أقصى عدد صور (أو صفحات مصورة)
  IMG_SIZE: 1600,     // نصغّر الصور لهالحجم قبل الإرسال
  MAX_Q: 80
};
const quiz = { files: [], jobs: null, mode: 'same', questions: [], graded: false, busy: false, isBank: false, lib: null, title: '' };

const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const QTYPE = { mcq: 'اختيار من متعدد', tf: 'صح أو خطأ', short: 'إجابة قصيرة', essay: 'مقالي' };

function loadScript(src) {
  return new Promise((res, rej) => {
    if ([...document.scripts].some(s => s.src === src)) return res();
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('ما قدرنا نحمّل أداة قراءة الملفات'));
    document.head.appendChild(s);
  });
}

// يصغّر صورة (أو canvas) ويرجعها JPEG بصيغة base64
async function toJpeg(source) {
  let img = source;
  if (source instanceof Blob) {
    img = await createImageBitmap(source).catch(() => new Promise((res, rej) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = () => rej(new Error('ما قدرنا نفتح الصورة'));
      el.src = URL.createObjectURL(source);
    }));
  }
  const w = img.width, h = img.height;
  const k = Math.min(1, QUIZ.IMG_SIZE / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82).split(',')[1];
}

// PDF: ياخذ النص، والصفحات اللي ما فيها نص (سكان) يحولها لصور
async function readPdf(file) {
  const base = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  await loadScript(base + 'pdf.min.js');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js';
  const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  let text = '';
  const images = [];
  for (let p = 1; p <= Math.min(pdf.numPages, QUIZ.MAX_PAGES); p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const t = content.items.map(i => i.str + (i.hasEOL ? '\n' : ' ')).join('');
    if (t.replace(/\s/g, '').length >= 40) {
      text += t + '\n\n';
    } else if (images.length < QUIZ.MAX_IMAGES) {
      const vp = page.getViewport({ scale: 2 });
      const c = document.createElement('canvas');
      c.width = vp.width;
      c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      images.push(await toJpeg(c));
    }
  }
  return { text, images };
}

// يحوّل كل الملفات المختارة إلى "مهام": أجزاء نص + صور
async function buildJobs(files) {
  let text = '';
  let images = [];
  for (const f of files) {
    const name = f.name.toLowerCase();
    if (f.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp)$/.test(name)) {
      images.push(await toJpeg(f));
    } else if (name.endsWith('.pdf')) {
      const r = await readPdf(f);
      text += r.text;
      images.push(...r.images);
    } else if (name.endsWith('.docx')) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
      text += (await window.mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value + '\n\n';
    } else if (name.endsWith('.txt')) {
      text += (await f.text()) + '\n\n';
    } else {
      toast(`تخطينا "${esc(f.name)}" لأن نوعه غير مدعوم`, 'info');
    }
  }
  text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length > QUIZ.MAX_CHARS) {
    toast('الملفات كبيرة، بناخذ أول 25 صفحة تقريباً من النص', 'info');
    text = text.slice(0, QUIZ.MAX_CHARS);
  }
  if (images.length > QUIZ.MAX_IMAGES) {
    toast(`بناخذ أول ${QUIZ.MAX_IMAGES} صورة بس`, 'info');
    images = images.slice(0, QUIZ.MAX_IMAGES);
  }
  const jobs = [
    ...(text.length >= 30 ? chunkText(text).map(t => ({ text: t })) : []),
    ...images.map(img => ({ image: img }))
  ];
  if (!jobs.length) throw new Error('ما لقينا أسئلة نقدر نقرأها في الملفات');
  return jobs;
}

// يقسم النص لأجزاء عند نهاية الأسطر
function chunkText(text) {
  const chunks = [];
  let cur = '';
  for (const line of text.split('\n')) {
    if ((cur + line).length > QUIZ.CHUNK && cur.trim()) { chunks.push(cur); cur = ''; }
    cur += line + '\n';
    while (cur.length > QUIZ.CHUNK) { chunks.push(cur.slice(0, QUIZ.CHUNK)); cur = cur.slice(QUIZ.CHUNK); }
  }
  if (cur.trim()) chunks.push(cur);
  return chunks;
}

function setProgress(pct, label) {
  const box = $('#qProgress');
  box.hidden = pct === null;
  if (pct === null) return;
  $('i', box).style.width = pct + '%';
  $('span', box).textContent = label;
}

// يجهز الأسئلة: يخلط الترتيب ويخلط خيارات الاختيار من متعدد
function prepare(list) {
  return shuffle(list).slice(0, QUIZ.MAX_Q).map(q => {
    if (q.type !== 'mcq') return { ...q };
    const order = shuffle(q.options.map((_, i) => i));
    return { ...q, options: order.map(i => q.options[i]), answer: order.indexOf(q.answer) };
  });
}


// تنظيف سؤال واحد من رد الذكاء الاصطناعي
function cleanQ(q) {
  const str = (v, n) => String(v ?? '').trim().slice(0, n);
  const type = ['mcq', 'tf', 'short', 'essay'].includes(q?.type) ? q.type : null;
  const question = str(q?.question, 1500);
  if (!type || !question) return null;
  const out = { type, question, explanation: str(q.explanation, 500) };
  if (type === 'mcq' || type === 'tf') {
    const options = Array.isArray(q.options) ? q.options.map(o => str(o, 400)).filter(Boolean).slice(0, 8) : [];
    const answer = Number(q.answer);
    if (options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) return null;
    out.options = options;
    out.answer = answer;
  } else {
    out.answer = str(q.answer, 2000);
  }
  return out;
}

// يقرأ JSON حتى لو انقطع آخره (ياخذ الأسئلة الكاملة بس)
function parseQuestions(raw) {
  const a = raw.indexOf('{');
  if (a < 0) throw new Error('رد فاضي من الذكاء الاصطناعي');
  raw = raw.slice(a);
  try { return JSON.parse(raw.slice(0, raw.lastIndexOf('}') + 1)).questions || []; } catch { }
  let end = raw.length;
  for (let t = 0; t < 60; t++) {
    end = raw.lastIndexOf('}', end - 1);
    if (end < 0) break;
    try { return JSON.parse(raw.slice(0, end + 1) + ']}').questions || []; } catch { }
  }
  throw new Error('رد غير مكتمل من الذكاء الاصطناعي');
}

// يرسل جزء للسيرفر ويقرأ الرد أول بأول
async function askQuiz(job, mode) {
  const s = Auth.current();
  const res = await fetch('/api/quiz', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (s?.token || '') },
    body: JSON.stringify({ ...job, mode })
  });
  if (!res.ok) {
    let d = {};
    try { d = await res.json(); } catch { }
    if (res.status === 401) { Auth.logout(); showScreen('auth'); }
    throw new Error(d.error || `صار خطأ في السيرفر (${res.status})`);
  }
  return parseQuestions(await res.text()).map(cleanQ).filter(Boolean);
}

$('#qFile').addEventListener('change', e => {
  quiz.files = [...e.target.files].slice(0, QUIZ.MAX_FILES);
  quiz.jobs = null;
  const n = quiz.files.length;
  if (e.target.files.length > QUIZ.MAX_FILES) toast(`بناخذ أول ${QUIZ.MAX_FILES} ملفات بس`, 'info');
  $('#qFileName').textContent = !n ? 'اضغط لاختيار ملفات أو صور'
    : n === 1 ? quiz.files[0].name
    : `${n} ملفات: ` + quiz.files.map(f => f.name).join('، ');
  $('#dropZone').classList.toggle('has', n > 0);
});

async function generateQuiz(mode) {
  if (quiz.busy) return;
  if (CONFIG.DEMO_MODE) return toast('صانع الكويز يشتغل بس على الموقع المنشور (يحتاج السيرفر)', 'err');
  if (!quiz.files.length && !quiz.jobs) return toast('اختر ملف أو صورة أول 📄', 'err');

  quiz.busy = true;
  quiz.mode = mode;
  const btn = $('#qGo');
  btn.disabled = true;

  try {
    if (!quiz.jobs) {
      setProgress(5, 'نقرأ الملفات...');
      quiz.jobs = await buildJobs(quiz.files);
    }

    const chunks = quiz.jobs;
    const results = [];
    let next = 0, done = 0, failed = 0, lastErr = null, fatal = null;
    setProgress(10, `الذكاء الاصطناعي يجهز الأسئلة... (0/${chunks.length})`);

    const worker = async () => {
      while (next < chunks.length && !fatal) {
        const i = next++;
        try {
          results[i] = await askQuiz({ ...chunks[i], first: i === 0 }, mode);
        } catch (e) {
          failed++;
          lastErr = e;
          if (/الحد اليومي|غير مفعّلة|سجّل دخول/.test(e.message)) fatal = e;
        }
        done++;
        setProgress(10 + Math.round((done / chunks.length) * 85), `الذكاء الاصطناعي يجهز الأسئلة... (${done}/${chunks.length})`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(QUIZ.PARALLEL, chunks.length) }, worker));
    if (fatal) throw fatal;

    const all = results.flat().filter(Boolean);
    if (!all.length && lastErr) throw lastErr;
    if (!all.length) throw new Error('ما قدرنا نطلع أسئلة من الملفات. تأكد إنها بنك أسئلة واضح');
    if (failed) toast(`تخطينا ${failed} جزء ما قدرنا نقرأه`, 'info');

    quiz.isBank = false;
    quiz.lib = null;
    quiz.title = quiz.files.map(f => f.name.replace(/\.[^.]+$/, '')).join('، ').slice(0, 100);
    quiz.questions = prepare(all);
    quiz.graded = false;
    setProgress(100, 'جاهز!');
    showQuiz();
    toast(`🧠 جهزنا ${quiz.questions.length} سؤال`, 'ok');
  } catch (e) {
    toast(esc(e.message), 'err', 6000);
  } finally {
    quiz.busy = false;
    btn.disabled = false;
    setTimeout(() => setProgress(null), 1200);
  }
}

$('#qGo').addEventListener('click', () => {
  generateQuiz($('input[name=qMode]:checked').value);
});

// يفتح الكويز في تبويب المذاكرة
function showQuiz() {
  View.go('study');
  Study.sub('quiz');
  renderQuiz();
  requestAnimationFrame(() => $('#quizRun').scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

function renderQuiz(scoreText = '') {
  const box = $('#quizRun');
  quiz.closed = false;
  box.hidden = false;
  const g = quiz.graded;

  box.innerHTML = `
    <div class="quiz-head">
      <h3>${quiz.isBank ? '📕 بنك الأخطاء' : quiz.lib ? `📚 ${esc(quiz.lib.title)}` : '📝 الكويز'} (${quiz.questions.length} سؤال)</h3>
      <span class="pill">${quiz.isBank ? 'اللي تصححه ينحذف من البنك' : quiz.lib ? `من مكتبة ${esc(quiz.lib.code)}` : quiz.mode === 'vary' ? '🔀 أرقام وصياغة جديدة' : '📋 نفس الأسئلة'}</span>
    </div>
    ${scoreText}
    ${quiz.questions.map((q, i) => {
      const cls = !g ? '' : q.score === 1 ? 'ok' : q.score === 0.5 ? 'half' : 'bad';
      let body;
      if (q.type === 'mcq' || q.type === 'tf') {
        body = q.options.map((o, k) => {
          const mark = g ? (k === q.answer ? 'right' : k === q.user ? 'wrong' : '') : '';
          return `<label class="opt ${mark}">
            <input type="radio" name="q${i}" value="${k}" ${q.user === k ? 'checked' : ''} ${g ? 'disabled' : ''}>
            <span>${esc(o)}</span></label>`;
        }).join('');
      } else {
        body = `<textarea data-i="${i}" placeholder="اكتب إجابتك هنا..." ${g ? 'disabled' : ''}>${esc(q.user || '')}</textarea>`;
      }
      let fb = '';
      if (g) {
        const model = (q.type === 'short' || q.type === 'essay') ? `<div><b>الإجابة النموذجية:</b> ${esc(q.answer)}</div>` : '';
        const extra = q.feedback ? `<div>${esc(q.feedback)}</div>` : '';
        const exp = q.explanation ? `<div class="muted small">💡 ${esc(q.explanation)}</div>` : '';
        if (model || extra || exp) fb = `<div class="fb">${model}${extra}${exp}</div>`;
      }
      return `<div class="qcard ${cls}">
        <div class="qn"><b>سؤال ${i + 1}</b><span class="pill">${QTYPE[q.type]}</span></div>
        <div class="qt">${esc(q.question)}</div>
        ${body}${fb}
      </div>`;
    }).join('')}
    <div class="quiz-actions">
      ${g ? `
        ${quiz.isBank
          ? (Mist.list.length ? `<button class="btn primary" data-qa="bank">📕 كمّل الأخطاء الباقية (${Mist.list.length})</button>` : '')
          : `<button class="btn primary" data-qa="again">🔁 نفس الكويز بترتيب جديد</button>
             ${quiz.lib ? '' : `<button class="btn ghost" data-qa="vary">🔀 نسخة بأرقام جديدة</button>
             <button class="btn ghost" data-qa="share">📚 شاركه في المكتبة</button>`}`}
        <button class="btn ghost" data-qa="close">✖ إغلاق</button>
      ` : `
        <button class="btn primary" data-qa="grade">✅ صحّح إجاباتي</button>
        <button class="btn ghost" data-qa="close">✖ إغلاق</button>
      `}
    </div>`;
}

// حفظ إجابات الطالب أول بأول
$('#quizRun').addEventListener('change', e => {
  const r = e.target.closest('input[type=radio]');
  if (r) quiz.questions[+r.name.slice(1)].user = +r.value;
});
$('#quizRun').addEventListener('input', e => {
  const t = e.target.closest('textarea[data-i]');
  if (t) quiz.questions[+t.dataset.i].user = t.value;
});

$('#quizRun').addEventListener('click', async e => {
  const b = e.target.closest('button[data-qa]');
  if (!b) return;
  const act = b.dataset.qa;

  if (act === 'close') { quiz.closed = true; $('#quizRun').hidden = true; return; }
  if (act === 'again') {
    quiz.questions = prepare(quiz.questions.map(({ user, score, feedback, ...q }) => q));
    quiz.graded = false;
    renderQuiz();
    $('#quizRun').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  if (act === 'vary') { generateQuiz('vary'); return; }
  if (act === 'bank') { openBank(); return; }
  if (act === 'share') { Library.shareForm(); return; }

  if (act === 'grade') {
    const unanswered = quiz.questions.filter(q => q.user === undefined || q.user === '').length;
    if (unanswered && !confirm(`باقي ${unanswered} سؤال بدون إجابة. تبي تصحح كذا؟`)) return;

    b.disabled = true;
    b.textContent = 'جاري التصحيح...';

    // الاختيارات تتصحح مباشرة
    quiz.questions.forEach(q => {
      if (q.type === 'mcq' || q.type === 'tf') q.score = q.user === q.answer ? 1 : 0;
    });

    // المقالي والقصير يصححه الذكاء الاصطناعي
    const open = quiz.questions.filter(q => q.type === 'short' || q.type === 'essay');
    const toAI = open.filter(q => String(q.user || '').trim());
    open.filter(q => !String(q.user || '').trim()).forEach(q => { q.score = 0; q.feedback = 'ما كتبت إجابة'; });

    try {
      const batches = [];
      for (let i = 0; i < toAI.length; i += 8) batches.push(toAI.slice(i, i + 8));
      await Promise.all(batches.map(async part => {
        const r = await api('grade', {
          method: 'POST',
          body: { items: part.map(q => ({ question: q.question, model: q.answer, answer: q.user })) }
        });
        part.forEach((q, k) => { q.score = r.results[k]?.score ?? 0; q.feedback = r.results[k]?.feedback || ''; });
      }));
    } catch (err) {
      toAI.filter(q => q.score === undefined).forEach(q => { q.score = 0; q.feedback = 'ما قدرنا نصححها، قارن إجابتك بالنموذجية'; });
      toast(esc(err.message), 'err');
    }

    quiz.graded = true;
    let bankNote = '';
    if (quiz.isBank) {
      const fixed = quiz.questions.filter(q => q.score === 1);
      Mist.remove(fixed.map(q => q.bankId));
      Mist.bump(quiz.questions.filter(q => q.score !== 1).map(q => q.bankId));
      bankNote = fixed.length ? `<br>🎉 صححت ${fixed.length} من أخطائك وانحذفت من البنك` : '';
    } else {
      const wrong = quiz.questions.filter(q => q.score !== 1);
      if (wrong.length) Mist.add(wrong);
      bankNote = wrong.length ? `<br>📕 انحفظت ${wrong.length} أسئلة في بنك الأخطاء` : '';
    }
    const total = quiz.questions.reduce((s, q) => s + (q.score || 0), 0);
    const pct = Math.round((total / quiz.questions.length) * 100);
    const msg = pct >= 90 ? 'أسطوري! 🏆' : pct >= 75 ? 'ممتاز 💪' : pct >= 50 ? 'زين، راجع الغلط 📚' : 'لا تيأس، جرّب مرة ثانية 🔁';
    let lbNote = '';
    if (quiz.lib && !CONFIG.DEMO_MODE) {
      try {
        const r = await api('library', { method: 'POST', body: { action: 'score', code: quiz.lib.code, id: quiz.lib.id, score: pct, uni: quiz.lib.uni } });
        lbNote = `<div class="lb"><b>🏆 لوحة الترتيب</b>${r.top.map((t, i) => `<div class="${t.me ? 'me' : ''}">${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} ${esc(t.name)}${t.me ? ' (أنت)' : ''} — ${t.score}%</div>`).join('')}${r.rank > 5 ? `<div class="me">ترتيبك: ${r.rank}</div>` : ''}</div>`;
      } catch { }
    }
    const shareHint = !quiz.isBank && !quiz.lib ? '<br>💡 عجبك الكويز؟ شاركه في المكتبة عشان يستفيد زملاؤك 👇' : '';
    renderQuiz(`<div class="score-box"><b>${pct}%</b>${total} من ${quiz.questions.length} — ${msg}${bankNote}${shareHint}${lbNote}</div>`);
    $('#quizRun').scrollIntoView({ behavior: 'smooth' });
  }
});


/* =========================================================
   📕 بنك الأخطاء
   ========================================================= */
// تخزين عام: localStorage + السيرفر
async function loadUserData(k) {
  const local = Store.get(`thk_${k}_${state.email}`, null);
  if (CONFIG.DEMO_MODE) return local;
  try { return (await api('data?k=' + k)).value ?? local; } catch { return local; }
}
const saveTimers = {};
function saveUserData(k, value) {
  Store.set(`thk_${k}_${state.email}`, value);
  if (CONFIG.DEMO_MODE) return;
  clearTimeout(saveTimers[k]);
  saveTimers[k] = setTimeout(() => {
    api('data?k=' + k, { method: 'PUT', body: { value } }).catch(e => toast('ما انحفظ على السيرفر: ' + esc(e.message), 'err'));
  }, 500);
}

const Mist = {
  list: [],
  MAX: 300,
  async load() {
    const v = await loadUserData('mistakes');
    this.list = Array.isArray(v) ? v : [];
    this.updateBtn();
  },
  save() { saveUserData('mistakes', this.list); this.updateBtn(); },
  key: q => (q.type + '|' + q.question).slice(0, 300),
  add(qs) {
    for (const q of qs) {
      const k = this.key(q);
      const old = this.list.find(m => this.key(m) === k);
      if (old) { old.misses = (old.misses || 1) + 1; old.at = Date.now(); continue; }
      const { user, score, feedback, bankId, ...clean } = q;
      this.list.push({ ...clean, id: uid(), misses: 1, at: Date.now() });
    }
    if (this.list.length > this.MAX) this.list = this.list.slice(-this.MAX);
    this.save();
  },
  remove(ids) {
    const set = new Set(ids);
    this.list = this.list.filter(m => !set.has(m.id));
    this.save();
  },
  bump(ids) {
    const set = new Set(ids);
    this.list.forEach(m => { if (set.has(m.id)) { m.misses = (m.misses || 1) + 1; m.at = Date.now(); } });
    this.save();
  },
  updateBtn() {
    const n = this.list.length;
    const c = $('#mistCount');
    if (c) c.textContent = `(${n})`;
  }
};

function openBank() {
  if (!Mist.list.length) return toast('بنك أخطائك فاضي 👌 حل كويز وأي سؤال تغلط فيه بينحفظ هنا', 'info', 5000);
  quiz.isBank = true;
  quiz.lib = null;
  quiz.graded = false;
  // الأسئلة اللي غلط فيها أكثر تطلع أول
  const sorted = [...Mist.list].sort((a, b) => (b.misses || 1) - (a.misses || 1)).slice(0, 40);
  quiz.questions = prepare(sorted.map(({ id, misses, at, ...q }) => ({ ...q, bankId: id })));
  showQuiz();
}
$('#mistBtn').addEventListener('click', openBank);

/* =========================================================
   🗓️ خطة المذاكرة الذكية
   ========================================================= */
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const Planner = {
  data: { chat: [], plan: null, material: '', materialName: '' },
  busy: false,
  async load() {
    const v = await loadUserData('plan');
    this.data = { chat: [], plan: null, material: '', materialName: '', ...(v || {}) };
    this.render();
  },
  save() { saveUserData('plan', this.data); },
  reset(confirmFirst = true) {
    if (confirmFirst && !confirm('تبي تمسح المحادثة والخطة وتبدأ من جديد؟')) return;
    this.data = { chat: [], plan: null, material: '', materialName: '' };
    if (confirmFirst) this.save();
    this.render();
  },

  render() {
    // المحادثة
    const chat = $('#planChat');
    if (!this.data.chat.length) {
      chat.innerHTML = `<div class="bubble ai">هلا 👋 أنا مساعدك للمذاكرة. قول لي: وش الاختبار ومتى؟ وش الفصول أو السكاشن؟ وكم يوم تبي تخلص فيه؟ وإذا عندك أيام مضغوطة قول لي. وأنا أشوف تذكيراتك وأوزّع لك المذاكرة 📚</div>`;
    } else {
      chat.innerHTML = this.data.chat.map(m => `<div class="bubble ${m.role === 'user' ? 'me' : 'ai'}">${esc(m.text)}</div>`).join('');
    }
    if (this.busy) chat.insertAdjacentHTML('beforeend', '<div class="bubble ai typing">يفكّر... ✍️</div>');
    chat.scrollTop = chat.scrollHeight;

    // المرفق
    $('#planFileName').textContent = this.data.materialName
      ? `📎 مرفق: ${this.data.materialName} (اضغط للتغيير)`
      : 'أرفق محتوى الاختبار: سكاشن، سلايدات، ملخص (اختياري)';
    $('#planAttach').classList.toggle('has', !!this.data.materialName);

    // الخطة
    const p = this.data.plan;
    const view = $('#planView');
    if (!p || !Array.isArray(p.days) || !p.days.length) { view.innerHTML = ''; return; }
    const today = isoDay(new Date());
    let total = 0, done = 0;
    p.days.forEach(d => d.items.forEach(it => { total++; if (it.done) done++; }));
    view.innerHTML = `
      <div class="plan-title">📋 ${esc(p.title || 'خطتك')}</div>
      <div class="plan-bar">
        <div class="plan-progress">خلصت ${done} من ${total} مهمة ${total ? `(${Math.round(done / total * 100)}%)` : ''}</div>
        <button class="btn ghost sm" id="planDelete" type="button">🗑️ احذف الخطة</button>
      </div>
      ${total && done === total ? `<div class="plan-done">🎉 كفو! خلصت الخطة كاملة. تقدر تحذفها وتبدأ خطة جديدة لاختبارك الجاي.</div>` : ''}
      <div class="plan-days">
        ${p.days.map((d, di) => {
          const dt = new Date(d.date + 'T12:00:00');
          const cls = d.date === today ? 'today' : d.date < today ? 'past' : '';
          const mins = d.items.reduce((s, it) => s + (Number(it.minutes) || 0), 0);
          return `<div class="day ${cls}">
            <h4>${d.date === today ? '⭐ اليوم — ' : ''}${WEEKDAYS[dt.getDay()] || ''} ${dt.getDate()}/${dt.getMonth() + 1}
              <small>${mins ? `${Math.round(mins / 6) / 10} ساعة` : ''}</small></h4>
            ${d.items.map((it, ii) => `
              <label class="pitem ${it.done ? 'done' : ''}">
                <input type="checkbox" data-d="${di}" data-i="${ii}" ${it.done ? 'checked' : ''}>
                <span><span class="ps">${esc(it.subject)}</span> <span class="pt">${esc(it.task)}</span>
                ${it.minutes ? `<span class="pm"> · ${it.minutes} د</span>` : ''}</span>
              </label>`).join('') || '<div class="muted small">راحة 😌</div>'}
          </div>`;
        }).join('')}
      </div>`;
  },

  // تنظيف الخطة اللي ترجع من الذكاء الاصطناعي
  cleanPlan(p, old) {
    if (!p || !Array.isArray(p.days)) return null;
    const doneMap = new Map();
    old?.days?.forEach(d => d.items.forEach(it => { if (it.done) doneMap.set(d.date + '|' + it.task, true); }));
    const days = p.days.slice(0, 31).map(d => ({
      date: /^\d{4}-\d{2}-\d{2}$/.test(d?.date) ? d.date : null,
      items: (Array.isArray(d?.items) ? d.items : []).slice(0, 10).map(it => {
        const task = String(it?.task ?? '').slice(0, 200);
        return {
          subject: String(it?.subject ?? '').slice(0, 60),
          task,
          minutes: Math.min(Math.max(Number(it?.minutes) || 0, 0), 600),
          done: doneMap.has(d.date + '|' + task)
        };
      }).filter(it => it.task)
    })).filter(d => d.date).sort((a, b) => a.date.localeCompare(b.date));
    return days.length ? { title: String(p.title ?? '').slice(0, 100), days } : null;
  },

  async send() {
    if (this.busy) return;
    if (CONFIG.DEMO_MODE) return toast('المساعد يشتغل بس على الموقع المنشور (يحتاج السيرفر)', 'err');
    const box = $('#planMsg');
    const message = box.value.trim();
    if (!message) return toast('اكتب رسالتك للمساعد ✍️', 'err');

    this.data.chat.push({ role: 'user', text: message });
    box.value = '';
    this.busy = true;
    $('#planSend').disabled = true;
    this.render();

    const now = new Date();
    const tasks = Tasks.all().filter(t => !t.done && !t.hidden && t.due > Date.now() - 86400000).map(t => ({
      type: (TYPES[t.type] || TYPES.task).label,
      subject: t.subject,
      title: [t.title, t.grade ? `(${t.grade})` : '', t.note ? `ملاحظة: ${t.note}` : ''].filter(Boolean).join(' '),
      due: `${isoDay(new Date(t.due))} ${new Date(t.due).toTimeString().slice(0, 5)}`
    }));

    try {
      const s = Auth.current();
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (s?.token || '') },
        body: JSON.stringify({
          message,
          history: this.data.chat.slice(-9, -1),
          plan: this.data.plan,
          tasks,
          today: `${isoDay(now)} (${WEEKDAYS[now.getDay()]})`,
          material: this.data.material
        })
      });
      if (!res.ok) {
        let d = {};
        try { d = await res.json(); } catch { }
        if (res.status === 401) { Auth.logout(); showScreen('auth'); }
        throw new Error(d.error || `صار خطأ في السيرفر (${res.status})`);
      }
      const raw = await res.text();
      const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
      let out;
      try { out = JSON.parse(raw.slice(a, b + 1)); } catch { throw new Error('رد المساعد ما اكتمل، جرّب مرة ثانية'); }
      const plan = out.plan ? this.cleanPlan(out.plan, this.data.plan) : null;
      if (plan) this.data.plan = plan;
      this.data.chat.push({ role: 'assistant', text: String(out.reply || (plan ? 'جهزت لك الخطة 👇' : '...')).slice(0, 1500) });
      if (this.data.chat.length > 40) this.data.chat = this.data.chat.slice(-40);
      this.save();
    } catch (e) {
      this.data.chat.pop();
      box.value = message;
      toast(esc(e.message), 'err', 6000);
    } finally {
      this.busy = false;
      $('#planSend').disabled = false;
      this.render();
    }
  }
};

$('#planSend').addEventListener('click', () => Planner.send());
$('#planMsg').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); Planner.send(); }
});
$('#planReset').addEventListener('click', () => Planner.reset());
$('#planView').addEventListener('click', e => {
  if (e.target.id !== 'planDelete') return;
  if (!confirm('تبي تحذف الخطة والمحادثة؟ ما تقدر ترجعها.')) return;
  Planner.reset(false);
  Planner.save();
  toast('انحذفت الخطة 🗑️ — جاهز لخطة جديدة', 'ok');
});
$('#planView').addEventListener('change', e => {
  const c = e.target.closest('input[type=checkbox][data-d]');
  if (!c) return;
  const it = Planner.data.plan.days[+c.dataset.d].items[+c.dataset.i];
  it.done = c.checked;
  Planner.save();
  Planner.render();
  if (c.checked) toast('كفو! ✅', 'ok', 1500);
});

// إرفاق محتوى الاختبار (نقرأ النص بس)
$('#planFile').addEventListener('change', async e => {
  const files = [...e.target.files].slice(0, 5);
  if (!files.length) return;
  $('#planFileName').textContent = 'نقرأ الملفات...';
  try {
    let text = '';
    for (const f of files) {
      const name = f.name.toLowerCase();
      if (name.endsWith('.pdf')) text += (await readPdf(f)).text + '\n\n';
      else if (name.endsWith('.docx')) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
        text += (await window.mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value + '\n\n';
      } else if (name.endsWith('.txt')) text += (await f.text()) + '\n\n';
    }
    text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (text.length < 30) throw new Error('ما لقينا نص في الملف (إذا كان صور، اكتب الفصول بنفسك في الرسالة)');
    Planner.data.material = text.slice(0, 30000);
    Planner.data.materialName = files.map(f => f.name).join('، ');
    Planner.save();
    toast('📎 أرفقنا المحتوى، الحين قول للمساعد عن اختبارك', 'ok');
  } catch (err) {
    toast(esc(err.message), 'err', 6000);
  }
  e.target.value = '';
  Planner.render();
});



/* =========================================================
   📚 مكتبة المواد (كل جامعة لها مكتبة)
   ========================================================= */
const SECS = {
  quiz:   { icon: '📝', label: 'كويزات وتست بانك' },
  sum:    { icon: '📄', label: 'ملخصات' },
  slides: { icon: '🖼️', label: 'سلايدات' },
  links:  { icon: '🔗', label: 'شروحات وروابط' }
};
const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' ميقا' : Math.max(1, Math.round(b / 1024)) + ' كيلو';

const Library = {
  courses: [],
  uni: null,        // الجامعة المعروضة (الأدمن يقدر يتصفح غير جامعته)
  uniName: '',
  current: null,    // { course, quizzes, res }
  sec: 'quiz',
  loaded: false,
  reset() { this.courses = []; this.current = null; this.uni = null; this.loaded = false; this.sec = 'quiz'; },
  async load(uni) {
    if (CONFIG.DEMO_MODE) { this.loaded = true; this.render(); return; }
    if (this.busy && !uni) return;
    this.busy = true;
    try {
      const r = await api('library?action=courses' + (uni ? '&uni=' + uni : ''));
      this.courses = r.courses || [];
      this.uni = r.uni;
      this.uniName = r.uniName;
    } catch (e) {
      this.error = e.message;
    }
    this.busy = false;
    this.loaded = true;
    this.render();
  },
  q(extra = '') { return `library?${this.uni && state.admin ? 'uni=' + this.uni + '&' : ''}${extra}`; },
  body(b) { return state.admin && this.uni ? { ...b, uni: this.uni } : b; },

  render() {
    const box = $('#libBody');
    if (this.current) return this.renderCourse();
    if (CONFIG.DEMO_MODE) { box.innerHTML = '<div class="empty"><span>📚</span>المكتبة تشتغل بس على الموقع المنشور</div>'; return; }
    if (!state.profile?.uni) {
      box.innerHTML = `<div class="empty"><span>🎓</span>اختر جامعتك عشان تشوف مكتبتها<br><br><button class="btn primary" data-lib="uni" type="button">اختر الجامعة</button></div>`;
      return;
    }
    if (!this.loaded) { box.innerHTML = '<div class="empty"><span>⏳</span>نحمّل المكتبة...</div>'; return; }
    const q = ($('#libSearch')?.value || '').trim().toLowerCase();
    const qq = q.replace(/\s/g, '');
    const list = this.courses.filter(c => !q || c.code.toLowerCase().includes(qq) || c.name.toLowerCase().includes(q));
    const other = state.admin && this.uni !== state.profile.uni;
    box.innerHTML = `
      <div class="lib-top">
        <div>
          <h3>📚 مكتبة ${esc(this.uniName || '')}</h3>
          <p class="muted small">ملخصات وسلايدات وكويزات وروابط شروحات، يضيفها طلاب جامعتك لكل مادة.</p>
        </div>
        <button class="btn primary sm" data-lib="newCourse" type="button">＋ مادة جديدة</button>
      </div>
      ${state.admin ? `<label class="admin-uni">👑 تصفح مكتبة جامعة:
        <select id="libUni">${UNIS.map(([id, n]) => `<option value="${id}" ${id === this.uni ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>` : ''}
      ${other ? '<p class="warn small">انت تتصفح مكتبة جامعة غير جامعتك (أدمن)</p>' : ''}
      <input id="libSearch" placeholder="🔎 دوّر على مادة: IE200، فيزياء..." value="${esc(q)}">
      <div class="lib-courses">
        ${list.length ? list.map(c => {
          const n = c.n || { quiz: c.count || 0 };
          return `<button class="lib-course" data-code="${esc(c.code)}" type="button">
            <b dir="ltr">${esc(c.code)}</b>
            <span>${esc(c.name)}</span>
            <small>${Object.entries(SECS).map(([k, s]) => `${s.icon} ${n[k] || 0}`).join(' · ')}</small>
          </button>`;
        }).join('')
        : `<div class="empty"><span>📚</span>${this.error ? esc(this.error) : this.courses.length ? 'ما لقينا مادة بهالاسم. تقدر تضيفها 👆' : 'المكتبة فاضية للحين. أضف أول مادة وكن أول واحد 🚀'}</div>`}
      </div>`;
    const inp = $('#libSearch');
    inp.addEventListener('input', () => { const pos = inp.selectionStart; this.render(); const n = $('#libSearch'); n.focus(); n.setSelectionRange(pos, pos); });
    $('#libUni')?.addEventListener('change', e => { this.loaded = false; this.render(); this.load(e.target.value); });
  },

  async openCourse(code, sec) {
    try {
      this.current = await api(this.q('action=course&code=' + encodeURIComponent(code)));
      if (sec) this.sec = sec;
      this.renderCourse();
    } catch (e) { toast(esc(e.message), 'err'); }
  },
  // الأدمن: يفتح مادة من جامعة ثانية (من قائمة البلاغات)
  async openAt(uni, code) {
    View.go('lib');
    if (uni !== this.uni) await this.load(uni);
    await this.openCourse(code);
  },

  resHTML(r) {
    const icon = r.kind === 'link' ? '🔗' : r.kind === 'image' ? '🖼️' : r.mime === 'application/pdf' ? '📕' : '📄';
    const canQuiz = this.sec === 'quiz' && r.kind !== 'link' && (r.kind === 'image' || r.mime === 'application/pdf');
    let host = '';
    if (r.kind === 'link') { try { host = new URL(r.url).hostname.replace(/^www\./, ''); } catch { } }
    return `<div class="lib-item ${r.hidden ? 'hid' : ''}">
      <div class="li-ico">${icon}</div>
      <div class="li-main">
        <b>${esc(r.title)}</b>
        <div class="muted small">${r.kind === 'link' ? `<span dir="ltr">${esc(host)}</span>` : esc(r.fname) + ' · ' + fmtSize(r.size)} · ${esc(r.by)} · ${fmtShort(r.at)}${r.hidden ? ' · 🚫 مخفي بسبب بلاغات' : ''}</div>
      </div>
      <div class="acts">
        <a class="btn primary sm" href="${esc(r.url)}" target="_blank" rel="noopener">${r.kind === 'link' ? 'افتح ↗' : 'افتح'}</a>
        ${canQuiz ? `<button class="btn ghost sm" data-lib="toQuiz" data-id="${r.id}" type="button" title="حوّل الملف لكويز تفاعلي">🧠 كويز</button>` : ''}
        ${r.mine || state.admin ? `<button class="btn ghost sm" data-lib="del" data-kind="res" data-id="${r.id}" type="button">🗑️</button>` : `<button class="btn ghost sm" data-lib="report" data-kind="res" data-id="${r.id}" type="button" title="بلّغ عن محتوى غلط أو غير مناسب">🚩</button>`}
        ${r.hidden && state.admin ? `<button class="btn ghost sm" data-lib="restore" data-kind="res" data-id="${r.id}" type="button">♻️</button>` : ''}
      </div>
    </div>`;
  },
  quizHTML(q) {
    return `<div class="lib-item ${q.hidden ? 'hid' : ''}">
      <div class="li-ico">🧠</div>
      <div class="li-main">
        <b>${esc(q.title)}</b>
        <div class="muted small">كويز تفاعلي · ${q.n} سؤال · ${esc(q.by)} · ${fmtShort(q.at)} · انحل ${q.plays} مرة
          ${q.top[0] ? ` · 🏆 أعلى درجة ${q.top[0].score}%` : ''}${q.hidden ? ' · 🚫 مخفي بسبب بلاغات' : ''}</div>
      </div>
      <div class="acts">
        <button class="btn primary sm" data-lib="play" data-id="${q.id}" type="button">▶️ حل</button>
        ${q.mine || state.admin ? `<button class="btn ghost sm" data-lib="del" data-kind="quiz" data-id="${q.id}" type="button">🗑️</button>` : `<button class="btn ghost sm" data-lib="report" data-kind="quiz" data-id="${q.id}" type="button" title="بلّغ عن كويز فيه غلط">🚩</button>`}
        ${q.hidden && state.admin ? `<button class="btn ghost sm" data-lib="restore" data-kind="quiz" data-id="${q.id}" type="button">♻️</button>` : ''}
      </div>
    </div>`;
  },
  renderCourse() {
    const { course, quizzes, res } = this.current;
    const counts = {};
    Object.keys(SECS).forEach(k => counts[k] = res.filter(r => r.sec === k).length + (k === 'quiz' ? quizzes.length : 0));
    const items = res.filter(r => r.sec === this.sec);
    const list = (this.sec === 'quiz' ? quizzes.map(q => this.quizHTML(q)) : []).concat(items.map(r => this.resHTML(r)));
    $('#libBody').innerHTML = `
      <button class="btn ghost sm" data-lib="back" type="button">→ رجوع للمواد</button>
      <div class="lib-head">
        <h3><span dir="ltr">${esc(course.code)}</span> — ${esc(course.name)}</h3>
        ${course.info ? `<p class="muted small">${esc(course.info)}</p>` : ''}
      </div>
      <div class="sec-tabs">
        ${Object.entries(SECS).map(([k, s]) => `<button type="button" data-sec="${k}" class="${this.sec === k ? 'sel' : ''}">${s.icon} ${s.label} <small>${counts[k]}</small></button>`).join('')}
      </div>
      <button class="btn primary full" data-lib="add" type="button">＋ أضف ${SECS[this.sec].label}</button>
      ${this.sec === 'quiz' ? '<p class="muted small center" style="margin:8px 0 0">💡 تبي كويز تفاعلي؟ ارفع بنك الأسئلة في <b>صانع الكويز</b>، وبعد ما تحله اضغط "شاركه في المكتبة"</p>' : ''}
      <div class="lib-list">
        ${list.length ? list.join('') : `<div class="empty"><span>📭</span>ما فيه ${SECS[this.sec].label} لهالمادة للحين. كن أول واحد يضيف 🙌</div>`}
      </div>`;
  },

  async play(id) {
    const code = this.current.course.code;
    try {
      const r = await api(this.q(`action=quiz&code=${encodeURIComponent(code)}&id=${encodeURIComponent(id)}`));
      if (!r.questions.length) return toast('الكويز فاضي', 'err');
      quiz.isBank = false;
      quiz.lib = { code, id, title: r.quiz.title, uni: this.uni };
      quiz.graded = false;
      quiz.questions = prepare(r.questions);
      showQuiz();
    } catch (e) { toast(esc(e.message), 'err'); }
  },
  async action(act, id, kind) {
    const code = this.current.course.code;
    if (act === 'report' && !confirm('تبلّغ عن هذا؟ (فيه غلط أو محتوى غير مناسب)')) return;
    if (act === 'del' && !confirm('تبي تحذفه من المكتبة؟')) return;
    try {
      await api('library', { method: 'POST', body: this.body({ action: act === 'del' ? 'delete' : act, code, id, kind }) });
      toast(act === 'report' ? 'شكراً، وصلنا بلاغك 🙏' : act === 'del' ? 'انحذف 🗑️' : 'رجع ظاهر ♻️', 'ok');
      await this.openCourse(code);
      this.load(this.uni);
    } catch (e) { toast(esc(e.message), 'err'); }
  },

  // ملف من المكتبة → صانع الكويز
  async toQuiz(id) {
    const r = this.current.res.find(x => x.id === id);
    if (!r) return;
    toast('نجهز الملف... ⏳', 'info', 2500);
    try {
      const res = await fetch(r.url);
      if (!res.ok) throw new Error('ما قدرنا نفتح الملف');
      const blob = await res.blob();
      const file = new File([blob], r.fname || (r.title + (r.kind === 'image' ? '.jpg' : '.pdf')), { type: r.mime || blob.type });
      quiz.files = [file];
      quiz.jobs = null;
      $('#qFileName').textContent = file.name;
      $('#dropZone').classList.add('has');
      View.go('study');
      Study.sub('quiz');
      $('#quizMaker').scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('📄 جاهز! اختر النوع واضغط "ولّد الكويز" ✨', 'ok', 5000);
    } catch (e) { toast(esc(e.message), 'err'); }
  },

  // نافذة: مادة جديدة
  newCourseForm() {
    sheetForm(`
      <b>📚 مادة جديدة في مكتبة ${esc(this.uniName)}</b>
      <label>رمز المادة<input name="code" dir="ltr" placeholder="IE200" required></label>
      <label>اسم المادة<input name="name" placeholder="مهارات الاتصال التقنية" required></label>
      <label>نبذة <small class="muted">(اختياري)</small><input name="info" placeholder="مثلاً: الدكتور، الفصول، نصايح"></label>
      <button class="btn primary full" type="submit">أضف المادة</button>`,
      async form => {
        const r = await api('library', { method: 'POST', body: this.body({ action: 'course', code: form.code.value, name: form.name.value, info: form.info.value }) });
        toast(r.created ? `🎉 انضافت ${esc(r.course.code)}` : 'المادة موجودة من قبل 👇', 'ok');
        await this.load(this.uni);
        await this.openCourse(r.course.code, 'sum');
      });
  },

  // نافذة: إضافة رابط / ملف / صورة
  addForm() {
    const sec = this.sec, code = this.current.course.code;
    const hint = { quiz: 'مثلاً: تست بانك الميد', sum: 'مثلاً: ملخص الفصل 3', slides: 'مثلاً: سلايدات الأسبوع 5', links: 'مثلاً: قناة شروحات على تليجرام' }[sec];
    const el = sheetForm(`
      <b>${SECS[sec].icon} أضف في ${SECS[sec].label} — <span dir="ltr">${esc(code)}</span></b>
      <div class="kind-pick">
        <label><input type="radio" name="kind" value="link" ${sec === 'links' ? 'checked' : ''}><span>🔗 رابط</span></label>
        <label><input type="radio" name="kind" value="file" ${sec !== 'links' ? 'checked' : ''}><span>📄 ملف</span></label>
        <label><input type="radio" name="kind" value="image"><span>🖼️ صورة</span></label>
      </div>
      <label>العنوان<input name="title" placeholder="${hint}" required></label>
      <label data-k="link">الرابط<input name="url" dir="ltr" placeholder="https://t.me/... أو رابط درايف أو يوتيوب"></label>
      <label data-k="file">الملف <small class="muted">(PDF · Word · PowerPoint — حتى 4 ميقا)</small>
        <input name="file" type="file" accept=".pdf,.docx,.pptx"></label>
      <label data-k="image">الصورة <small class="muted">(تنضغط تلقائياً)</small>
        <input name="image" type="file" accept="image/*"></label>
      <p class="muted small">🔒 اسمك يطلع مختصر. لا ترفع شي فيه بيانات شخصية. الملف الكبير؟ ارفعه على قوقل درايف وحط الرابط.</p>
      <button class="btn primary full" type="submit">أضف 🚀</button>`,
      async form => {
        const kind = form.kind.value;
        const title = form.title.value.trim();
        if (!title) throw new Error('اكتب عنوان');
        if (kind === 'link') {
          await api('library', { method: 'POST', body: this.body({ action: 'link', code, sec, title, url: form.url.value }) });
        } else {
          const f = (kind === 'image' ? form.image : form.file).files[0];
          if (!f) throw new Error(kind === 'image' ? 'اختر صورة' : 'اختر ملف');
          let blob = f, mime = f.type, name = f.name;
          if (kind === 'image') {
            const b64 = await toJpeg(f);
            blob = await (await fetch('data:image/jpeg;base64,' + b64)).blob();
            mime = 'image/jpeg';
            name = name.replace(/\.[^.]+$/, '') + '.jpg';
          } else {
            const ext = name.toLowerCase().split('.').pop();
            mime = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }[ext];
            if (!mime) throw new Error('نوع الملف غير مدعوم (PDF، Word، PowerPoint)');
            if (f.size > 4 * 1048576) throw new Error('الملف أكبر من 4 ميقا. ارفعه على قوقل درايف وحط الرابط 🔗');
          }
          await upload(blob, mime, { code, sec, title, name, ...(state.admin && this.uni ? { uni: this.uni } : {}) });
        }
        toast('🎉 انضاف! شكراً إنك تفيد زملاءك', 'ok');
        await this.openCourse(code);
        this.load(this.uni);
      });
    const form = el.querySelector('form');
    const sync = () => $$('[data-k]', form).forEach(l => l.hidden = l.dataset.k !== form.kind.value);
    form.addEventListener('change', e => { if (e.target.name === 'kind') sync(); });
    sync();
  },

  // نافذة مشاركة الكويز
  shareForm() {
    if (CONFIG.DEMO_MODE) return toast('المكتبة تشتغل بس على الموقع المنشور', 'err');
    if (!state.profile?.uni) return UniPicker.open();
    sheetForm(`
      <b>📚 شارك الكويز في مكتبة ${esc(UNI_NAME[state.profile.uni] || '')}</b>
      <small class="muted">زملاؤك في المادة بيقدرون يحلونه. اسمك يطلع مختصر.</small>
      <label>رمز المادة<input name="code" dir="ltr" list="libCodes" placeholder="IE200" required></label>
      <datalist id="libCodes">${(this.uni === state.profile.uni ? this.courses : []).map(c => `<option value="${esc(c.code)}">${esc(c.name)}</option>`).join('')}</datalist>
      <label>اسم المادة<input name="name" placeholder="مهارات الاتصال التقنية"></label>
      <label>عنوان الكويز<input name="title" value="${esc(quiz.title || '')}" placeholder="مثلاً: أسئلة الفصل 3"></label>
      <button class="btn primary full" type="submit">شارك 🚀</button>`,
      async form => {
        const questions = quiz.questions.map(({ user, score, feedback, bankId, ...q }) => q);
        const r = await api('library', { method: 'POST', body: {
          action: 'share', code: form.code.value, name: form.name.value, title: form.title.value, questions
        } });
        toast(`🎉 انضاف الكويز لمكتبة ${esc(r.code)}!`, 'ok', 6000);
        this.uni = null;
        await this.load();
      },
      form => form.code.addEventListener('input', () => {
        const c = this.courses.find(x => x.code === form.code.value.toUpperCase().replace(/[\s_\-]/g, ''));
        if (c) form.name.value = c.name;
      }));
  }
};

// نافذة فيها نموذج: onSubmit ترمي خطأ لو فيه مشكلة
function sheetForm(inner, onSubmit, setup) {
  const el = document.createElement('div');
  el.className = 'sheet';
  el.innerHTML = `<form class="sheet-box glass" novalidate>${inner}<button class="btn ghost full" type="button" data-x>إلغاء</button></form>`;
  const form = el.querySelector('form');
  el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-x]')) el.remove(); });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'لحظة... ⏳';
    try {
      await onSubmit(form);
      el.remove();
    } catch (err) {
      toast(esc(err.message), 'err', 6000);
      btn.disabled = false;
      btn.textContent = label;
    }
  });
  document.body.appendChild(el);
  setup?.(form);
  form.querySelector('input:not([type=radio]):not([type=file])')?.focus();
  return el;
}

// رفع ملف (الجسم = الملف نفسه)
async function upload(blob, mime, params) {
  const s = Auth.current();
  const res = await fetch('/api/upload?' + new URLSearchParams(params), {
    method: 'POST',
    headers: { 'content-type': mime, authorization: 'Bearer ' + (s?.token || '') },
    body: blob
  });
  let d = {};
  try { d = await res.json(); } catch { }
  if (res.status === 413 && !d.error) d.error = 'الملف كبير، ارفعه على قوقل درايف وحط الرابط 🔗';
  if (!res.ok) throw new Error(d.error || 'ما قدرنا نرفع الملف');
  return d;
}

$('#libBody').addEventListener('click', e => {
  const c = e.target.closest('.lib-course');
  if (c) return Library.openCourse(c.dataset.code, 'quiz');
  const t = e.target.closest('[data-sec]');
  if (t) { Library.sec = t.dataset.sec; Library.renderCourse(); return; }
  const b = e.target.closest('[data-lib]');
  if (!b) return;
  const act = b.dataset.lib;
  if (act === 'back') { Library.current = null; Library.render(); return; }
  if (act === 'uni') return UniPicker.open();
  if (act === 'newCourse') return Library.newCourseForm();
  if (act === 'add') return Library.addForm();
  if (act === 'play') return Library.play(b.dataset.id);
  if (act === 'toQuiz') return Library.toQuiz(b.dataset.id);
  Library.action(act, b.dataset.id, b.dataset.kind);
});

/* =========================================================
   🔗 ربط واجبات Blackboard (اختياري)
   ========================================================= */
const BB = {
  links: [],
  busy: false,
  async load() {
    if (CONFIG.DEMO_MODE) return this.render();
    try { this.links = (await api('bb')).links || []; } catch { }
    this.render();
  },
  render() {
    const n = this.links.length;
    const st = $('#bbState');
    st.textContent = n ? `✅ ${this.links.map(l => l.label).join(' + ')}` : 'غير مربوط';
    st.classList.toggle('on', n > 0);

    const warn = `<div class="warn">⚠️ <b>تنبيه:</b> لما تربط، كل الواجبات والاختبارات اللي في <b>Blackboard</b> أو <b>Classroom</b> بتنضاف هنا تلقائياً كتذكيرات، وعليها علامة <b>🔗</b>. وتتحدّث مرتين في اليوم، وإذا الدكتور غيّر موعد يتغيّر عندك. وتقدر تحذف أي تذكير ما تبيه، وما يرجع.</div>`;

    const linked = this.links.map(l => {
      const r = l.result || {};
      const sk = r.skipped || {};
      const skippedN = (sk.recurring || 0) + (sk.class || 0) + (sk.other || 0);
      return `<div class="bb-link">
        <div class="bb-info">
          <b>🔗 ${esc(l.label)}</b> <span class="muted" dir="ltr">(${esc(l.host)})</span><br>
          🕐 آخر تحديث: ${l.lastSync ? fmtShort(l.lastSync) : '—'}<br>
          📚 لقينا ${r.found ?? 0} واجب واختبار قادم${r.added ? ` · انضاف ${r.added} جديد` : ''}${r.updated ? ` · تحدّث ${r.updated}` : ''}
          ${r.total !== undefined ? `<br><small class="muted">في التقويم ${r.total} موعد: ${sk.past || 0} قديم، ${skippedN} محاضرات أو مواعيد مو واجبات</small>` : ''}
          ${l.error ? `<br><span class="err">⚠️ ${esc(l.error)}</span>` : ''}
        </div>
        <button class="btn ghost sm" data-bb="unlink" data-id="${esc(l.id)}" type="button">❌ إلغاء الربط</button>
      </div>`;
    }).join('');

    const addForm = n >= 3 ? '' : `
      <details class="bb-help" ${n ? '' : 'open'}>
        <summary>${n ? '➕ اربط تقويم ثاني' : '📖 كيف أجيب الرابط؟'}</summary>
        <div class="bb-tabs">
          <b>🟢 Blackboard</b>
          <ol class="steps">
            <li>افتح Blackboard، ثم <b>Calendar</b></li>
            <li>اضغط الترس <b>⚙️</b>، ثم النقاط <b>•••</b>، ثم <b>Share calendar</b></li>
            <li>انسخ الرابط (يبدأ بـ https وآخره .ics)</li>
          </ol>
          <b>🔵 Google Classroom</b>
          <ol class="steps">
            <li>افتح <b>calendar.google.com</b> من المتصفح (مو التطبيق)</li>
            <li>اضغط الترس <b>⚙️</b>، ثم <b>الإعدادات</b>، واختر تقويم الفصل من القائمة</li>
            <li>انزل لـ <b>Integrate calendar</b> وانسخ <b>Secret address in iCal format</b></li>
          </ol>
          <p class="muted small">إذا ما طلع لك العنوان السري، فغالباً جامعتك قافلته.</p>
        </div>
      </details>
      <div class="bb-row">
        <input id="bbUrl" dir="ltr" placeholder="https://.../calendar.ics" autocomplete="off">
        <button class="btn primary" data-bb="link" type="button">اربط 🔗</button>
      </div>
      <p class="muted small">🔒 الرابط خاص فيك. نحفظه بشكل آمن ولا أحد يشوفه غيرك. وتقدر تربط لين 3 تقاويم.</p>`;

    $('#bbBody').innerHTML = `${warn}${linked}
      ${n ? `<div class="bb-row" style="margin-bottom:14px"><button class="btn ghost" data-bb="refresh" type="button">🔄 حدّث الحين</button></div>` : ''}
      ${addForm}`;
  },
  async call(method, body, okMsg) {
    if (this.busy) return;
    if (CONFIG.DEMO_MODE) return toast('الربط يشتغل بس على الموقع المنشور', 'err');
    this.busy = true;
    $$('#bbBody button').forEach(b => b.disabled = true);
    try {
      const r = await api('bb', { method, body });
      this.links = r.links || [];
      await Tasks.load();
      render();
      if (okMsg) toast(okMsg(this.links), 'ok', 5000);
    } catch (e) {
      toast(esc(e.message), 'err', 6000);
    } finally {
      this.busy = false;
      this.render();
    }
  }
};

$('#bbBody').addEventListener('click', e => {
  const b = e.target.closest('[data-bb]');
  if (!b) return;
  const act = b.dataset.bb;
  if (act === 'link') {
    const url = $('#bbUrl').value.trim();
    if (!url) return toast('الصق رابط التقويم أول', 'err');
    BB.call('POST', { url }, links => { const l = links[links.length - 1]; return `🔗 انربط ${l?.label || ''}! لقينا ${l?.result?.found ?? 0} واجب واختبار`; });
  } else if (act === 'refresh') {
    BB.call('POST', { refresh: true }, () => '🔄 تحدّث');
  } else if (act === 'unlink') {
    if (!confirm('تبي تلغي ربط هالتقويم؟')) return;
    const removeTasks = confirm('تبي نحذف بعد التذكيرات اللي جت منه؟\n(موافق = نحذفها، إلغاء = نخليها)');
    BB.call('DELETE', { id: b.dataset.id, removeTasks }, () => 'انلغى الربط');
  }
});

/* =========================================================
   🎙️ تسجيل صوتي يتحول لنص
   ========================================================= */
const Voice = {
  rec: null,
  btn: null,
  start(btn) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      return toast('متصفحك ما يدعم التسجيل هنا. استخدم زر المايك 🎙️ اللي في الكيبورد حقك', 'info', 6000);
    }
    if (this.rec) return this.stop();
    const target = document.getElementById(btn.dataset.target);
    const base = target.value ? target.value.trimEnd() + ' ' : '';
    const rec = new SR();
    rec.lang = 'ar-SA';
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = e => {
      let text = '';
      for (const r of e.results) text += r[0].transcript;
      target.value = base + text;
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed') toast('اسمح للموقع يستخدم المايك من إعدادات المتصفح', 'err', 6000);
      else if (e.error !== 'aborted' && e.error !== 'no-speech') toast('صار خطأ في التسجيل، جرّب مرة ثانية', 'err');
    };
    rec.onend = () => this.reset();
    this.rec = rec;
    this.btn = btn;
    btn.classList.add('on');
    btn.textContent = '⏹️';
    try { rec.start(); toast('🎙️ تكلم الحين... واضغط ⏹️ إذا خلصت', 'info', 3000); } catch { this.reset(); }
  },
  stop() { try { this.rec?.stop(); } catch { } this.reset(); },
  reset() {
    if (this.btn) { this.btn.classList.remove('on'); this.btn.textContent = '🎙️'; }
    this.rec = null;
    this.btn = null;
  }
};
document.addEventListener('click', e => {
  const b = e.target.closest('button.mic[data-target]');
  if (b) { e.preventDefault(); Voice.start(b); }
});

/* =========================================================
   🧭 التبويبات
   ========================================================= */
const VIEWS = ['home', 'study', 'lib', 'me', 'admin'];
const View = {
  fromHash() { const h = location.hash.slice(1); return VIEWS.includes(h) ? h : 'home'; },
  go(v, push = true) {
    if (v === 'admin' && !state.admin) v = 'home';
    const changed = state.view !== v;
    state.view = v;
    VIEWS.forEach(x => { $('#v-' + x).hidden = x !== v; });
    $$('#tabbar button').forEach(b => b.classList.toggle('sel', b.dataset.v === v));
    $('#fab').hidden = v !== 'home';
    if (push && location.hash.slice(1) !== v) history.replaceState(null, '', '#' + v);
    if (changed) window.scrollTo({ top: 0 });
    if (v === 'admin') Admin.load();
    if (v === 'lib' && !Library.loaded && !Library.busy && state.profile?.uni) Library.load();
    if (v === 'me') Profile.render();
  }
};
$('#tabbar').addEventListener('click', e => {
  const b = e.target.closest('button[data-v]');
  if (b) View.go(b.dataset.v);
});
window.addEventListener('hashchange', () => { if (state.email) View.go(View.fromHash(), false); });
$('#adminBadge').addEventListener('click', () => View.go('admin'));

// المذاكرة: صانع الكويز أو خطة المذاكرة
const Study = {
  cur: 'quiz',
  sub(s) {
    this.cur = s;
    $$('#studySeg button').forEach(b => b.classList.toggle('sel', b.dataset.s === s));
    $('#quizMaker').hidden = s !== 'quiz';
    $('#quizRun').hidden = s !== 'quiz' || !quiz.questions.length || quiz.closed;
    $('#planner').hidden = s !== 'plan';
  }
};
$('#studySeg').addEventListener('click', e => {
  const b = e.target.closest('button[data-s]');
  if (b) Study.sub(b.dataset.s);
});

// نافذة إضافة تذكير
const AddSheet = {
  open() {
    $('#addSheet').hidden = false;
    document.body.classList.add('noscroll');
    setTimeout(() => $('#fSubject').focus(), 50);
  },
  close() {
    $('#addSheet').hidden = true;
    document.body.classList.remove('noscroll');
  }
};
$('#fab').addEventListener('click', () => AddSheet.open());
$('#addSheet').addEventListener('click', e => {
  if (e.target.id === 'addSheet' || e.target.closest('[data-x]')) AddSheet.close();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#addSheet').hidden) AddSheet.close(); });

/* =========================================================
   🎓 الجامعة
   ========================================================= */
const UniPicker = {
  open(force = false) {
    const el = document.createElement('div');
    el.className = 'sheet uni-sheet';
    el.innerHTML = `
      <div class="sheet-box glass">
        <b>🎓 من أي جامعة انت؟</b>
        <small class="muted">عشان نعرض لك مكتبة جامعتك (ملخصات، سلايدات، كويزات زملاءك). تقدر تغيّرها بعدين مرة كل 30 يوم.</small>
        <input id="uniSearch" placeholder="🔎 دوّر: الملك عبدالعزيز، الملك سعود...">
        <div class="uni-list" id="uniList"></div>
        ${force ? '' : '<button class="btn ghost full" type="button" data-x>إلغاء</button>'}
      </div>`;
    const list = el.querySelector('#uniList');
    const draw = () => {
      const q = el.querySelector('#uniSearch').value.trim();
      const items = UNIS.filter(([id, n]) => !q || n.includes(q) || id.includes(q.toLowerCase()) || id === 'other');
      list.innerHTML = items.map(([id, n]) => `<button type="button" data-uni="${id}" class="${state.profile?.uni === id ? 'sel' : ''}">${esc(n)}</button>`).join('');
    };
    el.querySelector('#uniSearch').addEventListener('input', draw);
    el.addEventListener('click', async e => {
      if (!force && (e.target === el || e.target.closest('[data-x]'))) return el.remove();
      const b = e.target.closest('[data-uni]');
      if (!b) return;
      if (state.profile?.uni && state.profile.uni !== b.dataset.uni &&
          !confirm(`تغيّر جامعتك لـ "${UNI_NAME[b.dataset.uni]}"؟\nما تقدر تغيّرها مرة ثانية إلا بعد 30 يوم.`)) return;
      b.disabled = true;
      try {
        await Profile.setUni(b.dataset.uni);
        el.remove();
        toast(`🎓 ${esc(UNI_NAME[b.dataset.uni])} — هلا فيك!`, 'ok');
      } catch (err) {
        toast(esc(err.message), 'err', 6000);
        b.disabled = false;
      }
    });
    draw();
    document.body.appendChild(el);
  }
};
$('#uniChange').addEventListener('click', () => {
  if (state.profile?.uniNext) return toast(`تقدر تغيّر جامعتك بعد ${Math.ceil((state.profile.uniNext - Date.now()) / DAY)} يوم`, 'info');
  UniPicker.open();
});

/* =========================================================
   ⚙️ حسابي + 💬 تذكير الواتساب
   ========================================================= */
const LEADS = [[1, 'ساعة'], [3, '3 ساعات'], [6, '6 ساعات'], [12, '12 ساعة'], [24, 'يوم']];
const Profile = {
  busy: false,
  set(p) {
    state.profile = p;
    if (CONFIG.DEMO_MODE && state.email) Store.set('thk_profile_' + state.email, p);
    if (state.email) this.render();
  },
  async setUni(uni) {
    if (CONFIG.DEMO_MODE) this.set({ ...state.profile, uni, uniName: UNI_NAME[uni] });
    else this.set((await api('profile', { method: 'POST', body: { action: 'uni', uni } })).profile);
    Library.reset();
    Library.load();
  },
  async call(body, okMsg) {
    if (this.busy) return;
    this.busy = true;
    $$('#waCard button').forEach(b => b.disabled = true);
    try {
      this.set((await api('profile', { method: 'POST', body })).profile);
      if (okMsg) toast(okMsg, 'ok', 5000);
    } catch (e) {
      toast(esc(e.message), 'err', 7000);
    } finally {
      this.busy = false;
      this.render();
    }
  },
  render() {
    const p = state.profile || {};
    $('#meUni').textContent = p.uni ? `🎓 ${UNI_NAME[p.uni] || ''}` : '🎓 ما اخترت جامعتك';
    $('#uniChange').textContent = p.uni ? '🎓 تغيير الجامعة' : '🎓 اختر جامعتك';
    const dm = p.digest?.mail !== false;
    $('#digestMail').textContent = dm ? '✅ شغّال' : '▶️ شغّله';
    $('#digestMail').classList.toggle('on', dm);
    this.renderWA();
  },
  renderWA() {
    const w = state.profile?.wa || {};
    const box = $('#waCard');
    const head = `<div class="wa-head"><h3>💬 تذكير على الواتساب <small class="muted">(اختياري)</small></h3>
      ${w.verified ? `<span class="bb-state ${w.on ? 'on' : ''}">${w.on ? '✅ شغّال' : '⏸️ موقف'}</span>` : ''}</div>`;
    if (!w.ready && !w.verified) {
      box.innerHTML = head + `<p class="muted">🚧 قريباً: يجيك تذكير على واتسابك قبل كل موعد بالوقت اللي تختاره.</p>`;
      return;
    }
    if (w.verified) {
      box.innerHTML = head + `
        <p class="muted small">يوصلك تذكير على <b dir="ltr">${esc(w.phone)}</b> قبل كل مهمة. (بالكثير 5 رسائل باليوم)</p>
        <div class="set-row">
          <div><b>التذكيرات</b></div>
          <button class="btn ${w.on ? 'ghost' : 'primary'} sm" data-wa="toggle" type="button">${w.on ? '⏸️ أوقفها' : '▶️ شغّلها'}</button>
        </div>
        <div class="set-row">
          <div><b>☀️ ملخص الصباح على الواتساب</b><div class="muted small">رسالة الساعة 7 الصبح فيها مذاكرة يومك ومواعيدك القريبة</div></div>
          <button class="btn ${state.profile?.digest?.wa ? 'ghost' : 'primary'} sm" data-wa="digest" type="button">${state.profile?.digest?.wa ? '✅ شغّال' : '▶️ شغّله'}</button>
        </div>
        <label>ذكّرني على الواتساب قبل الموعد بـ
          <select id="waLead">${LEADS.map(([h, l]) => `<option value="${h}" ${w.lead === h ? 'selected' : ''}>${l}</option>`).join('')}</select>
        </label>
        <button class="btn ghost sm" data-wa="remove" type="button">🗑️ احذف رقمي</button>
        ${!w.ready ? '<p class="warn small">⚠️ الخدمة موقفة مؤقتاً من الموقع، بترجع قريب.</p>' : ''}`;
      return;
    }
    if (w.pending) {
      box.innerHTML = head + `
        <p>أرسلنا رمز تحقق على واتساب <b dir="ltr">${esc(w.pending)}</b> 📲</p>
        <div class="bb-row">
          <input id="waCode" inputmode="numeric" maxlength="6" dir="ltr" placeholder="123456" autocomplete="one-time-code">
          <button class="btn primary" data-wa="verify" type="button">تأكيد ✅</button>
        </div>
        <p class="muted small">ما وصلك؟ <button class="link" data-wa="again" type="button">غيّر الرقم أو أعد الإرسال</button></p>`;
      $('#waCode').addEventListener('input', e => { if (e.target.value.replace(/\D/g, '').length === 6) box.querySelector('[data-wa=verify]').click(); });
      return;
    }
    box.innerHTML = head + `
      <p class="muted small">حط رقم جوالك ويجيك تذكير على الواتساب قبل كل كويز أو واجب أو اختبار، بالوقت اللي تختاره 🔔</p>
      <div class="bb-row">
        <input id="waPhone" inputmode="tel" dir="ltr" placeholder="05xxxxxxxx" autocomplete="tel">
        <button class="btn primary" data-wa="send" type="button">أرسل رمز التحقق</button>
      </div>
      <p class="muted small">🔒 رقمك يستخدم للتذكيرات بس، وما أحد يشوفه. والرقم اللي يرسل لك مخصص للتذكير وما يرد على الرسائل. تقدر توقفها أو تحذف رقمك أي وقت.</p>`;
  }
};
$('#waCard').addEventListener('click', e => {
  const b = e.target.closest('[data-wa]');
  if (!b) return;
  if (CONFIG.DEMO_MODE) return toast('الواتساب يشتغل بس على الموقع المنشور', 'err');
  const w = state.profile?.wa || {};
  const act = b.dataset.wa;
  if (act === 'send') {
    const phone = $('#waPhone').value.trim();
    if (!phone) return toast('اكتب رقم جوالك', 'err');
    Profile.call({ action: 'wa-send', phone }, '📲 أرسلنا لك رمز على الواتساب');
  } else if (act === 'verify') {
    const code = $('#waCode').value.replace(/\D/g, '');
    if (code.length !== 6) return toast('الرمز 6 أرقام', 'err');
    Profile.call({ action: 'wa-verify', code }, '🎉 تم! بيجيك التذكير على الواتساب');
  } else if (act === 'again') {
    state.profile.wa.pending = '';
    Profile.renderWA();
  } else if (act === 'toggle') {
    Profile.call({ action: 'wa-settings', on: !w.on }, w.on ? 'وقفنا تذكيرات الواتساب ⏸️' : 'رجعت التذكيرات ✅');
  } else if (act === 'digest') {
    const on = !state.profile?.digest?.wa;
    Profile.call({ action: 'digest', wa: on }, on ? '☀️ بيجيك ملخص يومك على الواتساب كل صباح' : 'وقفنا ملخص الواتساب');
    } else if (act === 'remove') {
    if (!confirm('تبي تحذف رقمك وتوقف تذكيرات الواتساب؟')) return;
    Profile.call({ action: 'wa-remove' }, 'انحذف الرقم 🗑️');
  }
});
$('#digestMail').addEventListener('click', () => {
  if (CONFIG.DEMO_MODE) return toast('يشتغل بس على الموقع المنشور', 'err');
  const on = state.profile?.digest?.mail === false;
  Profile.call({ action: 'digest', mail: on }, on ? '☀️ بيجيك ملخص يومك على الإيميل كل صباح' : 'وقفنا ملخص الصباح');
});
$('#waCard').addEventListener('change', e => {
  if (e.target.id === 'waLead') Profile.call({ action: 'wa-settings', lead: +e.target.value }, '✅ انحفظ');
});

/* =========================================================
   👑 لوحة الأدمن (إحصائيات)
   ========================================================= */
const OPS = [
  ['active', '👥 دخول (طلاب فعّالين)'], ['signup', '🆕 تسجيل جديد'], ['quiz', '🧠 كويزات انصنعت'],
  ['grade', '✍️ تصحيح مقالي'], ['plan', '🗓️ رسائل لمخطط المذاكرة'], ['course', '📚 مواد جديدة'],
  ['lib', '🔗 روابط وكويزات بالمكتبة'], ['upload', '📄 ملفات وصور انرفعت'], ['digest', '☀️ ملخصات صباح انرسلت'], ['wa', '💬 رسائل واتساب'], ['waOtp', '🔐 رموز تحقق واتساب']
];
const Admin = {
  data: null,
  at: 0,
  sort: 'last',
  q: '',
  async load(force = false) {
    if (CONFIG.DEMO_MODE) { $('#adminContent').innerHTML = '<p class="note">لوحة الإحصائيات تشتغل بس على الموقع المنشور.</p>'; return; }
    if (!force && this.data && Date.now() - this.at < 60000) return this.render();
    if (!this.data) $('#adminContent').innerHTML = '<div class="empty"><span>⏳</span>نجمع الأرقام...</div>';
    try {
      this.data = await api('admin');
      this.at = Date.now();
    } catch (e) {
      $('#adminContent').innerHTML = `<p class="note">ما قدرنا نجيب البيانات: ${esc(e.message)}</p>`;
      return;
    }
    this.render();
  },
  render() {
    const d = this.data;
    if (!d) return;
    const now = Date.now();
    const users = d.users;
    const within = (t, days) => t && now - t < days * DAY;
    const days = d.days;
    const today = days[days.length - 1] || {};
    const sum = (k, n = 30) => days.slice(-n).reduce((s, x) => s + (x[k] || 0), 0);
    const aiCost = x => ((x.tin || 0) * d.prices.aiIn + (x.tout || 0) * d.prices.aiOut) / 1e6;
    const ai30 = days.reduce((s, x) => s + aiCost(x), 0);
    const wa30 = sum('wa') * d.prices.wa;
    const money = v => `$${v.toFixed(2)} <small class="muted">(${(v * 3.75).toFixed(2)} ريال)</small>`;

    // الرسم: الطلاب الفعّالين باليوم
    const max = Math.max(1, ...days.map(x => x.active || 0));
    const chart = days.map((x, i) => {
      const h = Math.round(((x.active || 0) / max) * 100);
      const lbl = i % 5 === 4 || i === days.length - 1 ? x.date.slice(8) + '/' + x.date.slice(5, 7) : '';
      return `<div class="bar-col" title="${x.date}: ${x.active || 0} فعّال، ${x.signup || 0} جديد">
        <i style="height:${h}%"></i>${x.signup ? `<em style="height:${Math.round((x.signup / max) * 100)}%"></em>` : ''}<small>${lbl}</small></div>`;
    }).join('');

    // توزيع الجامعات
    const byUni = {};
    users.forEach(u => { const k = u.uni || '—'; byUni[k] = (byUni[k] || 0) + 1; });
    const uniRows = Object.entries(byUni).sort((a, b) => b[1] - a[1]);

    // جدول المستخدمين
    const score = u => (u.n.quiz || 0) * 3 + (u.n.plan || 0) + (u.n.lib || 0) * 2 + (u.n.upload || 0) * 2 + u.total + u.days * 2;
    const sorters = {
      last: (a, b) => (b.last || 0) - (a.last || 0),
      joined: (a, b) => (b.joined || 0) - (a.joined || 0),
      days: (a, b) => b.days - a.days,
      tasks: (a, b) => b.total - a.total,
      quiz: (a, b) => (b.n.quiz || 0) - (a.n.quiz || 0),
      score: (a, b) => score(b) - score(a)
    };
    const q = this.q.toLowerCase();
    const list = users.filter(u => !q || u.email.includes(q) || (d.unis[u.uni] || '').includes(this.q)).sort(sorters[this.sort]);
    const th = (k, l) => `<th><button class="th ${this.sort === k ? 'sel' : ''}" data-sort="${k}" type="button">${l}${this.sort === k ? ' ▼' : ''}</button></th>`;

    $('#adminContent').innerHTML = `
      <div class="quiz-head">
        <h3>👑 لوحة الأدمن</h3>
        <button class="btn ghost sm" data-adm="refresh" type="button">🔄 تحديث</button>
      </div>
      <p class="muted small">آخر تحديث: ${fmtShort(this.at)} · الأرقام اليومية بدأت تنحسب من يوم التحديث</p>

      <div class="kpis">
        <div class="kpi"><b>${users.length}</b><small>كل المستخدمين</small></div>
        <div class="kpi"><b>${users.filter(u => within(u.joined, 1)).length}</b><small>سجّلوا اليوم</small></div>
        <div class="kpi"><b>${users.filter(u => within(u.joined, 7)).length}</b><small>سجّلوا هالأسبوع</small></div>
        <div class="kpi hot"><b>${users.filter(u => within(u.last, 1)).length}</b><small>فعّالين اليوم</small></div>
        <div class="kpi"><b>${users.filter(u => within(u.last, 7)).length}</b><small>فعّالين 7 أيام</small></div>
        <div class="kpi"><b>${users.filter(u => within(u.last, 30)).length}</b><small>فعّالين 30 يوم</small></div>
      </div>

      <div class="adm-box">
        <h4>📈 الطلاب الفعّالين باليوم (آخر 30 يوم) <small class="muted">· <span class="dot a"></span> فعّال <span class="dot s"></span> جديد</small></h4>
        <div class="bars">${chart}</div>
      </div>

      <div class="adm-grid">
        <div class="adm-box">
          <h4>⚙️ العمليات</h4>
          <table class="mini"><thead><tr><th></th><th>اليوم</th><th>7 أيام</th><th>30 يوم</th></tr></thead><tbody>
            ${OPS.map(([k, l]) => `<tr><td>${l}</td><td>${today[k] || 0}</td><td>${sum(k, 7)}</td><td>${sum(k)}</td></tr>`).join('')}
          </tbody></table>
        </div>
        <div class="adm-box">
          <h4>💰 التكلفة التقديرية (30 يوم)</h4>
          <div class="cost"><span>🤖 الذكاء الاصطناعي (Claude)</span><b>${money(ai30)}</b></div>
          <div class="cost"><span>· اليوم</span><b>${money(aiCost(today))}</b></div>
          <div class="cost"><span>💬 رسائل الواتساب</span><b>${money(wa30)}</b></div>
          <div class="cost"><span>· رسائل هالشهر</span><b>${d.wa.month} / ${d.wa.limit}</b></div>
          <p class="muted small">تقدير بس. الفاتورة الحقيقية في console.anthropic.com و Meta.</p>
          <h4 style="margin-top:14px">🔌 الربط</h4>
          <div class="cost"><span>🔗 ربطوا Blackboard/Classroom</span><b>${users.filter(u => u.bb).length}</b></div>
          <div class="cost"><span>💬 فعّلوا الواتساب</span><b>${users.filter(u => u.wa === 'on').length}</b></div>
        </div>
      </div>

      <div class="adm-grid">
        <div class="adm-box">
          <h4>🎓 الطلاب حسب الجامعة</h4>
          ${uniRows.map(([k, n]) => `<div class="uni-bar"><span>${esc(d.unis[k] || 'ما اختار')}</span><i style="width:${Math.round(n / users.length * 100)}%"></i><b>${n}</b></div>`).join('')}
        </div>
        <div class="adm-box">
          <h4>🛠️ الإعدادات</h4>
          <div class="set-row"><div><b>📄 رفع الملفات في المكتبة</b><div class="muted small">لو الكريدت قرب يخلص، وقفه (الروابط تظل شغالة)</div></div>
            <button class="btn ${d.settings.uploads ? 'ghost' : 'primary'} sm" data-adm="uploads" type="button">${d.settings.uploads ? '⏸️ وقّف' : '▶️ شغّل'}</button></div>
          <div class="set-row"><div><b>💬 تذكيرات الواتساب</b><div class="muted small">${d.wa.configured ? 'مربوطة بـ Meta' : '⚠️ متغيرات WA_TOKEN و WA_PHONE_ID مو موجودة'}</div></div>
            <button class="btn ${d.settings.wa ? 'ghost' : 'primary'} sm" data-adm="wa" type="button">${d.settings.wa ? '⏸️ وقّف' : '▶️ شغّل'}</button></div>
        </div>
      </div>

      <div class="adm-box">
        <h4>🚩 البلاغات في المكتبة (${d.reports.length})</h4>
        ${d.reports.length ? d.reports.map(r => `<div class="rep ${r.hidden ? 'hid' : ''}">
          <div><b>${esc(r.title)}</b><div class="muted small">${esc(r.uniName)} · <span dir="ltr">${esc(r.code)}</span> · ${r.n} بلاغ ${r.hidden ? '· 🚫 انخفى تلقائياً' : ''}</div></div>
          <div class="acts">
            <button class="btn ghost sm" data-rep="open" data-uni="${esc(r.uni)}" data-code="${esc(r.code)}" type="button">👀 افتح</button>
            <button class="btn ghost sm" data-rep="restore" data-uni="${esc(r.uni)}" data-code="${esc(r.code)}" data-id="${esc(r.id)}" data-kind="${esc(r.kind)}" type="button">♻️ سليم</button>
            <button class="btn ghost sm" data-rep="delete" data-uni="${esc(r.uni)}" data-code="${esc(r.code)}" data-id="${esc(r.id)}" data-kind="${esc(r.kind)}" type="button">🗑️ احذف</button>
          </div></div>`).join('') : '<p class="muted small">ما فيه بلاغات 👌</p>'}
      </div>

      <div class="adm-box">
        <h4>👥 المستخدمين (${list.length})</h4>
        <input id="admSearch" placeholder="🔎 دوّر بالإيميل أو الجامعة" value="${esc(this.q)}">
        <div class="table-wrap">
          <table>
            <thead><tr><th>الإيميل</th><th>الجامعة</th>${th('joined', 'سجّل')}${th('last', 'آخر دخول')}${th('days', 'أيام')}${th('tasks', 'مهام')}${th('quiz', 'كويزات')}<th>خطة</th><th>مكتبة</th><th>🔗</th><th>💬</th>${th('score', '🔥 نشاط')}</tr></thead>
            <tbody>${list.map(u => `
              <tr>
                <td dir="ltr">${esc(u.email)} ${u.admin ? '👑' : ''}</td>
                <td>${esc(d.unis[u.uni] || '—')}</td>
                <td>${fmtShort(u.joined)}</td>
                <td>${fmtShort(u.last)}</td>
                <td>${u.days}</td>
                <td>${u.total} <small class="muted">(${u.open} مفتوحة)</small></td>
                <td>${u.n.quiz || 0}</td>
                <td>${u.n.plan || 0}</td>
                <td>${(u.n.lib || 0) + (u.n.upload || 0) + (u.n.course || 0)}</td>
                <td>${u.bb ? '✅' : ''}</td>
                <td>${u.wa === 'on' ? '✅' : u.wa === 'off' ? '⏸️' : ''}</td>
                <td>${score(u)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    const inp = $('#admSearch');
    inp.addEventListener('input', () => { this.q = inp.value; const pos = inp.selectionStart; this.render(); const n = $('#admSearch'); n.focus(); n.setSelectionRange(pos, pos); });
  }
};
$('#adminContent').addEventListener('click', async e => {
  const s = e.target.closest('[data-sort]');
  if (s) { Admin.sort = s.dataset.sort; Admin.render(); return; }
  const a = e.target.closest('[data-adm]');
  if (a) {
    if (a.dataset.adm === 'refresh') return Admin.load(true);
    const k = a.dataset.adm;
    try {
      const r = await api('admin', { method: 'POST', body: { action: 'settings', [k]: !Admin.data.settings[k] } });
      Admin.data.settings = r.settings;
      Admin.render();
      toast('✅ انحفظ', 'ok');
    } catch (err) { toast(esc(err.message), 'err'); }
    return;
  }
  const r = e.target.closest('[data-rep]');
  if (!r) return;
  const { uni, code, id, kind } = r.dataset;
  if (r.dataset.rep === 'open') return Library.openAt(uni, code);
  if (r.dataset.rep === 'delete' && !confirm('تحذفه نهائياً؟')) return;
  try {
    await api('library', { method: 'POST', body: { action: r.dataset.rep, uni, code, id, kind } });
    toast(r.dataset.rep === 'delete' ? 'انحذف 🗑️' : 'رجع ظاهر ♻️', 'ok');
    Admin.load(true);
  } catch (err) { toast(esc(err.message), 'err'); }
});

/* ---------- التشغيل ---------- */
setInterval(() => { if (state.email) renderNextUp(); }, 1000);
setInterval(() => { if (state.email) { render(); checkReminders(); } }, 30000);

// الدخول التلقائي: لو فيه جلسة محفوظة ندخل على طول ونجددها،
// ولو انمسحت من المتصفح (سفاري يمسح بعد 7 أيام) نرجّعها من الكوكي
(async () => {
  const s = Auth.current();
  if (s) {
    await enterApp();
    checkReminders();
    if (!CONFIG.DEMO_MODE && Date.now() - (s.at || 0) > DAY) {
      api('session').then(r => Auth.login(r)).catch(() => { });
    }
    return;
  }
  if (!CONFIG.DEMO_MODE) {
    try {
      const r = await api('session');
      Auth.login(r);
      await enterApp();
      checkReminders();
      return;
    } catch { }
  }
  showScreen('auth');
})();
