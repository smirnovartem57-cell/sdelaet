import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_HTML_BYTES = 900_000;
const MAX_REDIRECTS = 3;

function clean(v='') {
  return String(v)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(html, tag, key, value, wanted) {
  const re = new RegExp(
    `<${tag}\\b[^>]*${key}=["']${value}["'][^>]*>`,
    'i'
  );
  const m = html.match(re);
  if (!m) return '';
  const a = m[0].match(new RegExp(`${wanted}=["']([^"']+)["']`, 'i'));
  return a ? clean(a[1]) : '';
}

function tagText(html, tag) {
  const m = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? clean(m[1]) : '';
}

function unique(arr) {
  const seen = new Set();
  const out = [];

  for (const value of arr.filter(Boolean)) {
    const key = String(value).trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }

  return out;
}

function normalizePhone(value='') {
  const digits = String(value).replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('8')) {
    return '+7' + digits.slice(1);
  }

  if (digits.length === 11 && digits.startsWith('7')) {
    return '+' + digits;
  }

  if (digits.length === 10) {
    return '+7' + digits;
  }

  return '';
}

function isBlockedIPv4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4) return true;

  return (
    p[0] === 0 ||
    p[0] === 10 ||
    p[0] === 127 ||
    p[0] >= 224 ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127)
  );
}

function isBlockedIP(ip) {
  if (net.isIPv4(ip)) return isBlockedIPv4(ip);

  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    return (
      x === '::1' ||
      x === '::' ||
      x.startsWith('fc') ||
      x.startsWith('fd') ||
      x.startsWith('fe8') ||
      x.startsWith('fe9') ||
      x.startsWith('fea') ||
      x.startsWith('feb')
    );
  }

  return true;
}

async function validatePublicUrl(raw) {
  const u = new URL(raw);

  if (!['http:', 'https:'].includes(u.protocol)) {
    throw new Error('UNSUPPORTED_PROTOCOL');
  }

  if (u.username || u.password) {
    throw new Error('URL_CREDENTIALS_NOT_ALLOWED');
  }

  const addresses = await dns.lookup(u.hostname, {
    all: true,
    verbatim: true
  });

  if (!addresses.length) {
    throw new Error('DNS_NOT_FOUND');
  }

  for (const { address } of addresses) {
    if (isBlockedIP(address)) {
      throw new Error('PRIVATE_OR_RESERVED_IP');
    }
  }

  return u;
}

async function readLimited(response) {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const chunks = [];
  let total = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    total += value.byteLength;

    if (total > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new Error('HTML_TOO_LARGE');
    }

    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let pos = 0;

  for (const chunk of chunks) {
    merged.set(chunk, pos);
    pos += chunk.byteLength;
  }

  return new TextDecoder('utf-8').decode(merged);
}

async function safeFetch(raw, redirectCount=0) {
  const u = await validatePublicUrl(raw);

  const response = await fetch(u, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'user-agent': 'SdelaetBot/0.1 (+https://onsdelaet.ru)',
      'accept': 'text/html,application/xhtml+xml'
    },
    signal: AbortSignal.timeout(8000)
  });

  if ([301,302,303,307,308].includes(response.status)) {
    if (redirectCount >= MAX_REDIRECTS) {
      throw new Error('TOO_MANY_REDIRECTS');
    }

    const location = response.headers.get('location');
    if (!location) throw new Error('REDIRECT_WITHOUT_LOCATION');

    return safeFetch(new URL(location, u).href, redirectCount + 1);
  }

  if (!response.ok) {
    throw new Error(`HTTP_${response.status}`);
  }

  const type = response.headers.get('content-type') || '';

  if (!type.toLowerCase().includes('text/html')) {
    throw new Error('NOT_HTML');
  }

  const html = await readLimited(response);

  return {
    url: response.url || u.href,
    html
  };
}

