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
const quiz = { files: [], jobs: null, mode: 'same', questions: [], graded: false, busy: false };

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
          results[i] = await askQuiz(chunks[i], mode);
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

    quiz.questions = prepare(all);
    quiz.graded = false;
    setProgress(100, 'جاهز!');
    renderQuiz();
    $('#quizRun').scrollIntoView({ behavior: 'smooth', block: 'start' });
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

function renderQuiz(scoreText = '') {
  const box = $('#quizRun');
  box.hidden = false;
  const g = quiz.graded;

  box.innerHTML = `
    <div class="quiz-head">
      <h3>📝 الكويز (${quiz.questions.length} سؤال)</h3>
      <span class="pill">${quiz.mode === 'vary' ? '🔀 أرقام وصياغة جديدة' : '📋 نفس الأسئلة'}</span>
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
        <button class="btn primary" data-qa="again">🔁 نفس الكويز بترتيب جديد</button>
        <button class="btn ghost" data-qa="vary">🔀 نسخة بأرقام جديدة</button>
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

  if (act === 'close') { $('#quizRun').hidden = true; return; }
  if (act === 'again') {
    quiz.questions = prepare(quiz.questions.map(({ user, score, feedback, ...q }) => q));
    quiz.graded = false;
    renderQuiz();
    $('#quizRun').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  if (act === 'vary') { generateQuiz('vary'); return; }

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
    const total = quiz.questions.reduce((s, q) => s + (q.score || 0), 0);
    const pct = Math.round((total / quiz.questions.length) * 100);
    const msg = pct >= 90 ? 'أسطوري! 🏆' : pct >= 75 ? 'ممتاز 💪' : pct >= 50 ? 'زين، راجع الغلط 📚' : 'لا تيأس، جرّب مرة ثانية 🔁';
    renderQuiz(`<div class="score-box"><b>${pct}%</b>${total} من ${quiz.questions.length} — ${msg}</div>`);
    $('#quizRun').scrollIntoView({ behavior: 'smooth' });
  }
});

/* ---------- التشغيل ---------- */
setInterval(() => { if (state.email) renderNextUp(); }, 1000);
setInterval(() => { if (state.email) { render(); checkReminders(); } }, 30000);

if (Auth.current()) { enterApp().then(checkReminders); }
else showScreen('auth');
