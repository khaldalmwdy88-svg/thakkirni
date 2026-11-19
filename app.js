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
  $('#toasts').appendChild(t);
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
  if (res.status === 401 && path !== 'verify-code') {
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
const state = { email: null, admin: false, type: 'quiz', filter: 'all' };

const Tasks = {
  list: [],
  syncTimer: null,
  key(email = state.email) { return 'thk_tasks_' + email; },
  async load() {
    const cached = Store.get(this.key(), []);
    if (CONFIG.DEMO_MODE) { this.list = cached; return; }
    try {
      this.list = (await api('tasks')).tasks;
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
  await Tasks.load();

  $('#userEmail').textContent = s.email;
  $('#adminBadge').hidden = !admin;
  $('#adminPanel').hidden = !admin;

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
}

$('#logoutBtn').addEventListener('click', () => {
  Auth.logout();
  state.email = null;
  state.admin = false;
  Tasks.list = [];
  adminFetchedAt = 0;
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
    done: false,
    created: Date.now()
  });
  $('#fSubject').value = '';
  $('#fTitle').value = '';
  toast(`${TYPES[state.type].icon} تمت إضافة ${TYPES[state.type].label} <b>${esc(subject)}</b>`, 'ok');
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
        <span class="pill">🗓️ ${fmtDate(t.due)}</span>
        ${t.done ? '<span class="pill ok">✔ منجز</span>' : `<span class="pill ${cls}">${countdownText(left)}</span>`}
      </div>
    </div>
    <div class="acts">
      <button data-act="done" data-id="${t.id}" title="${t.done ? 'إرجاع' : 'تم'}">${t.done ? '↩️' : '✔️'}</button>
      <button data-act="del" data-id="${t.id}" title="حذف">🗑️</button>
    </div>
  </div>`;
}

function render() {
  if (!state.email) return;
  renderTypePicker();
  renderFilters();

  const all = Tasks.all();
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
    $('#list').innerHTML = `<div class="empty"><span>${state.filter === 'done' ? '🏆' : '🌙'}</span>${state.filter === 'done' ? 'ما خلّصت شي للحين' : 'ما عندك شي هنا — ضيف أول تذكير من النموذج'}</div>`;
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
  if (state.admin) renderAdmin();
}

$('#list').addEventListener('click', e => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const id = b.dataset.id;
  if (b.dataset.act === 'done') {
    const t = Tasks.all().find(x => x.id === id);
    Tasks.update(id, { done: !t.done });
    if (!t.done) toast('كفو! 💪 خلّصتها', 'ok');
  } else if (b.dataset.act === 'del') {
    if (!confirm('متأكد تبي تحذفه؟')) return;
    Tasks.remove(id);
    toast('انحذف 🗑️', 'info');
  }
  render();
});

/* ---------- أقرب موعد (عدّاد) ---------- */
function renderNextUp() {
  const now = Date.now();
  const next = Tasks.all().filter(t => !t.done && t.due > now).sort((a, b) => a.due - b.due)[0];
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

/* ---------- لوحة الأدمن ---------- */
let adminFetchedAt = 0;
async function renderAdmin(force = false) {
  if (!force && Date.now() - adminFetchedAt < 60000) return; // نحدّثها كل دقيقة بس
  adminFetchedAt = Date.now();
  let rows;
  try {
    if (CONFIG.DEMO_MODE) {
      const users = Store.get('thk_users', {});
      rows = Object.entries(users).map(([email, u]) => {
        const tasks = Store.get('thk_tasks_' + email, []);
        return { email, ...u, total: tasks.length, open: tasks.filter(t => !t.done).length, admin: email === CONFIG.ADMIN_EMAIL };
      }).sort((a, b) => b.last - a.last);
    } else {
      rows = (await api('admin')).users;
    }
  } catch (e) {
    $('#adminContent').innerHTML = `<p class="note">ما قدرنا نجيب بيانات المستخدمين: ${esc(e.message)}</p>`;
    return;
  }
  const totalTasks = rows.reduce((s, r) => s + r.total, 0);

  $('#adminContent').innerHTML = `
    <div class="a-stats">
      <div><b>${rows.length}</b>مستخدم</div>
      <div><b>${totalTasks}</b>تذكير</div>
      <button class="btn ghost sm" id="adminRefresh">🔄 تحديث</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>الإيميل</th><th>أول دخول</th><th>آخر دخول</th><th>التذكيرات</th><th>المفتوحة</th></tr></thead>
        <tbody>${rows.map(r => `
          <tr>
            <td dir="ltr">${esc(r.email)} ${r.admin ? '👑' : ''}</td>
            <td>${fmtShort(r.joined)}</td>
            <td>${fmtShort(r.last)}</td>
            <td>${r.total}</td>
            <td>${r.open}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${CONFIG.DEMO_MODE ? '<p class="note">ℹ️ وضع تجريبي: تظهر الحسابات اللي دخلت من نفس المتصفح بس.</p>' : ''}`;
}
$('#adminContent').addEventListener('click', e => {
  if (e.target.id === 'adminRefresh') renderAdmin(true);
});

/* =========================================================
   التذكيرات والإشعارات
   ========================================================= */
function updateNotifBtn() {
  const b = $('#notifBtn');
  const on = 'Notification' in window && Notification.permission === 'granted';
  b.classList.toggle('on', on);
  b.title = on ? 'الإشعارات مفعّلة' : 'تفعيل الإشعارات';
}
$('#notifBtn').addEventListener('click', async () => {
  if (!('Notification' in window)) return toast('متصفحك ما يدعم الإشعارات', 'err');
  const p = await Notification.requestPermission();
  updateNotifBtn();
  toast(p === 'granted' ? 'تم تفعيل الإشعارات 🔔' : 'ما تم التفعيل — بنذكرك داخل الموقع بس', p === 'granted' ? 'ok' : 'info');
});

function notify(title, body) {
  toast(`🔔 <b>${esc(title)}</b><br>${esc(body)}`, 'info', 10000);
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: 'assets/logo.svg' }); } catch { }
  }
}

function checkReminders() {
  if (!state.email) return;
  const now = Date.now();
  let changed = false;
  const list = Tasks.all().map(t => {
    if (t.done) return t;
    const ty = TYPES[t.type] || TYPES.task;
    if (!t.n1 && now >= t.due - t.remind * 60000 && now < t.due) {
      notify(`${ty.icon} تذكير: ${ty.label} ${t.subject}`, `${countdownText(t.due - now)} — ${fmtDate(t.due)}`);
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

/* ---------- التشغيل ---------- */
setInterval(() => { if (state.email) renderNextUp(); }, 1000);
setInterval(() => { if (state.email) { render(); checkReminders(); } }, 30000);

if (Auth.current()) { enterApp().then(checkReminders); }
else showScreen('auth');