function extractJsonLd(html) {
  const blocks = [
    ...html.matchAll(
      /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    )
  ];

  const objects = [];

  for (const m of blocks) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const list = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of list) {
        if (item?.['@graph']) {
          objects.push(...item['@graph']);
        } else {
          objects.push(item);
        }
      }
    } catch {}
  }

  return objects;
}

function extractCompanyName(html, text, jsonLd) {
  const allowed = new Set([
    'Organization',
    'LocalBusiness',
    'HomeAndConstructionBusiness',
    'Store',
    'Corporation'
  ]);

  for (const item of jsonLd) {
    const types = Array.isArray(item?.['@type'])
      ? item['@type']
      : [item?.['@type']];

    if (types.some(x => allowed.has(x)) && item?.name) {
      return clean(item.name);
    }
  }

  const siteName =
    attr(html, 'meta', 'property', 'og:site_name', 'content') ||
    attr(html, 'meta', 'name', 'application-name', 'content');

  if (siteName) return siteName;

  const quoted = text.match(
    /(?:ООО|АО|ОАО|компания)\s+[«"“]([^»"”]{2,60})[»"”]/iu
  );

  if (quoted?.[1]) {
    return clean(quoted[1]);
  }

  const mentioned = text.match(
    /(?:Компания|компания)\s+([А-ЯЁA-Z][A-Za-zА-Яа-яЁё0-9&.-]{2,50})/u
  );

  if (mentioned?.[1]) {
    return clean(mentioned[1]);
  }

  return tagText(html, 'title')
    .split(/\s+[|—–-]\s+/)[0]
    .trim();
}

function extractContacts(html, text, jsonLd) {
  const phones = [];
  const emails = [];

  for (const item of jsonLd) {
    if (item?.telephone) phones.push(String(item.telephone));
    if (item?.email) emails.push(String(item.email).replace(/^mailto:/i, ''));
  }

  for (const m of html.matchAll(/href=["']tel:([^"'?#]+)["']/gi)) {
    phones.push(clean(m[1]));
  }

  for (const m of html.matchAll(/href=["']mailto:([^"'?#]+)["']/gi)) {
    emails.push(clean(m[1]));
  }

  for (const m of text.matchAll(
    /(?:\+7|8)[\s(.-]*\d{3}[\s).-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}/g
  )) {
    phones.push(clean(m[0]));
  }

  return {
    phones: unique(
      phones.map(normalizePhone).filter(Boolean)
    ).slice(0, 5),

    emails: unique(
      emails.map(x => String(x).trim().toLowerCase())
    ).slice(0, 5)
  };
}

function extractContactPageUrls(html, baseUrl, maxPages=3) {
  const candidates = [];

  const patterns = [
    /контакт/i,
    /contacts?/i,
    /contact-us/i,
    /о[\s_-]*компани/i,
    /about/i,
    /реквизит/i,
    /requisites?/i
  ];

  for (const match of html.matchAll(
    /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi
  )) {
    const href = clean(match[1]);
    const label = clean(match[2]);

    if (!href) continue;

    let target;

    try {
      target = new URL(href, baseUrl);
    } catch {
      continue;
    }

    let base;

    try {
      base = new URL(baseUrl);
    } catch {
      continue;
    }

    if (
      !['http:', 'https:'].includes(target.protocol) ||
      target.hostname !== base.hostname
    ) {
      continue;
    }

    target.hash = '';

    const haystack =
      `${target.pathname} ${label}`;

    if (
      !patterns.some(pattern =>
        pattern.test(haystack)
      )
    ) {
      continue;
    }

    let score = 0;

    if (/контакт|contacts?|contact-us/i.test(haystack)) {
      score += 100;
    }

    if (/реквизит|requisites?/i.test(haystack)) {
      score += 70;
    }

    if (/о[\s_-]*компани|about/i.test(haystack)) {
      score += 40;
    }

    if (
      target.pathname === '/' ||
      target.href === base.href
    ) {
      continue;
    }

    candidates.push({
      url: target.href,
      score
    });
  }

  return unique(
    candidates
      .sort((a, b) => b.score - a.score)
      .map(item => item.url)
  ).slice(0, maxPages);
}


