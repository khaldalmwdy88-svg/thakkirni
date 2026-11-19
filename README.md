# ذكّرني — طريقة الرفع على Netlify

## الملفات
```
index.html                ← الصفحات
style.css                 ← التصميم
app.js                    ← منطق الموقع (الواجهة)
assets/                   ← الصور (اللوقو + صورة الواجهة)
netlify/functions/        ← السيرفر
  send-code.mjs           ← يرسل رمز التحقق للإيميل
  verify-code.mjs         ← يتحقق من الرمز ويدخّل المستخدم
  tasks.mjs               ← يحفظ ويجيب تذكيرات الطالب
  admin.mjs               ← بيانات لوحة الأدمن (لك بس)
  remind.mjs              ← كل 15 دقيقة يرسل تذكيرات على الإيميل
netlify/lib/              ← أدوات مشتركة (التوكن + الإيميل)
netlify.toml, package.json
```

## 1) سوّ "كلمة مرور تطبيق" من Gmail
الموقع يرسل الإيميلات من حسابك في Gmail.
1. افتح https://myaccount.google.com/security وفعّل **التحقق بخطوتين** (2-Step Verification).
2. افتح https://myaccount.google.com/apppasswords وسوّ كلمة مرور جديدة باسم `Thakkirni`.
3. انسخ الـ 16 حرف اللي تطلع لك. هذي هي `GMAIL_APP_PASSWORD`.

## 2) ارفع المشروع على GitHub
سوّ مستودع (repo) جديد وارفع فيه كل الملفات. لا ترفع مجلد `node_modules`.
> ⚠️ طريقة السحب والإفلات (Netlify Drop) ما تشغّل السيرفر. لازم تستخدم GitHub.

## 3) اربطه بـ Netlify
1. في Netlify: **Add new site → Import an existing project → GitHub** واختر المستودع.
2. خلّ **Build command** فاضي، و **Publish directory** = `.`
3. اضغط Deploy.

## 4) حط متغيرات البيئة
في **Site configuration → Environment variables** أضف:

| الاسم | القيمة |
|---|---|
| `ADMIN_EMAIL` | `khaldalmwdy88@gmail.com` |
| `GMAIL_USER` | إيميل Gmail اللي بترسل منه |
| `GMAIL_APP_PASSWORD` | الـ 16 حرف من الخطوة 1 |
| `AUTH_SECRET` | أي نص عشوائي طويل (40 حرف أو أكثر) ولا تعطيه أحد |

بعدها روح **Deploys → Trigger deploy** عشان تشتغل القيم الجديدة.

## ملاحظات
- البيانات تنحفظ في **Netlify Blobs** تلقائياً. ما تحتاج تسوي قاعدة بيانات.
- تذكيرات الإيميل تشتغل بس على النسخة المنشورة، مو على جهازك.
- Gmail يسمح تقريباً بـ 500 إيميل في اليوم. هذا يكفي لموقع طلاب.
- لو فتحت `index.html` من جهازك مباشرة، يشتغل في **وضع تجريبي** والرمز يطلع على الشاشة.
