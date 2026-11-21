// بيانات حساب الطالب اللي تروح للمتصفح
import { UNI_NAME } from './unis.mjs';
import { waConfigured, maskPhone } from './wa.mjs';

export const UNI_CHANGE_DAYS = 30;

export function profileOf(u, settings) {
  const wa = u.wa || {};
  const next = u.uniAt ? u.uniAt + UNI_CHANGE_DAYS * 864e5 : 0;
  return {
    uni: u.uni || null,
    uniName: u.uni ? UNI_NAME[u.uni] || '' : '',
    uniNext: next > Date.now() ? next : 0, // متى يقدر يغيّر جامعته
    // ملخص الصباح: الإيميل شغّال افتراضياً، الواتساب لازم يفعّله بنفسه
    digest: { mail: u.digest?.mail !== false, wa: !!u.digest?.wa },
    wa: {
      ready: waConfigured() && settings.wa !== false, // الخدمة شغالة في الموقع؟
      phone: wa.phone ? maskPhone(wa.phone) : '',
      verified: !!wa.verified,
      on: !!wa.on,
      lead: wa.lead || 6,
      pending: u.waPending && u.waPending.exp > Date.now() ? maskPhone(u.waPending.phone) : ''
    }
  };
}