function extractAboutPageUrls(
  html,
  baseUrl,
  maxPages = 1
) {
  const candidates = [];

  for (const match of html.matchAll(
    /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi
  )) {
    const href =
      clean(match[1]);

    const label =
      clean(match[2]);

    if (!href) {
      continue;
    }

    let target;
    let base;

    try {
      target =
        new URL(
          href,
          baseUrl
        );

      base =
        new URL(baseUrl);
    } catch {
      continue;
    }

    if (
      !['http:', 'https:']
        .includes(target.protocol) ||
      target.hostname !==
        base.hostname
    ) {
      continue;
    }

    target.hash = '';

    if (
      target.pathname === '/' ||
      target.href === base.href
    ) {
      continue;
    }

    const haystack =
      `${target.pathname} ${label}`;

    let score = 0;

    if (
      /о[\s_-]*компани/i.test(
        haystack
      )
    ) {
      score += 100;
    }

    if (
      /о[\s_-]*нас/i.test(
        haystack
      )
    ) {
      score += 90;
    }

    if (
      /about(?:-us)?/i.test(
        haystack
      )
    ) {
      score += 80;
    }

    if (
      /истори/i.test(
        haystack
      )
    ) {
      score += 70;
    }

    if (
      /company/i.test(
        haystack
      )
    ) {
      score += 60;
    }

    if (!score) {
      continue;
    }

    candidates.push({
      url:
        target.href,
      score
    });
  }

  return unique(
    candidates
      .sort(
        (a, b) =>
          b.score - a.score
      )
      .map(
        item => item.url
      )
  ).slice(
    0,
    maxPages
  );
}


function validInn(value) {
  const inn =
    String(value || '')
      .replace(/\D/g, '');

  if (
    inn.length !== 10 &&
    inn.length !== 12
  ) {
    return false;
  }

  const digits =
    [...inn].map(Number);

  function checksum(coefficients) {
    return (
      coefficients.reduce(
        (sum, coefficient, index) =>
          sum +
          coefficient *
          digits[index],
        0
      ) % 11
    ) % 10;
  }

  if (inn.length === 10) {
    return (
      checksum([
        2, 4, 10, 3, 5,
        9, 4, 6, 8
      ]) === digits[9]
    );
  }

  const check11 =
    checksum([
      7, 2, 4, 10, 3,
      5, 9, 4, 6, 8
    ]);

  const check12 =
    checksum([
      3, 7, 2, 4, 10,
      3, 5, 9, 4, 6, 8
    ]);

  return (
    check11 === digits[10] &&
    check12 === digits[11]
  );
}


function validOgrn(value) {
  const ogrn =
    String(value || '')
      .replace(/\D/g, '');

  if (
    ogrn.length !== 13 &&
    ogrn.length !== 15
  ) {
    return false;
  }

  const body =
    BigInt(
      ogrn.slice(0, -1)
    );

  const divisor =
    ogrn.length === 13
      ? 11n
      : 13n;

  const check =
    Number(
      (body % divisor) % 10n
    );

  return (
    check ===
    Number(ogrn.at(-1))
  );
}


function evidenceTextOf(page) {
  const htmlText =
    String(page.html || '')
      /*
       * Preserve textual content from the
       * complete official page, including
       * footer and structured data.
       */
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, ' $1 ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');

  return [
    page.text || '',
    htmlText
  ]
    .join(' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/gi, '"')
    .replace(/&laquo;/gi, '«')
    .replace(/&raquo;/gi, '»')
    .replace(/&amp;/gi, '&')
    .replace(/&#38;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}


function extractLegalIdentity(pages) {
  const candidates = [];

  for (const page of pages) {
    const textValue =
      evidenceTextOf(page);

    /*
     * Require explicit INN / OGRN labels.
     * Arbitrary digit sequences are ignored.
     */
    const innMatches = [
      ...textValue.matchAll(
        /(?:^|[^\p{L}\p{N}])ИНН[^\d]{0,30}(\d{10}|\d{12})(?!\d)/giu
      )
    ];

    const ogrnMatches = [
      ...textValue.matchAll(
        /(?:^|[^\p{L}\p{N}])ОГРН(?:ИП)?[^\d]{0,30}(\d{13}|\d{15})(?!\d)/giu
      )
    ];

    const kppMatches = [
      ...textValue.matchAll(
        /(?:^|[^\p{L}\p{N}])КПП[^\d]{0,30}(\d{9})(?!\d)/giu
      )
    ];

    const inns =
      [
        ...new Set(
          innMatches
            .map(match => match[1])
            .filter(validInn)
        )
      ];

    const ogrns =
      [
        ...new Set(
          ogrnMatches
            .map(match => match[1])
            .filter(validOgrn)
        )
      ];

    const kpps =
      [
        ...new Set(
          kppMatches
            .map(match => match[1])
        )
      ];

    if (
      !inns.length &&
      !ogrns.length
    ) {
      continue;
    }

    let legalForm = null;

    if (
      /\bИП\s+[А-ЯЁA-Z]/u.test(
        textValue
      ) ||
      ogrns.some(
        value =>
          value.length === 15
      )
    ) {
      legalForm = 'ИП';

    } else if (
      /\bООО\b/u.test(textValue)
    ) {
      legalForm = 'ООО';

    } else if (
      /\bАО\b/u.test(textValue)
    ) {
      legalForm = 'АО';
    }

    let legalName = null;

    const namePatterns = [
      /\bООО\s+[«"“]([^»"”]{2,100})[»"”]/u,

      /\bАО\s+[«"“]([^»"”]{2,100})[»"”]/u,

      /(?:^|[^\p{L}\p{N}])ИП\s+([А-ЯЁ][А-ЯЁа-яё-]+(?:\s+[А-ЯЁ][А-ЯЁа-яё-]+(?:\s+[А-ЯЁ][А-ЯЁа-яё-]+)?|\s+[А-ЯЁ]\.\s*[А-ЯЁ]\.))/u
    ];

    for (const pattern of namePatterns) {
      const match =
        textValue.match(pattern);

      if (!match?.[1]) {
        continue;
      }

      legalName =
        match[1]
          .replace(
            /\s+(?:ИНН|ОГРН|ОГРНИП|КПП).*$/iu,
            ''
          )
          .trim()
          .slice(0, 120);

      break;
    }

    candidates.push({
      legalForm,

      legalName,

      inn:
        inns[0] || null,

      ogrn:
        ogrns[0] || null,

      kpp:
        kpps[0] || null,

      sourceUrl:
        page.url,

      evidenceType:
        'official_site',

      confidence:
        inns.length &&
        ogrns.length
          ? 'high'
          : 'medium'
    });
  }

  if (!candidates.length) {
    return null;
  }

  const score = item =>
    (item.inn ? 3 : 0) +
    (item.ogrn ? 3 : 0) +
    (item.legalName ? 2 : 0) +
    (item.kpp ? 1 : 0);

  candidates.sort(
    (a, b) =>
      score(b) -
      score(a)
  );

  return candidates[0];
}


function extractClaimedExperience(
  pages
) {
  const currentYear =
    new Date()
      .getUTCFullYear();

  const candidates = [];

  const falseContext =
    /(?:гарант|срок\s+служб|эксплуатац|возраст\s+дома|дому\s+\d+|дом\s+(?:построен|сдан)|проекту|клиент|скидк|рассроч|кредит|сотрудник|мастер|специалист|руководител|менеджер|директор|инженер|монтажник|замерщик|опыт\s+в\s+отрасли|опыт\s+работы\s+сотрудник|отзывов\s+о\s+мастере|выполнения\s+плана|продаж)/i;

  function addCandidate(
    page,
    statement,
    data
  ) {
    if (
      !statement ||
      falseContext.test(
        statement
      )
    ) {
      return;
    }

    candidates.push({
      ...data,

      statement:
        statement.trim(),

      sourceUrl:
        page.url,

      evidenceType:
        'official_site_claim',

      confidence:
        'explicit'
    });
  }

  for (const page of pages) {
    const pageEvidence =
      evidenceTextOf(page);

    /*
     * Explicit company-level claims may live
     * in JSON-LD or flattened page markup,
     * where sentence segmentation is unreliable.
     */
    const directPatterns = [
      /компания\s+[\p{L}\p{N}«»"'“”._-]{2,60}\s*[—–-]?\s*(\d{1,2})\s+лет\s+(?:выполняем|выполняет|работаем|работает|занимаемся|занимается)/iu,

      /за\s+(\d{1,2})\s+лет\s+работы\s+(?:мы|компания)/iu,

      /(?:работаем|работает|на\s+рынке)\s+(?:более|свыше|около|уже)?\s*(\d{1,2})\s+лет/iu
    ];

    for (const pattern of directPatterns) {
      const directMatch =
        pageEvidence.match(pattern);

      if (!directMatch) {
        continue;
      }

      const claimedYears =
        Number(directMatch[1]);

      if (
        claimedYears < 2 ||
        claimedYears > 60
      ) {
        continue;
      }

      const index =
        directMatch.index || 0;

      const statement =
        pageEvidence
          .slice(
            index,
            Math.min(
              pageEvidence.length,
              index +
              directMatch[0].length +
              100
            )
          )
          .split(/[.!?]/)[0]
          .trim();

      addCandidate(
        page,
        statement,
        {
          claimedYears,

          sinceYear:
            currentYear -
            claimedYears,

          pattern:
            'years_claim_direct'
        }
      );

      break;
    }

    const sentences =
      evidenceTextOf(page)
        .split(
          /(?<=[.!?])\s+/
        )
        .map(
          value =>
            value
              .replace(/\s+/g, ' ')
              .trim()
        )
        .filter(
          value =>
            value.length >= 8 &&
            value.length <= 260
        );

    for (const sentence of sentences) {
      /*
       * "Работаем с 2012 года"
       * "На рынке с 2008 года"
       * "Компания основана в 2010 году"
       */
      let match =
        sentence.match(
          /(?:работаем|работает|на\s+рынке|основан(?:а|о)?|существу(?:ем|ет)|начал(?:а|и)?\s+работ(?:у|ать))[^.!?]{0,45}?(?:с|в)?\s*((?:19|20)\d{2})\s*(?:года|году|год)?/i
        );

      if (match) {
        const sinceYear =
          Number(match[1]);

        if (
          sinceYear >= 1980 &&
          sinceYear <= currentYear
        ) {
          addCandidate(
            page,
            sentence,
            {
              sinceYear,

              claimedYears:
                currentYear -
                sinceYear,

              pattern:
                'since_year'
            }
          );

          continue;
        }
      }

      /*
       * "Более 15 лет на рынке"
       * "15 лет опыта"
       * "Работаем более 10 лет"
       */
      match =
        sentence.match(
          /(?:(?:компания|мы)\s+)?(?:работаем|работает|на\s+рынке|занимаемся|оказываем\s+услуги)[^.!?]{0,45}?(?:более|свыше|около|уже)?\s*(\d{1,2})\s+лет|(?:более|свыше|около|уже)\s+(\d{1,2})\s+лет\s+(?:на\s+рынке|работы\s+компании|успешной\s+работы\s+компании)|(?:компания\s+[\p{L}\p{N}«»"'“”._-]{2,60}\s*[—–-]?\s*)(\d{1,2})\s+лет\s+(?:выполняем|выполняет|работаем|работает|занимаемся|занимается)/iu
        );

      if (match) {
        const claimedYears =
          Number(
            match[1] ||
            match[2] ||
            match[3]
          );

        if (
          claimedYears >= 2 &&
          claimedYears <= 60
        ) {
          addCandidate(
            page,
            sentence,
            {
              claimedYears,

              sinceYear:
                currentYear -
                claimedYears,

              pattern:
                'years_claim'
            }
          );
        }
      }
    }
  }

  if (!candidates.length) {
    return null;
  }

  /*
   * Prefer an explicit "since YYYY"
   * statement over a generic number
   * of years.
   */
  candidates.sort(
    (a, b) => {
      const aPriority =
        a.pattern ===
        'since_year'
          ? 2
          : 1;

      const bPriority =
        b.pattern ===
        'since_year'
          ? 2
          : 1;

      return (
        bPriority -
          aPriority ||
        b.claimedYears -
          a.claimedYears
      );
    }
  );

  return candidates[0];
}


function findRelevantFacts(text) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(x => x.replace(/\s+/g, ' ').trim())
    .filter(x => x.length >= 20 && x.length <= 230);

  const commonNoise =
    /(?:политика конфиденциальности|согласен на обработку|оставить заявку|заказать звонок|вакансии|франшиз|бизнес.?план|пройти опрос|подарок|перезвоним|-->|фото работ|галерея)/i;

  const reviewNoise =
    /(?:отзыв|спасибо|благодар|прошу.{0,40}отметить|хочу.{0,40}отметить|работу нашего)/i;

  const promoNoise =
    /(?:скидк|акци|подарок|промокод|спецпредлож)/i;

  function collect(test) {
    const out = [];
    const seen = new Set();

    for (const sentence of sentences) {
      if (commonNoise.test(sentence)) continue;
      if (!test(sentence)) continue;

      const key = sentence
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();

      if (!key || seen.has(key)) continue;

      seen.add(key);
      out.push(sentence);

      if (out.length >= 3) break;
    }

    return out;
  }

  return {
    warranty: collect(
      x =>
        /гарант/i.test(x) &&
        !reviewNoise.test(x)
    ),

    price: collect(
      x => {
        if (promoNoise.test(x)) return false;
        if (reviewNoise.test(x)) return false;

        const money =
          /\d[\d\s.,]*\s*(?:₽|руб\.?|рублей|р\.)/i.test(x);

        const priceContext =
          /(?:цена|стоимост|прайс|утепл|отделк|монтаж|работ|балкон|лоджи)/i.test(x);

        return money && priceContext;
      }
    ),

    timing: collect(
      x => {
        if (reviewNoise.test(x)) return false;

        if (
          /срок.{0,30}(?:служб|эксплуатац)/i.test(x) ||
          /служб.{0,30}\d+\s*лет/i.test(x) ||
          /\d+\s*лет.{0,20}(?:служб|рынке|работаем)/i.test(x)
        ) {
          return false;
        }

        return (
          /срок.{0,50}(?:работ|монтаж|выполн|изготов)/i.test(x) ||
          /(?:за|в течение)\s+\d+\s*(?:дн|дня|дней|час|часа|часов|недел)/i.test(x)
        );
      }
    ),

    measurement: collect(
      x =>
        !reviewNoise.test(x) &&
        (
          /бесплатн\w*.{0,30}замер/i.test(x) ||
          /вызов.{0,30}замерщик/i.test(x) ||
          /выезд.{0,30}замер/i.test(x) ||
          /замер.{0,50}(?:расчет|расчёт|стоимост)/i.test(x)
        )
    )
  };
}

export async function crawlCompanySite(url) {
  const fetchedAt = new Date().toISOString();

  const first = await safeFetch(url);

  const finalUrl = first.url;
  const html = first.html;
  const text = clean(html);
  const jsonLd = extractJsonLd(html);

  const pages = [];

  function addPage(pageUrl, pageHtml) {
    if (
      !pageUrl ||
      !pageHtml ||
      pages.some(page => page.url === pageUrl)
    ) {
      return;
    }

    const pageText =
      clean(pageHtml);

    const pageJsonLd =
      extractJsonLd(pageHtml);

    pages.push({
      url: pageUrl,
      html: pageHtml,
      text: pageText,
      jsonLd: pageJsonLd,
      contacts:
        extractContacts(
          pageHtml,
          pageText,
          pageJsonLd
        )
    });
  }

  addPage(
    finalUrl,
    html
  );

  let home = null;

  try {
    const homeUrl =
      new URL('/', finalUrl).href;

    if (homeUrl !== finalUrl) {
      home =
        await safeFetch(homeUrl);

      addPage(
        home.url,
        home.html
      );
    }
  } catch {}

  const discoveryHtml =
    home?.html || html;

  const discoveryBaseUrl =
    home?.url || finalUrl;

  const aboutUrls =
    extractAboutPageUrls(
      discoveryHtml,
      discoveryBaseUrl,
      1
    );

  for (const aboutUrl of aboutUrls) {
    if (
      pages.some(
        page =>
          page.url === aboutUrl
      )
    ) {
      continue;
    }

    try {
      const aboutPage =
        await safeFetch(
          aboutUrl
        );

      addPage(
        aboutPage.url,
        aboutPage.html
      );
    } catch {}
  }

  const contactUrls =
    extractContactPageUrls(
      discoveryHtml,
      discoveryBaseUrl,
      3
    );

  for (const contactUrl of contactUrls) {
    if (
      pages.some(
        page =>
          page.url === contactUrl
      )
    ) {
      continue;
    }

    try {
      const contactPage =
        await safeFetch(contactUrl);

      addPage(
        contactPage.url,
        contactPage.html
      );
    } catch {}
  }

  const phoneRecords = [];
  const emailRecords = [];

  for (const page of pages) {
    for (
      const phone
      of page.contacts.phones
    ) {
      phoneRecords.push({
        value: phone,
        url: page.url
      });
    }

    for (
      const email
      of page.contacts.emails
    ) {
      emailRecords.push({
        value: email,
        url: page.url
      });
    }
  }

  const phones =
    unique(
      phoneRecords.map(
        item => item.value
      )
    );

  const emails =
    unique(
      emailRecords.map(
        item => item.value
      )
    );

  const emailSources = [];

  for (const email of emails) {
    const record =
      emailRecords.find(
        item =>
          item.value === email
      );

    if (!record) continue;

    emailSources.push({
      email,
      url: record.url
    });
  }

  const phoneSources = [];

  for (const phone of phones) {
    const record =
      phoneRecords.find(
        item =>
          item.value === phone
      );

    if (!record) continue;

    phoneSources.push({
      phone,
      url: record.url
    });
  }

  const homePage =
    pages.find(page => {
      try {
        return (
          new URL(page.url).pathname === '/'
        );
      } catch {
        return false;
      }
    });

  const identityPage =
    homePage || pages[0];

  const canonical =
    attr(
      html,
      'link',
      'rel',
      'canonical',
      'href'
    ) || finalUrl;

  const name =
    (
      identityPage
        ? extractCompanyName(
            identityPage.html,
            identityPage.text,
            identityPage.jsonLd
          )
        : ''
    ) ||
    extractCompanyName(
      html,
      text,
      jsonLd
    );

  const description =
    attr(
      html,
      'meta',
      'name',
      'description',
      'content'
    ) ||
    attr(
      html,
      'meta',
      'property',
      'og:description',
      'content'
    );

  const combinedText =
    pages
      .map(page => page.text)
      .join(' ');

  const experience =
    extractClaimedExperience(
      pages
    );

  const legalIdentity =
    extractLegalIdentity(
      pages
    );

  return {
    ok: true,
    sourceUrl: finalUrl,
    canonicalUrl: canonical,
    fetchedAt,
    name,
    description,

    phones,
    emails,

    phoneSources,
    emailSources,

    inspectedUrls:
      pages.map(page => page.url),

    experience,

    legalIdentity,

    facts:
      findRelevantFacts(
        combinedText
      )
  };
}
