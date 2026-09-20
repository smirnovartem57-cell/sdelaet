import http from 'node:http';
import {
  processContractorReply,
  listTaskOffers,
  getOfferDialogueHistory
} from './offer-pipeline.mjs';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { handleOutreach } from './outreach.mjs';
import { compareNormalizedOffers } from './offer-comparison-engine.mjs';
import { crawlCompanySite } from './site-crawler.mjs';
import { createCustomerAuth } from './customer-auth.mjs';
import { createCustomerAccount } from './customer-account.mjs';
import { extractYandexServicesProfile } from './yandex-services-profile.mjs';
import { fetchFnsProfile } from './fns-profile.mjs';
import { buildLegalIdentityDiscoveryQueries, selectLegalIdentityDiscovery } from './legal-identity-discovery.mjs';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3210);
const DB_PATH = process.env.DB_PATH || '/var/lib/sdelaet/db/sdelaet.sqlite';


const TELEGRAM_BOT_USERNAME =
  String(
    process.env.TELEGRAM_BOT_USERNAME ||
    ''
  )
    .trim()
    .replace(/^@/, '');

const TELEGRAM_BOT_TOKEN =
  String(
    process.env.TELEGRAM_BOT_TOKEN ||
    ''
  ).trim();


const TELEGRAM_WEBHOOK_SECRET =
  String(
    process.env.TELEGRAM_WEBHOOK_SECRET ||
    ''
  ).trim();


const TELEGRAM_GATEWAY_URL =
  String(
    process.env.TELEGRAM_GATEWAY_URL ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');

const TELEGRAM_GATEWAY_SECRET =
  String(
    process.env.TELEGRAM_GATEWAY_SECRET ||
    ''
  ).trim();

const ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ORIGINS || 'https://onsdelaet.ru,https://www.onsdelaet.ru')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean)
);

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA foreign_keys=ON;
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS taxonomy_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_service TEXT NOT NULL,
    normalized_key TEXT NOT NULL,
    category_status TEXT NOT NULL,
    suggested_category TEXT,
    domain TEXT,
    region TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_taxonomy_signals_status_created
    ON taxonomy_signals(category_status, created_at);
  CREATE INDEX IF NOT EXISTS idx_taxonomy_signals_key
    ON taxonomy_signals(normalized_key);
`);

const customerAuth = createCustomerAuth({ db, allowedOrigins: ALLOWED_ORIGINS });

function sendJson(res, status, data, origin='') {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Vary'] = 'Origin';
  }

  res.writeHead(status, headers);
  res.end(JSON.stringify(data));
}

const customerAccount = createCustomerAccount({
  db,
  customerAuth,
  sendJson
});

function text(v) {
  return String(v ?? '').trim();
}

function lower(v) {
  return text(v).toLowerCase().replace(/ё/g, 'е');
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function isPlatformUrl(value) {
  const host =
    hostOf(value);

  if (!host) {
    return false;
  }

  const platformHosts = [
    '2gis.ru',
    'yandex.ru',
    'yandex.com',
    'uslugi.yandex.ru',
    'avito.ru',
    'zoon.ru',
    'orgs.biz',
    'vk.com',
    'vk.ru'
  ];

  return platformHosts.some(
    platform =>
      host === platform ||
      host.endsWith(
        `.${platform}`
      )
  );
}

function isOfficialWebsiteCandidate(value) {
  if (!value) {
    return false;
  }

  let url;

  try {
    url =
      new URL(value);
  } catch {
    return false;
  }

  if (
    !['http:', 'https:']
      .includes(url.protocol)
  ) {
    return false;
  }

  if (
    isPlatformUrl(
      url.href
    )
  ) {
    return false;
  }

  return true;
}


function normalizeName(v) {
  return lower(v)
    .replace(/[«»"'“”]/g, '')
    .replace(/\b(ооо|ип|оао|ао)\b/g, '')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function candidateKey(c) {
  if (c.type === 'private') {
    return `private:${c.sources?.[0]?.url || c.id}`;
  }

  if (c.type === 'unverified') {
    return `unverified:${c.sources?.[0]?.url || c.id}`;
  }

  return `company:${hostOf(c.website) || normalizeName(c.name)}`;
}

function hash(v) {
  return crypto
    .createHash('sha256')
    .update(String(v))
    .digest('hex')
    .slice(0, 20);
}

function cleanXml(v='') {
  return String(v)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<hlword>|<\/hlword>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function xmlTag(block, tag) {
  const m = block.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  );
  return m ? cleanXml(m[1]) : '';
}

function matchLevel(score) {
  if (score >= 80) return 'Очень высокое';
  if (score >= 65) return 'Высокое';
  if (score >= 50) return 'Среднее';
  return 'Низкое';
}


function serviceMatchLevel(
  categoryRelevance,
  taskScore
) {
  if (
    categoryRelevance?.reject
  ) {
    return 'Не соответствует';
  }

  const relevanceScore =
    Number(
      categoryRelevance?.score || 0
    );

  /*
   * Service match is independent from
   * reputation / verification / geography.
   *
   * Candidates that passed category rejection
   * are already considered relevant enough
   * for the service.
   */

  if (
    relevanceScore >= 80 ||
    taskScore >= 24
  ) {
    return 'Очень высокое';
  }

  if (
    relevanceScore >= 60 ||
    taskScore >= 18
  ) {
    return 'Высокое';
  }

  return 'Подтверждено';
}

function categoryQuery(body) {
  if (body.categoryId === 'balcony-insulation') {
    return 'утепление балконов';
  }

  if (body.categoryId === 'universal-home-repair') {
    return text(
      body.description ||
      body.scope ||
      body.category ||
      'дом и ремонт'
    ).slice(0, 120);
  }

  return text(
    body.category ||
    body.description ||
    body.scope ||
    'услуги'
  ).slice(0, 120);
}

function evaluateCategoryRelevance(
  c,
  categoryId
) {
  if (categoryId !== 'balcony-insulation') {
    return {
      categoryId,
      level: 'generic',
      score: 0,
      primaryReason: '',
      matchedSignals: [],
      negativeSignals: [],
      reject: false
    };
  }

  const facts =
    c.facts || [];

  const hay = lower([
    c.name,
    c.description,
    c.address,
    ...(c.rubrics || []),
    ...facts.map(fact => fact.label || '')
  ].join(' '));

  const definitions = [
    {
      key: 'balcony_insulation',
      label: 'Утепление балконов и лоджий',
      strength: 'strong',
      patterns: [
        /утепл\w*.{0,30}(балкон|лоджи)/i,
        /(балкон|лоджи).{0,30}утепл\w*/i
      ]
    },
    {
      key: 'balcony_finishing',
      label: 'Отделка балконов и лоджий',
      strength: 'strong',
      patterns: [
        /отделк\w*.{0,30}(балкон|лоджи)/i,
        /(балкон|лоджи).{0,30}отделк\w*/i
      ]
    },
    {
      key: 'balcony_turnkey',
      label: 'Балконы и лоджии под ключ',
      strength: 'strong',
      patterns: [
        /(балкон|лоджи).{0,35}под ключ/i,
        /под ключ.{0,35}(балкон|лоджи)/i
      ]
    },
    {
      key: 'balcony_repair',
      label: 'Ремонт балконов и лоджий',
      strength: 'strong',
      patterns: [
        /ремонт\w*.{0,30}(балкон|лоджи)/i,
        /(балкон|лоджи).{0,30}ремонт\w*/i
      ]
    },
    {
      key: 'balcony_glazing',
      label: 'Остекление балконов и лоджий',
      strength: 'medium',
      patterns: [
        /остекл\w*.{0,30}(балкон|лоджи)/i,
        /(балкон|лоджи).{0,30}остекл\w*/i
      ]
    },
    {
      key: 'warm_glazing',
      label: 'Тёплое остекление',
      strength: 'medium',
      patterns: [
        /т[её]пл\w*.{0,20}остекл\w*/i,
        /остекл\w*.{0,20}т[её]пл\w*/i
      ]
    },
    {
      key: 'measurement',
      label: 'Выезд на замер',
      strength: 'supporting',
      patterns: [
        /замер/i,
        /замерщик/i
      ]
    },
    {
      key: 'warranty',
      label: 'Гарантия',
      strength: 'supporting',
      patterns: [
        /гарант/i
      ]
    },
    {
      key: 'installation',
      label: 'Монтажные работы',
      strength: 'supporting',
      patterns: [
        /монтаж/i
      ]
    },
    {
      key: 'materials',
      label: 'Работа с материалами',
      strength: 'supporting',
      patterns: [
        /материал/i
      ]
    },
    {
      key: 'own_production',
      label: 'Собственное производство',
      strength: 'supporting',
      patterns: [
        /собственн\w*.{0,20}производ/i,
        /сво[её].{0,20}производ/i
      ]
    }
  ];

  const matchedSignals = [];

  for (const definition of definitions) {
    const matched =
      definition.patterns.some(
        pattern => pattern.test(hay)
      );

    if (!matched) continue;

    const sourceFact =
      facts.find(fact => {
        const factText =
          lower(fact.label || '');

        return definition.patterns.some(
          pattern => pattern.test(factText)
        );
      });

    matchedSignals.push({
      key: definition.key,
      label: definition.label,
      strength: definition.strength,
      sourceId:
        sourceFact?.sourceId ||
        c.sources?.[0]?.id ||
        ''
    });
  }

  const negativeDefinitions = [
    {
      key: 'information_only',
      label: 'Похоже на информационный материал',
      patterns: [
        /как утеплить/i,
        /своими руками/i,
        /информационн\w*.{0,15}(статья|портал)/i
      ]
    },
    {
      key: 'materials_only',
      label: 'Похоже на продажу материалов без выполнения работ',
      patterns: [
        /магазин.{0,25}строительн\w*.{0,15}материал/i,
        /продаж\w*.{0,25}утеплител/i
      ]
    }
  ];

  const negativeSignals = [];

  for (const definition of negativeDefinitions) {
    if (
      definition.patterns.some(
        pattern => pattern.test(hay)
      )
    ) {
      negativeSignals.push({
        key: definition.key,
        label: definition.label
      });
    }
  }

  const strongCount =
    matchedSignals.filter(
      x => x.strength === 'strong'
    ).length;

  const mediumCount =
    matchedSignals.filter(
      x => x.strength === 'medium'
    ).length;

  const supportingCount =
    matchedSignals.filter(
      x => x.strength === 'supporting'
    ).length;

  let relevanceScore =
    strongCount * 22 +
    mediumCount * 11 +
    Math.min(
      supportingCount * 4,
      16
    );

  relevanceScore =
    Math.min(100, relevanceScore);

  const reject =
    negativeSignals.length > 0 &&
    strongCount === 0 &&
    mediumCount === 0;

  let level = 'weak';
  let primaryReason =
    'Найден по профильному поиску, специализацию нужно подтвердить.';

  if (strongCount >= 2) {
    level = 'strong';
    primaryReason =
      'Сильное профильное соответствие работам по балконам и лоджиям.';
  } else if (strongCount === 1) {
    level = 'strong';
    primaryReason =
      matchedSignals.find(
        x => x.strength === 'strong'
      )?.label
        ? `Профильный исполнитель: ${
            matchedSignals.find(
              x => x.strength === 'strong'
            ).label.toLowerCase()
          }.`
        : 'Есть профильное соответствие задаче.';
  } else if (mediumCount >= 1) {
    level = 'medium';
    primaryReason =
      'Есть профиль по остеклению и работам с балконами и лоджиями.';
  } else if (supportingCount >= 2) {
    level = 'weak';
    primaryReason =
      'Найдены отдельные признаки подходящего подрядчика, но специализация требует проверки.';
  }

  return {
    categoryId,
    level,
    score: relevanceScore,
    primaryReason,
    matchedSignals,
    negativeSignals,
    reject
  };
}


function rankCandidate(c, city, query, preference, categoryId = '') {
  const reasons = [];

  /*
   * Final MVP ranking model:
   *
   * reputation       50
   * task fit          30
   * verification      10
   * completeness       5
   * region             5
   *
   * This is a selection-priority score,
   * NOT a reliability score.
   */

  const hay = lower([
    c.name,
    c.description,
    c.address,
    ...(c.rubrics || [])
  ].join(' '));


  /*
   * 1. TASK FIT — max 30.
   */

  const categoryRelevance =
    evaluateCategoryRelevance(
      c,
      categoryId
    );

  if (categoryRelevance.reject) {
    return {
      ...c,

      categoryRelevance,

      matchLevel:
        'Низкое',

      rankReasons: [
        categoryRelevance.primaryReason ||
        'Недостаточное соответствие услуге.'
      ],

      selectionBreakdown: {
        taskFit: 0,
        reputation: 0,
        verification: 0,
        completeness: 0,
        region: 0
      },

      _taskScore: 0,
      _reputationScore: 0,
      _score: 0
    };
  }

  let taskScore = 0;

  if (
    categoryId ===
    'balcony-insulation'
  ) {
    taskScore =
      Math.min(
        25,
        Math.max(
          0,
          Math.round(
            Number(
              categoryRelevance.score ||
              0
            ) * 0.25
          )
        )
      );

    if (
      categoryRelevance.primaryReason
    ) {
      reasons.push(
        categoryRelevance.primaryReason
      );
    }
  }

  const words =
    lower(query)
      .split(/\s+/)
      .filter(
        word =>
          word.length > 3
      );

  const queryMatch =
    words.some(
      word =>
        hay.includes(word)
    );

  if (queryMatch) {
    taskScore += 5;

    reasons.push(
      'В найденных данных подтверждена профильная специализация.'
    );
  }

  taskScore =
    Math.min(
      30,
      taskScore
    );


  /*
   * 2. REPUTATION — max 50.
   */

  const reputationSources = [];

  for (
    const source of
    (
      c.trustProfile
        ?.reputation
        ?.sources ||
      []
    )
  ) {
    const rating =
      Number(source?.rating);

    const reviewsCount =
      Number(
        source?.reviewsCount
      );

    const validRating =
      Number.isFinite(rating) &&
      rating >= 1 &&
      rating <= 5;

    const validReviewsCount =
      Number.isFinite(
        reviewsCount
      ) &&
      reviewsCount > 0;

    if (
      validRating ||
      validReviewsCount
    ) {
      reputationSources.push({
        platform:
          source.platform || '',

        label:
          source.label || '',

        rating:
          validRating
            ? rating
            : null,

        reviewsCount:
          validReviewsCount
            ? Math.max(
                0,
                reviewsCount
              )
            : 0
      });
    }
  }

  if (
    !reputationSources.length &&
    c.yandexMapsLive?.rating != null
  ) {
    reputationSources.push({
      platform:
        'yandex_maps',

      label:
        'Яндекс Карты',

      rating:
        Number(
          c.yandexMapsLive.rating
        ),

      reviewsCount:
        Number(
          c.yandexMapsLive
            .reviewsCount || 0
        )
    });
  }

  if (
    c.yandexServicesReputation
      ?.rating != null &&
    !reputationSources.some(
      source =>
        source.platform ===
        'yandex_services'
    )
  ) {
    reputationSources.push({
      platform:
        'yandex_services',

      label:
        'Яндекс Исполнители',

      rating:
        Number(
          c.yandexServicesReputation
            .rating
        ),

      reviewsCount:
        Number(
          c.yandexServicesReputation
            .reviewsCount || 0
        )
    });
  }

  if (
    !reputationSources.length &&
    c.rating != null
  ) {
    reputationSources.push({
      platform:
        'discovery',

      label:
        'Найденный профиль',

      rating:
        Number(c.rating),

      reviewsCount:
        Number(
          c.reviewsCount || 0
        )
    });
  }

  const validReputation =
    reputationSources.filter(
      source => {
        const rating =
          Number(
            source.rating
          );

        const reviewsCount =
          Number(
            source.reviewsCount
          );

        return (
          (
            Number.isFinite(rating) &&
            rating >= 1 &&
            rating <= 5
          ) ||
          (
            Number.isFinite(
              reviewsCount
            ) &&
            reviewsCount > 0
          )
        );
      }
    );

  const bestReputation =
    [...validReputation]
      .sort(
        (a, b) =>
          b.reviewsCount -
            a.reviewsCount ||
          b.rating -
            a.rating
      )[0] ||
    null;

  let reputationScore = 0;
  let ratingScore = 0;
  let reviewsScore = 0;
  let multiSourceScore = 0;

  if (bestReputation) {
    const rating =
      Number(
        bestReputation.rating
      );

    const reviews =
      Number(
        bestReputation
          .reviewsCount || 0
      );

    const hasRating =
      Number.isFinite(rating) &&
      rating >= 1 &&
      rating <= 5;

    /*
     * Rating quality — max 15.
     * No rating is invented when the
     * source exposes review volume only.
     */

    if (hasRating) {
      if (rating >= 4.9) {
        ratingScore = 15;
      } else if (rating >= 4.7) {
        ratingScore = 12;
      } else if (rating >= 4.5) {
        ratingScore = 9;
      } else if (rating >= 4.0) {
        ratingScore = 5;
      } else if (rating >= 3.5) {
        ratingScore = 2;
      }
    }

    /*
     * Review history — max 25.
     *
     * Volume matters materially more
     * than a near-perfect rating based
     * on one or two reviews.
     */

    if (reviews >= 300) {
      reviewsScore = 25;
    } else if (reviews >= 200) {
      reviewsScore = 23;
    } else if (reviews >= 100) {
      reviewsScore = 20;
    } else if (reviews >= 50) {
      reviewsScore = 16;
    } else if (reviews >= 20) {
      reviewsScore = 12;
    } else if (reviews >= 10) {
      reviewsScore = 8;
    } else if (reviews >= 3) {
      reviewsScore = 4;
    } else if (reviews >= 1) {
      reviewsScore = 1;
    }

    /*
     * Independent reputation sources — max 10.
     */

    const independentPlatforms =
      new Set(
        validReputation
          .map(
            source =>
              source.platform
          )
          .filter(Boolean)
      );

    if (
      independentPlatforms.size >= 3
    ) {
      multiSourceScore = 10;
    } else if (
      independentPlatforms.size >= 2
    ) {
      multiSourceScore = 6;
    }

    reputationScore =
      Math.min(
        50,
        ratingScore +
        reviewsScore +
        multiSourceScore
      );

    reasons.push(
      hasRating
        ? `${
            bestReputation.label ||
            'Подтверждённая репутация'
          }: ${
            rating.toFixed(1)
          } · ${
            reviews
          } ${
            reviews === 1
              ? 'оценка'
              : 'оценок/отзывов'
          }.`
        : `${
            bestReputation.label ||
            'Подтверждённая репутация'
          }: найдено ${
            reviews
          } ${
            reviews === 1
              ? 'отзыв'
              : 'отзывов/оценок'
          }; агрегированный рейтинг источник не передал.`
    );
  } else {
    reasons.push(
      'Подтверждённых данных о рейтинге и отзывах в доступных источниках не найдено.'
    );
  }


  /*
   * 3. VERIFICATION — max 10.
   */

  let verificationScore = 0;

  if (
    c.type === 'company' &&
    c.website
  ) {
    verificationScore += 3;
  }

  if (
    (c.sources || []).length > 1
  ) {
    verificationScore += 3;
  }

  if (
    c.type === 'company' &&
    c.phone
  ) {
    verificationScore += 2;
  }

  if (
    c.type === 'company' &&
    c.emailStatus === 'found' &&
    c.email
  ) {
    verificationScore += 2;
  }

  if (
    c.type === 'private' &&
    (c.sources || []).length
  ) {
    verificationScore += 3;
  }

  verificationScore =
    Math.min(
      10,
      verificationScore
    );

  if (
    (c.sources || []).length > 1
  ) {
    reasons.push(
      'Кандидат подтверждается несколькими независимыми источниками.'
    );
  }

  if (
    c.type === 'company' &&
    c.website
  ) {
    reasons.push(
      'Найден официальный сайт компании.'
    );
  }


  /*
   * 4. COMPLETENESS — max 5.
   */

  const usefulFacts =
    (c.facts || [])
      .filter(
        fact =>
          fact.status ===
            'confirmed' ||
          fact.status ===
            'claimed'
      )
      .length;

  const completenessScore =
    Math.min(
      5,
      usefulFacts
    );

  if (
    usefulFacts >= 2
  ) {
    reasons.push(
      'Найдены дополнительные сведения об условиях работы.'
    );
  }


  /*
   * 5. REGION — max 5.
   *
   * Region is deliberately the smallest
   * ranking factor.
   */

  let regionScore = 2;
  let regionStatus =
    'unknown';

  if (
    city &&
    hay.includes(
      lower(city)
    )
  ) {
    regionScore = 5;
    regionStatus =
      'exact';

    reasons.push(
      `Есть подтверждение работы по региону: ${city}.`
    );
  } else {
    /*
     * Moscow / Moscow Region service area.
     * This is intentionally broad for
     * mobile on-site services.
     */

    const serviceAreaText =
      lower([
        c.description,
        c.address,
        ...(c.rubrics || []),
        ...(c.facts || [])
          .map(
            fact =>
              fact.label || ''
          )
      ].join(' '));

    if (
      city &&
      (
        serviceAreaText.includes(
          'москва'
        ) ||
        serviceAreaText.includes(
          'московск'
        ) ||
        serviceAreaText.includes(
          'мо '
        )
      )
    ) {
      regionScore = 4;
      regionStatus =
        'service_area';

      reasons.push(
        'Найдены признаки работы по Москве или Московской области.'
      );
    }
  }


  /*
   * Light preference bonus only.
   * Not part of the public 100-point model.
   */

  let preferenceBonus = 0;

  if (
    preference &&
    preference !== 'any' &&
    preference === c.type
  ) {
    preferenceBonus = 1;
  }


  let score =
    reputationScore +
    taskScore +
    verificationScore +
    completenessScore +
    regionScore +
    preferenceBonus;

  score =
    Math.max(
      0,
      Math.min(
        100,
        score
      )
    );

  return {
    ...c,

    categoryRelevance,

    matchLevel:
      serviceMatchLevel(
        categoryRelevance,
        taskScore
      ),

    rankReasons:
      reasons.slice(
        0,
        7
      ),

    serviceMatch: {
      status:
        'matched',

      level:
        serviceMatchLevel(
          categoryRelevance,
          taskScore
        ),

      score:
        taskScore,

      reason:
        categoryRelevance
          ?.primaryReason ||
        'Услуга соответствует задаче.'
    },

    selectionBreakdown: {
      reputation:
        reputationScore,

      taskFit:
        taskScore,

      verification:
        verificationScore,

      completeness:
        completenessScore,

      region:
        regionScore,

      regionStatus,

      preferenceBonus,

      reputationDetails:
        bestReputation
          ? {
              platform:
                bestReputation.platform,

              label:
                bestReputation.label,

              rating:
                bestReputation.rating,

              reviewsCount:
                bestReputation.reviewsCount,

              ratingScore,

              reviewsScore,

              multiSourceScore,

              sourcesCount:
                new Set(
                  validReputation
                    .map(
                      source =>
                        source.platform
                    )
                    .filter(Boolean)
                ).size
            }
          : null
    },

    _taskScore:
      taskScore,

    _reputationScore:
      reputationScore,

    _score:
      score
  };
}


function parseYandexReputationText(value) {
  const textValue =
    String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  let rating = null;
  let reviewsCount = null;
  const ratingPatterns = [
    /(?:рейтинг|оценка)\s*[:\-]?\s*([1-5](?:[.,]\d{1,2})?)/i,

    /([1-5][.,]\d{1,2})\s*(?:из\s*5)?\s*[·•|]?\s*(?:\d[\d\s]*)?\s*(?:отзыв|оцен)/i
  ];

  for (const pattern of ratingPatterns) {
    const match =
      textValue.match(pattern);

    if (!match) continue;

    const number =
      Number(
        match[1].replace(',', '.')
      );

    if (
      Number.isFinite(number) &&
      number >= 1 &&
      number <= 5
    ) {
      rating = number;
      break;
    }
  }

  const reviewsPatterns = [
    /([\d\s]{1,12})\s*(?:отзыв(?:а|ов)?)/i,

    /([\d\s]{1,12})\s*(?:оцен(?:ка|ки|ок))/i
  ];

  for (const pattern of reviewsPatterns) {
    const match =
      textValue.match(pattern);

    if (!match) continue;

    const number =
      Number(
        match[1]
          .replace(/\s+/g, '')
      );

    if (
      Number.isFinite(number) &&
      number >= 1
    ) {
      reviewsCount = number;
      break;
    }
  }

  return {
    rating,
    reviewsCount
  };
}


async function yandexSearchDocuments(
  queryText,
  groupsOnPage = 10
) {
  const apiKey =
    process.env.YANDEX_SEARCH_API_KEY;

  const folderId =
    process.env.YANDEX_FOLDER_ID;

  if (!apiKey || !folderId) {
    return [];
  }

  const response = await fetch(
    'https://searchapi.api.cloud.yandex.net/v2/web/search',
    {
      method: 'POST',

      headers: {
        'Authorization':
          `Api-Key ${apiKey}`,
        'Content-Type':
          'application/json'
      },

      body: JSON.stringify({
        query: {
          searchType:
            'SEARCH_TYPE_RU',

          queryText,

          familyMode:
            'FAMILY_MODE_MODERATE',

          page: '0',

          fixTypoMode:
            'FIX_TYPO_MODE_ON'
        },

        groupSpec: {
          groupMode:
            'GROUP_MODE_FLAT',

          groupsOnPage:
            String(groupsOnPage),

          docsInGroup: '1'
        },

        maxPassages: '3',

        region: '225',

        l10N:
          'LOCALIZATION_RU',

        folderId,

        responseFormat:
          'FORMAT_XML'
      }),

      signal:
        AbortSignal.timeout(12000)
    }
  );

  if (!response.ok) {
    throw new Error(
      `YANDEX_HTTP_${response.status}`
    );
  }

  const payload =
    await response.json();

  const xml =
    Buffer
      .from(
        payload.rawData || '',
        'base64'
      )
      .toString('utf8');

  const blocks = [
    ...xml.matchAll(
      /<doc\b[^>]*>([\s\S]*?)<\/doc>/gi
    )
  ].map(match => match[1]);

  return blocks
    .map(block => {
      const url =
        xmlTag(block, 'url');

      const title =
        xmlTag(block, 'title');

      const passages = [
        ...block.matchAll(
          /<passage\b[^>]*>([\s\S]*?)<\/passage>/gi
        )
      ]
        .map(match =>
          String(match[1] || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        )
        .filter(Boolean);

      const headline =
        xmlTag(
          block,
          'headline'
        );

      return {
        url,
        title,

        text: [
          title,
          ...passages,
          headline
        ]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
      };
    })
    .filter(
      document =>
        document.url &&
        document.title
    );
}


async function yandexSearch(queryText, type, page = 0) {
  const apiKey = process.env.YANDEX_SEARCH_API_KEY;
  const folderId = process.env.YANDEX_FOLDER_ID;

  if (!apiKey || !folderId) return [];

  const response = await fetch(
    'https://searchapi.api.cloud.yandex.net/v2/web/search',
    {
      method: 'POST',
      headers: {
        'Authorization': `Api-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: {
          searchType: 'SEARCH_TYPE_RU',
          queryText,
          familyMode: 'FAMILY_MODE_MODERATE',
          page: String(page),
          fixTypoMode: 'FIX_TYPO_MODE_ON'
        },
        groupSpec: {
          groupMode: 'GROUP_MODE_FLAT',
          groupsOnPage: '15',
          docsInGroup: '1'
        },
        maxPassages: '2',
        region: '225',
        l10N: 'LOCALIZATION_RU',
        folderId,
        responseFormat: 'FORMAT_XML'
      }),
      signal: AbortSignal.timeout(12000)
    }
  );

  if (!response.ok) {
    throw new Error(`YANDEX_HTTP_${response.status}`);
  }

  const payload = await response.json();
  const xml = Buffer
    .from(payload.rawData || '', 'base64')
    .toString('utf8');

  const blocks = [
    ...xml.matchAll(/<doc\b[^>]*>([\s\S]*?)<\/doc>/gi)
  ].map(m => m[1]);

  const result = [];

  for (const block of blocks) {
    const url = xmlTag(block, 'url');
    const title = xmlTag(block, 'title');
    const description =
      xmlTag(block, 'passage') ||
      xmlTag(block, 'headline');

    if (!url || !title) continue;

    const host = hostOf(url);
    const isYandexServices =
      host === 'uslugi.yandex.ru' ||
      host.endsWith('.uslugi.yandex.ru');

    let pathname = '';
    try {
      pathname = new URL(url).pathname;
    } catch {}

    const isProfile =
      isYandexServices &&
      pathname.startsWith('/profile/');

    const isAvito =
      host === 'avito.ru' ||
      host.endsWith('.avito.ru');

    const isAvitoListing =
      isAvito &&
      /\/predlozheniya_uslug\/[^/?]+_\d+\/?$/i.test(pathname);

    const isAvitoBrand =
      isAvito &&
      /^\/brands\/[a-z0-9]+\/?$/i.test(pathname);

    if (type === 'private' && !isProfile) continue;
    if (type === 'company' && isYandexServices) continue;

    if (
      type === 'avito' &&
      (!isAvito || (!isAvitoListing && !isAvitoBrand))
    ) {
      continue;
    }

    if (
      type === 'company' &&
      [
        'profi.ru',
        'avito.ru',
        'youdo.com',
        'vk.com',
        'youtube.com',
        'rutube.ru'
      ].some(x => host === x || host.endsWith('.' + x))
    ) {
      continue;
    }

    let name = title
      .replace(/\s+[—-]\s+.*$/i, '')
      .replace(/\s*[—|-]\s*Яндекс.*$/i, '')
      .replace(/\s*[—|-]\s*официальный сайт.*$/i, '')
      .trim();

    if (type === 'avito') {
      name = name
        .replace(/\s*\(\d+\)\s*\|.*$/i, '')
        .replace(/\s*\(\d+\)\s*$/i, '')
        .replace(/\s*\|\s*(?:Услуги\s+на\s+)?Авито.*$/i, '')
        .replace(/\s*-\s*официальная\s+страница.*$/i, '')
        .trim();
    }

    const sourceName =
      type === 'avito'
        ? 'Avito'
        : isProfile
          ? 'Яндекс Исполнители'
          : 'Поиск Яндекса';

    const companyProfilePattern =
      /^(?:ооо|ип|ао|оао)(?=\s|["«»]|$)|^(?:окна|балкон|фабрика)|(?:^|[\s"'«»()_-])(?:групп|group|компания|центр|сервис|монтаж)(?=$|[\s"'«»()_-])/i;

    const personNamePattern =
      /^[А-ЯЁA-Z][а-яёa-z-]+(?:\s+[А-ЯЁA-Z][а-яёa-z-]+|\s+[А-ЯЁA-Z]\.){1,2}$/u;

    const ambiguousBrandPattern =
      /(?:^|[\s"'«»()_-])(?:проект|окна|балкон|лоджия|ремонт|строй|комфорт|сервис|студия|мастерская|специалист|фабрика|дом)(?=$|[\s"'«»()_-])/i;

    let profileType =
      type === 'avito'
        ? 'unverified'
        : type;

    if (isProfile) {
      if (companyProfilePattern.test(name)) {
        profileType = 'company';
      } else if (ambiguousBrandPattern.test(name)) {
        profileType = 'unknown';
      } else if (personNamePattern.test(name)) {
        profileType = 'private';
      } else {
        profileType = 'unknown';
      }
    }

    if (type === 'private' && profileType !== 'private') {
      continue;
    }

    const avitoPriceMatch =
      type === 'avito'
        ? description.match(
            /(?:от\s*)?([\d\s]{3,})\s*₽/i
          )
        : null;

    const avitoPriceFrom =
      avitoPriceMatch
        ? Number(
            avitoPriceMatch[1].replace(/\s+/g, '')
          )
        : null;

    result.push({
      id: hash(`${profileType}|${url}`),
      type: profileType,
      name: name.slice(0, 140),
      geo: '',
      website:
        profileType === 'company' &&
        !isProfile &&
        type !== 'avito'
          ? url
          : '',
      phone: '',
      address: '',
      description,
      rubrics: [],
      rating: null,
      reviewsCount: null,

      avito:
        type === 'avito'
          ? {
              kind: isAvitoBrand ? 'brand' : 'listing',
              publishedPriceFrom: avitoPriceFrom,
              priceEvidenceType: avitoPriceFrom
                ? 'published_listing'
                : null,
              comparableOffer: false
            }
          : undefined,

      facts: [
        {
          status: 'confirmed',
          label:
            type === 'avito'
              ? 'Объявление найдено на Avito через веб-поиск. Тип исполнителя пока не подтверждён.'
              : isProfile
                ? 'Профиль найден в Яндекс Исполнителях.'
                : 'Страница найдена через поиск Яндекса.',
          sourceId: `ys-${hash(url)}`
        }
      ],
      sources: [
        {
          id: `ys-${hash(url)}`,
          kind:
            type === 'avito'
              ? 'avito'
              : isProfile
                ? 'yandex_services'
                : 'web_search',
          label: sourceName,
          url,
          host,
          checkedAt: new Date().toISOString()
        }
      ]
    });

    if (type === 'avito' && avitoPriceFrom) {
      const candidate = result[result.length - 1];

      candidate.facts.push({
        status: 'claimed',
        label:
          `Опубликованная цена на Avito: от ${avitoPriceFrom.toLocaleString('ru-RU')} ₽`,
        sourceId: candidate.sources[0].id
      });
    }
  }

  return result;
}

function contactsFrom2gis(item) {
  const contacts = (item.contact_groups || [])
    .flatMap(g => g.contacts || []);

  let phone = '';
  let website = '';

  for (const c of contacts) {
    if (!phone && c.type === 'phone') {
      phone = c.value || c.text || '';
    }

    if (!website && ['website', 'url'].includes(c.type)) {
      website = c.url || c.value || '';
    }
  }

  return { phone, website };
}

async function dgisSearch(queryText, city) {
  const apiKey = process.env.DGIS_API_KEY;

  if (!apiKey) return [];

  const url = new URL('https://catalog.api.2gis.com/3.0/items');

  url.searchParams.set('key', apiKey);
  url.searchParams.set('q', `${queryText} ${city}`.trim());
  url.searchParams.set('type', 'branch');
  url.searchParams.set('page_size', '20');
  url.searchParams.set('locale', 'ru_RU');
  url.searchParams.set(
    'fields',
    'items.rubrics,items.reviews,items.contact_groups,items.full_address_name'
  );

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`DGIS_HTTP_${response.status}`);
  }

  const payload = await response.json();
  const items = payload?.result?.items || [];

  return items.map(item => {
    const { phone, website } = contactsFrom2gis(item);
    const rubrics = (item.rubrics || [])
      .map(x => text(x.name))
      .filter(Boolean);

    const rating =
      item.reviews?.general_rating ?? null;

    const reviewsCount =
      item.reviews?.general_review_count ?? null;

    const sourceUrl =
      `https://2gis.ru/search/${encodeURIComponent(
        `${item.name} ${city}`.trim()
      )}`;

    const sourceId = `2g-${item.id}`;

    return {
      id: `2gis-${item.id}`,
      type: 'company',
      name: text(item.name || 'Компания'),
      geo: text(item.full_address_name || item.address_name || city),
      website,
      phone,
      address: text(item.full_address_name || item.address_name),
      description: rubrics.join(', '),
      rubrics,
      rating,
      reviewsCount,
      facts: [
        {
          status: 'confirmed',
          label: 'Организация найдена в 2ГИС.',
          sourceId
        }
      ],
      sources: [
        {
          id: sourceId,
          kind: '2gis',
          label: '2ГИС',
          url: sourceUrl,
          host: '2gis.ru',
          checkedAt: new Date().toISOString()
        }
      ]
    };
  });
}

function normalizePhone(value) {
  const digits =
    String(value || '')
      .replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('8')) {
    return '7' + digits.slice(1);
  }

  return digits;
}

function normalizeDomain(value) {
  const host = hostOf(value);

  return host
    .replace(/^www\./i, '')
    .toLowerCase();
}

function normalizeAddress(value) {
  return lower(value)
    .replace(/[.,]/g, ' ')
    .replace(/\b(г|город|ул|улица|д|дом|корп|корпус|стр|строение)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeName(value) {
  return normalizeName(value)
    .split(' ')
    .filter(token => token.length >= 3);
}

function nameSimilarity(a, b) {
  const left =
    new Set(tokenizeName(a));

  const right =
    new Set(tokenizeName(b));

  if (!left.size || !right.size) {
    return 0;
  }

  let intersection = 0;

  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  const union =
    new Set([
      ...left,
      ...right
    ]).size;

  return union
    ? intersection / union
    : 0;
}

function addressSimilarity(a, b) {
  const left =
    normalizeAddress(a);

  const right =
    normalizeAddress(b);

  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  if (
    left.includes(right) ||
    right.includes(left)
  ) {
    return 0.8;
  }

  const leftTokens =
    new Set(
      left
        .split(' ')
        .filter(x => x.length >= 3)
    );

  const rightTokens =
    new Set(
      right
        .split(' ')
        .filter(x => x.length >= 3)
    );

  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  let intersection = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }

  return intersection /
    Math.max(
      leftTokens.size,
      rightTokens.size
    );
}

function compareCompanyEntities(
  base,
  external
) {
  const matchedBy = [];
  const conflicts = [];

  let score = 0;

  const baseDomain =
    normalizeDomain(
      base.website || ''
    );

  const externalDomain =
    normalizeDomain(
      external.website || ''
    );

  if (
    baseDomain &&
    externalDomain
  ) {
    if (baseDomain === externalDomain) {
      score += 40;
      matchedBy.push('domain');
    } else {
      conflicts.push('domain');
    }
  }

  const basePhone =
    normalizePhone(
      base.phone || ''
    );

  const externalPhone =
    normalizePhone(
      external.phone || ''
    );

  if (
    basePhone &&
    externalPhone
  ) {
    if (basePhone === externalPhone) {
      score += 35;
      matchedBy.push('phone');
    } else {
      conflicts.push('phone');
    }
  }

  const nameScore =
    nameSimilarity(
      base.name,
      external.name
    );

  if (nameScore >= 0.8) {
    score += 15;
    matchedBy.push('name');
  } else if (nameScore >= 0.5) {
    score += 8;
    matchedBy.push('name_partial');
  }

  const cityBase =
    lower(
      base.geo ||
      base.address ||
      ''
    );

  const cityExternal =
    lower(
      external.geo ||
      external.address ||
      ''
    );

  if (
    cityBase &&
    cityExternal
  ) {
    const cityMatch =
      cityBase.includes(cityExternal) ||
      cityExternal.includes(cityBase);

    if (cityMatch) {
      score += 5;
      matchedBy.push('city');
    }
  }

  const addressScore =
    addressSimilarity(
      base.address,
      external.address
    );

  if (addressScore >= 0.8) {
    score += 5;
    matchedBy.push('address');
  }

  /*
   * Hard conflict protection.
   *
   * If both records have a domain or phone
   * and they explicitly disagree, a weak
   * name match must never be enough.
   */
  if (
    conflicts.includes('domain') &&
    conflicts.includes('phone')
  ) {
    score = Math.min(score, 30);
  } else if (
    conflicts.includes('domain') ||
    conflicts.includes('phone')
  ) {
    score = Math.min(score, 55);
  }

  let level = 'no_match';

  if (score >= 70) {
    level = 'confirmed_match';
  } else if (score >= 50) {
    level = 'probable_match';
  }

  return {
    score,
    level,
    matchedBy,
    conflicts
  };
}

function rootDomain(value) {
  const host =
    normalizeDomain(value);

  if (!host) {
    return '';
  }

  const parts =
    host.split('.');

  if (parts.length <= 2) {
    return host;
  }

  return parts
    .slice(-2)
    .join('.');
}

function yearsBetweenDates(
  createdAt,
  now = new Date()
) {
  const created =
    new Date(createdAt);

  if (
    Number.isNaN(
      created.getTime()
    )
  ) {
    return null;
  }

  let years =
    now.getUTCFullYear() -
    created.getUTCFullYear();

  const anniversaryPassed =
    now.getUTCMonth() >
      created.getUTCMonth() ||
    (
      now.getUTCMonth() ===
        created.getUTCMonth() &&
      now.getUTCDate() >=
        created.getUTCDate()
    );

  if (!anniversaryPassed) {
    years -= 1;
  }

  return Math.max(
    0,
    years
  );
}

async function fetchRuDomainProfile(
  website
) {
  const domain =
    rootDomain(website);

  if (
    !domain ||
    !domain.endsWith('.ru')
  ) {
    return null;
  }

  const url =
    new URL(
      'https://tcinet.ru/whois/'
    );

  url.searchParams.set(
    'action',
    'yes'
  );

  url.searchParams.set(
    'domain',
    domain
  );

  url.searchParams.set(
    'domen',
    'ru'
  );

  let response;

  try {
    response =
      await fetch(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 SdelaetTrustCheck/1.0'
          },

          signal:
            AbortSignal.timeout(12000)
        }
      );
  } catch {
    return {
      domain,
      status:
        'lookup_failed'
    };
  }

  if (!response.ok) {
    return {
      domain,
      status:
        'lookup_failed'
    };
  }

  const html =
    await response.text();

  const textValue =
    html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const createdMatch =
    textValue.match(
      /created:\s*([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]+Z)/i
    );

  if (!createdMatch) {
    return {
      domain,
      status:
        'created_not_found'
    };
  }

  const createdAt =
    createdMatch[1];

  return {
    domain,

    createdAt,

    ageYears:
      yearsBetweenDates(
        createdAt
      ),

    source:
      'tcinet_whois',

    checkedAt:
      new Date().toISOString(),

    status:
      'ok'
  };
}

async function enrichCandidatesWithDomainAge(
  candidates,
  maxCompanies = 10
) {
  const companies =
    candidates
      .filter(
        candidate =>
          candidate.type === 'company' &&
          isOfficialWebsiteCandidate(
            candidate.website
          )
      )
      .slice(
        0,
        maxCompanies
      );

  for (const candidate of companies) {
    const profile =
      await fetchRuDomainProfile(
        candidate.website
      );

    if (!profile) {
      continue;
    }

    candidate.domainProfile =
      profile;
  }

  return candidates;
}


function buildTrustProfile(candidate) {
  const sources =
    candidate.sources || [];

  const officialSite =
    sources.find(
      source =>
        source.kind === 'official_site'
    );

  const dgis =
    sources.find(
      source =>
        source.kind === '2gis'
    );

  const sourceKinds =
    [...new Set(
      sources.map(source => source.kind)
    )];

  const signals = [];

  if (officialSite) {
    signals.push({
      key: 'official_site',
      status: 'confirmed',
      label: 'Найден официальный сайт',
      sourceId: officialSite.id
    });
  }

  if (
    candidate.emailStatus === 'found' &&
    candidate.email
  ) {
    signals.push({
      key: 'public_email',
      status: 'confirmed',
      label: 'Найден публичный email на официальном сайте',
      sourceId:
        officialSite?.id || ''
    });
  }

  if (
    candidate.crawl?.inspectedUrls?.length
  ) {
    signals.push({
      key: 'site_pages_checked',
      status: 'confirmed',
      label:
        `Проверено страниц официального сайта: ${candidate.crawl.inspectedUrls.length}`,
      sourceId:
        officialSite?.id || ''
    });
  }

  if (sourceKinds.length >= 2) {
    signals.push({
      key: 'multiple_sources',
      status: 'confirmed',
      label:
        `Кандидат найден в ${sourceKinds.length} типах источников`
    });
  }

  const consistency = {
    phone: {
      matched: false,
      sources: []
    },

    website: {
      matched: false,
      sources: []
    },

    address: {
      matched: false,
      sources: []
    },

    signals: []
  };

  const confirmedEntityMatches =
    (candidate.entityMatches || [])
      .filter(
        match =>
          match.level ===
          'confirmed_match'
      );

  const dgisEntityMatches =
    confirmedEntityMatches
      .filter(
        match =>
          (match.sourceKinds || [])
            .includes('2gis')
      );

  const domainMatch =
    dgisEntityMatches.find(
      match =>
        (match.matchedBy || [])
          .includes('domain')
    );

  const phoneMatch =
    dgisEntityMatches.find(
      match =>
        (match.matchedBy || [])
          .includes('phone')
    );

  const addressMatch =
    dgisEntityMatches.find(
      match =>
        (match.matchedBy || [])
          .includes('address')
    );

  if (
    officialSite &&
    dgis &&
    domainMatch
  ) {
    consistency.website.matched = true;

    consistency.website.sources = [
      'official_site',
      '2gis'
    ];

    consistency.signals.push({
      key: 'website_cross_source',
      label:
        'Сайт совпадает на официальном сайте и в 2ГИС',
      evidence: {
        score:
          domainMatch.score,
        matchedBy:
          domainMatch.matchedBy
      }
    });
  }

  if (
    officialSite &&
    dgis &&
    phoneMatch
  ) {
    consistency.phone.matched = true;

    consistency.phone.sources = [
      'official_site',
      '2gis'
    ];

    consistency.signals.push({
      key: 'phone_cross_source',
      label:
        'Телефон совпадает на официальном сайте и в 2ГИС',
      evidence: {
        score:
          phoneMatch.score,
        matchedBy:
          phoneMatch.matchedBy
      }
    });
  }

  if (
    dgis &&
    addressMatch
  ) {
    consistency.address.matched = true;

    consistency.address.sources = [
      'company',
      '2gis'
    ];

    consistency.signals.push({
      key: 'address_cross_source',
      label:
        'Адрес подтверждается данными 2ГИС',
      evidence: {
        score:
          addressMatch.score,
        matchedBy:
          addressMatch.matchedBy
      }
    });
  }

  const history = {
    domain: null,
    claimedExperience: null,
    signals: []
  };

  if (
    candidate.domainProfile?.status === 'ok'
  ) {
    history.domain = {
      domain:
        candidate.domainProfile.domain,

      createdAt:
        candidate.domainProfile.createdAt,

      ageYears:
        candidate.domainProfile.ageYears,

      source:
        candidate.domainProfile.source
    };

    history.signals.push({
      key:
        'domain_age',

      status:
        'confirmed',

      label:
        candidate.domainProfile.ageYears != null
          ? `Домен зарегистрирован ${candidate.domainProfile.ageYears} лет назад`
          : `Дата регистрации домена: ${candidate.domainProfile.createdAt}`
    });
  }

  if (
    candidate.claimedExperience
  ) {
    history.claimedExperience = {
      claimedYears:
        candidate.claimedExperience.claimedYears,

      sinceYear:
        candidate.claimedExperience.sinceYear,

      statement:
        candidate.claimedExperience.statement,

      sourceUrl:
        candidate.claimedExperience.sourceUrl,

      evidenceType:
        candidate.claimedExperience.evidenceType,

      confidence:
        candidate.claimedExperience.confidence
    };

    history.signals.push({
      key:
        'claimed_experience',

      status:
        'claimed',

      label:
        candidate.claimedExperience.sinceYear
          ? `На официальном сайте заявлена работа с ${candidate.claimedExperience.sinceYear} года`
          : `На официальном сайте заявлено ${candidate.claimedExperience.claimedYears} лет работы`,

      sourceUrl:
        candidate.claimedExperience.sourceUrl
    });
  }

  if (
    history.domain?.ageYears != null &&
    history.claimedExperience?.claimedYears != null
  ) {
    const domainAge =
      Number(
        history.domain.ageYears
      );

    const claimedYears =
      Number(
        history.claimedExperience.claimedYears
      );

    const gap =
      claimedYears -
      domainAge;

    let level =
      'consistent';

    let label =
      'Заявленный стаж сопоставим с возрастом текущего домена';

    /*
     * A company may legitimately be older
     * than its current website/domain.
     * Therefore a moderate difference is
     * informational, not a risk.
     */
    if (
      domainAge <= 2 &&
      claimedYears >= 10 &&
      gap >= 7
    ) {
      level =
        'attention';

      label =
        'Заявленный стаж значительно превышает возраст текущего домена — историю стоит подтвердить дополнительно';

    } else if (
      gap >= 5
    ) {
      level =
        'neutral';

      label =
        'Заявленный стаж превышает возраст текущего домена — компания могла использовать другой сайт';
    }

    history.comparison = {
      level,
      domainAgeYears:
        domainAge,
      claimedYears,
      gapYears:
        gap
    };

    history.signals.push({
      key:
        'experience_domain_consistency',

      status:
        level === 'attention'
          ? 'unknown'
          : 'confirmed',

      label
    });
  }

  const reputation = {
    dgis: null,

    yandexMaps:
      candidate.yandexMapsLive?.matchLevel ===
      'confirmed_match'
        ? {
            matched: true,
            source:
              candidate.yandexMapsLive.source,
            rating:
              candidate.yandexMapsLive.rating,
            reviewsCount:
              candidate.yandexMapsLive.reviewsCount,
            matchScore:
              candidate.yandexMapsLive.matchScore,
            mapsUrl:
              candidate.yandexMapsLive.mapsUrl,
            transient: true
          }
        : null
  };

  reputation.sources = [];

  if (
    reputation.yandexMaps
  ) {
    reputation.sources.push({
      platform:
        'yandex_maps',

      label:
        'Яндекс Карты',

      matched:
        true,

      matchType:
        'confirmed_match',

      rating:
        reputation.yandexMaps.rating,

      reviewsCount:
        reputation.yandexMaps.reviewsCount,

      profileUrl:
        reputation.yandexMaps.mapsUrl,

      reviews:
        candidate.yandexMapsReviews
          ?.reviews ||
        {
          available:
            false,

          year:
            new Date()
              .getUTCFullYear(),

          totalFound:
            0,

          positive: [],

          neutral: [],

          negative: []
        }
    });
  }

  if (
    candidate.yandexServicesReputation
  ) {
    reputation.sources.push({
      ...candidate.yandexServicesReputation
    });

    signals.push({
      key:
        'yandex_services_rating',

      status:
        'confirmed',

      label:
        `Яндекс Исполнители: ${
          candidate.yandexServicesReputation.rating
        } · ${
          candidate.yandexServicesReputation.reviewsCount
        } оценок`
    });
  }

  if (
    candidate.yandexMapsLive?.matchLevel ===
    'confirmed_match'
  ) {
    signals.push({
      key:
        'yandex_maps_found',

      status:
        'confirmed',

      label:
        'Организация подтверждена в Яндекс Картах'
    });

    if (
      candidate.yandexMapsLive.reviewsCount != null
    ) {
      signals.push({
        key:
          'yandex_maps_reviews',

        status:
          'confirmed',

        label:
          `Яндекс Карты: ${candidate.yandexMapsLive.reviewsCount} отзывов`
      });
    }

    if (
      candidate.yandexMapsLive.goodPlace
    ) {
      signals.push({
        key:
          'yandex_good_place',

        status:
          'confirmed',

        label:
          'В Яндекс Картах отмечено «Хорошее место»'
      });
    }

    if (
      candidate.yandexMapsLive.isClosed
    ) {
      signals.push({
        key:
          'yandex_maps_closed',

        status:
          'risk',

        label:
          'Яндекс Карты: организация отмечена как «Больше не работает»'
      });
    }
  }

  if (
    candidate.yandexMapsLive?.matchLevel ===
    'probable_match'
  ) {
    signals.push({
      key:
        'yandex_maps_probable',

      status:
        'unknown',

      label:
        'В Яндекс Картах найдена похожая организация, но данных недостаточно для подтверждения'
    });
  }

  const confirmedDgisMatch =
    dgisEntityMatches
      .sort(
        (a, b) =>
          b.score - a.score
      )[0] || null;

  if (
    dgis &&
    candidate.rating &&
    confirmedDgisMatch
  ) {
    reputation.dgis = {
      matched: true,

      rating:
        Number(candidate.rating),

      reviewsCount:
        Number(
          candidate.reviewsCount || 0
        ),

      url:
        dgis.url,

      sourceId:
        dgis.id,

      entityMatch: {
        score:
          confirmedDgisMatch.score,

        matchedBy:
          confirmedDgisMatch.matchedBy
      }
    };
  }

  let verificationLevel =
    'insufficient';

  if (
    candidate.type === 'company' &&
    officialSite &&
    (
      candidate.email ||
      candidate.phone
    )
  ) {
    verificationLevel =
      'confirmed';
  } else if (
    candidate.type === 'company' &&
    (
      officialSite ||
      dgis
    )
  ) {
    verificationLevel =
      'partial';
  } else if (
    candidate.type === 'private'
  ) {
    verificationLevel =
      'profile';
  }

  return {
    verification: {
      level:
        verificationLevel
    },

    history,

    reputation,

    consistency,

    signals
  };
}

function mergeCandidateData(
  current,
  incoming,
  entityMatch = null
) {
  current.website ||= incoming.website;
  current.phone ||= incoming.phone;
  current.address ||= incoming.address;
  current.geo ||= incoming.geo;
  current.description ||= incoming.description;

  /*
   * Reputation data may only be inherited
   * after records have been explicitly
   * matched as the same company.
   */
  if (
    incoming.rating != null &&
    current.rating == null
  ) {
    current.rating = incoming.rating;
  }

  if (
    incoming.reviewsCount != null &&
    current.reviewsCount == null
  ) {
    current.reviewsCount =
      incoming.reviewsCount;
  }

  current.rubrics = [
    ...new Set([
      ...(current.rubrics || []),
      ...(incoming.rubrics || [])
    ])
  ];

  current.sources =
    current.sources || [];

  for (const source of incoming.sources || []) {
    if (
      !current.sources.some(
        existing =>
          existing.url === source.url
      )
    ) {
      current.sources.push(source);
    }
  }

  current.facts =
    current.facts || [];

  for (const fact of incoming.facts || []) {
    if (
      !current.facts.some(
        existing =>
          existing.label === fact.label &&
          existing.sourceId === fact.sourceId
      )
    ) {
      current.facts.push(fact);
    }
  }

  if (entityMatch) {
    current.entityMatches =
      current.entityMatches || [];

    const incomingKinds =
      [...new Set(
        (incoming.sources || [])
          .map(source => source.kind)
          .filter(Boolean)
      )];

    const incomingSourceIds =
      (incoming.sources || [])
        .map(source => source.id)
        .filter(Boolean);

    current.entityMatches.push({
      level:
        entityMatch.level,

      score:
        entityMatch.score,

      matchedBy:
        [...entityMatch.matchedBy],

      conflicts:
        [...entityMatch.conflicts],

      sourceKinds:
        incomingKinds,

      sourceIds:
        incomingSourceIds
    });
  }

  return current;
}

function mergeCandidates(items) {
  const result = [];

  const nonCompanyMap =
    new Map();

  for (const original of items) {
    const candidate =
      structuredClone(original);

    /*
     * Private profiles and unverified
     * advertisements retain the previous
     * source-based deduplication behaviour.
     */
    if (candidate.type !== 'company') {
      const key =
        candidateKey(candidate);

      if (!nonCompanyMap.has(key)) {
        nonCompanyMap.set(
          key,
          candidate
        );

        result.push(candidate);
        continue;
      }

      const current =
        nonCompanyMap.get(key);

      mergeCandidateData(
        current,
        candidate
      );

      continue;
    }

    /*
     * Companies require explicit entity
     * matching. Name alone is not enough.
     */
    let best = null;

    for (const current of result) {
      if (current.type !== 'company') {
        continue;
      }

      const currentDomain =
        normalizeDomain(
          current.website || ''
        );

      const candidateDomain =
        normalizeDomain(
          candidate.website || ''
        );

      const currentPhone =
        normalizePhone(
          current.phone || ''
        );

      const candidatePhone =
        normalizePhone(
          candidate.phone || ''
        );

      let match;

      /*
       * Exact domain and exact phone are
       * very strong identity signals.
       * Still record the evidence through
       * the common matcher structure.
       */
      if (
        currentDomain &&
        candidateDomain &&
        currentDomain === candidateDomain
      ) {
        match =
          compareCompanyEntities(
            current,
            candidate
          );

        if (
          !match.matchedBy.includes(
            'domain'
          )
        ) {
          match.matchedBy.push(
            'domain'
          );
        }

        match.score =
          Math.max(
            match.score,
            70
          );

        match.level =
          'confirmed_match';

      } else if (
        currentPhone &&
        candidatePhone &&
        currentPhone === candidatePhone
      ) {
        match =
          compareCompanyEntities(
            current,
            candidate
          );

        if (
          !match.matchedBy.includes(
            'phone'
          )
        ) {
          match.matchedBy.push(
            'phone'
          );
        }

        match.score =
          Math.max(
            match.score,
            70
          );

        match.level =
          'confirmed_match';

      } else {
        match =
          compareCompanyEntities(
            current,
            candidate
          );
      }

      if (
        match.level !==
        'confirmed_match'
      ) {
        continue;
      }

      if (
        !best ||
        match.score > best.match.score
      ) {
        best = {
          current,
          match
        };
      }
    }

    if (best) {
      mergeCandidateData(
        best.current,
        candidate,
        best.match
      );

      continue;
    }

    /*
     * probable_match is deliberately NOT
     * merged. A weak match must remain a
     * separate candidate until additional
     * evidence is available.
     */
    result.push(candidate);
  }

  return result;
}


function extractPhonesFromText(value) {
  const source =
    String(value || '');

  const matches =
    source.match(
      /(?:\+7|8)[\s()\-]*\d{3}[\s()\-]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}/g
    ) || [];

  return [
    ...new Set(
      matches
        .map(normalizePhone)
        .filter(Boolean)
    )
  ];
}

function parseYandexMapsSignals(value) {
  const textValue =
    String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const reviewsMatch =
    textValue.match(
      /(?:читать\s+)?([\d\s]{1,12})\s+отзыв(?:а|ов)?/i
    );

  const reviewsCount =
    reviewsMatch
      ? Number(
          reviewsMatch[1]
            .replace(/\s+/g, '')
        )
      : (
          /ещ[её]\s+нет\s+отзывов/i.test(textValue)
            ? 0
            : null
        );

  const isClosed =
    /больше\s+не\s+работает/i.test(textValue);

  const goodPlace =
    /хорошее\s+место/i.test(textValue);

  return {
    reviewsCount:
      Number.isFinite(reviewsCount)
        ? reviewsCount
        : null,

    isClosed,
    goodPlace
  };
}


function compactCompanyName(value) {
  return lower(value)
    .replace(/[^a-zа-яё0-9]+/giu, '')
    .trim();
}

function compactNameMatches(
  candidateName,
  externalTitle
) {
  const candidateCompact =
    compactCompanyName(
      candidateName
    );

  const externalCompact =
    compactCompanyName(
      externalTitle
    );

  if (
    candidateCompact.length < 5 ||
    externalCompact.length < 5
  ) {
    return false;
  }

  return externalCompact.includes(
    candidateCompact
  );
}


function yandexMapsCategoryScore(
  candidate,
  document
) {
  const hay =
    lower(
      [
        document.title,
        document.text
      ].join(' ')
    );

  const categoryId =
    candidate.categoryId || '';

  /*
   * MVP category:
   * balcony insulation / glazing / finishing.
   */
  const positivePatterns = [
    /остеклен/i,
    /утеплен/i,
    /балкон/i,
    /лоджи/i,
    /окн/i,
    /строительн/i,
    /отделочн/i,
    /ремонт/i
  ];

  const negativePatterns = [
    /недвижимост/i,
    /оценочн/i,
    /хостел/i,
    /жилой комплекс/i,
    /мебел/i,
    /жилищн/i,
    /интернет-сайт/i
  ];

  let positive = 0;
  let negative = 0;

  for (const pattern of positivePatterns) {
    if (pattern.test(hay)) {
      positive += 1;
    }
  }

  for (const pattern of negativePatterns) {
    if (pattern.test(hay)) {
      negative += 1;
    }
  }

  return {
    categoryId,
    positive,
    negative,

    relevant:
      positive >= 1 &&
      negative === 0
  };
}


async function findYandexReputation(
  candidate,
  city
) {
  if (
    candidate.type !== 'company' ||
    !process.env.YANDEX_SEARCH_API_KEY ||
    !process.env.YANDEX_FOLDER_ID
  ) {
    return null;
  }

  const candidatePhone =
    normalizePhone(
      candidate.phone || ''
    );

  const candidateDomain =
    normalizeDomain(
      candidate.website || ''
    );

  const searchQueries = [];

  /*
   * 1. Phone-first.
   * Exact public phone match is the strongest
   * signal available in Yandex Maps snippets.
   */
  if (candidatePhone) {
    searchQueries.push({
      kind: 'phone',
      query: [
        'site:yandex.ru/maps/org',
        candidate.phone,
        city || ''
      ]
        .filter(Boolean)
        .join(' ')
    });
  }

  /*
   * 2. Domain + name fallback.
   */
  if (candidateDomain) {
    searchQueries.push({
      kind: 'domain',
      query: [
        'site:yandex.ru/maps/org',
        `"${candidate.name}"`,
        candidateDomain,
        city || ''
      ]
        .filter(Boolean)
        .join(' ')
    });
  }

  /*
   * 3. Name fallback.
   * Accepted only with additional evidence.
   */
  searchQueries.push({
    kind: 'name',
    query: [
      'site:yandex.ru/maps/org',
      `"${candidate.name}"`,
      city || ''
    ]
      .filter(Boolean)
      .join(' ')
  });

  let best = null;

  for (const search of searchQueries) {
    let documents = [];

    try {
      documents =
        await yandexSearchDocuments(
          search.query,
          10
        );
    } catch {
      continue;
    }

    const mapDocuments =
      documents.filter(document => {
        const host =
          hostOf(document.url);

        return (
          (
            host === 'yandex.ru' ||
            host.endsWith('.yandex.ru')
          ) &&
          /\/maps\/org\//i.test(
            document.url
          )
        );
      });

    for (const document of mapDocuments) {
      const documentPhones =
        extractPhonesFromText(
          document.text
        );

      const exactPhoneMatch =
        candidatePhone &&
        documentPhones.includes(
          candidatePhone
        );

      const nameScore =
        nameSimilarity(
          candidate.name,
          document.title
        );

      const hay =
        lower(
          [
            document.title,
            document.text
          ].join(' ')
        );

      const domainMatch =
        candidateDomain &&
        hay.includes(
          lower(candidateDomain)
        );

      let matchScore = 0;
      const matchedBy = [];

      if (exactPhoneMatch) {
        matchScore += 80;
        matchedBy.push('phone');
      }

      if (domainMatch) {
        matchScore += 40;
        matchedBy.push('domain');
      }

      if (nameScore >= 0.8) {
        matchScore += 15;
        matchedBy.push('name');
      } else if (nameScore >= 0.5) {
        matchScore += 8;
        matchedBy.push('name_partial');
      }

      if (
        compactNameMatches(
          candidate.name,
          document.title
        ) &&
        !matchedBy.includes('name')
      ) {
        matchScore += 12;
        matchedBy.push(
          'name_compact'
        );
      }

      matchScore =
        Math.min(
          100,
          matchScore
        );

      /*
       * Safety:
       * - exact phone alone is enough;
       * - otherwise domain + name is required;
       * - name alone is never enough.
       */
      const categoryMatch =
        yandexMapsCategoryScore(
          candidate,
          document
        );

      const confirmed =
        exactPhoneMatch ||
        (
          domainMatch &&
          nameScore >= 0.5
        );

      const compactNameMatch =
        compactNameMatches(
          candidate.name,
          document.title
        );

      const strongNameMatch =
        nameScore >= 0.8 ||
        compactNameMatch;

      const probable =
        !confirmed &&
        strongNameMatch &&
        categoryMatch.relevant &&
        (
          (
            city &&
            hay.includes(
              lower(city)
            )
          ) ||
          hay.includes('мытищ')
        );

      if (
        !confirmed &&
        !probable
      ) {
        continue;
      }

      const signals =
        parseYandexMapsSignals(
          document.text
        );

      const reputation =
        parseYandexReputationText(
          document.text
        );

      let organizationId = '';

      try {
        const match =
          document.url.match(
            /\/maps\/org\/[^/]+\/(\d+)\/?/i
          );

        organizationId =
          match?.[1] || '';
      } catch {}

      const item = {
        source:
          'yandex_search',

        matchLevel:
          confirmed
            ? 'confirmed_match'
            : 'probable_match',

        mapsUrl:
          document.url,

        organizationId,

        rating:
          reputation.rating,

        reviewsCount:
          signals.reviewsCount ??
          reputation.reviewsCount,

        isClosed:
          signals.isClosed,

        goodPlace:
          signals.goodPlace,

        matchScore,

        matchedBy,

        searchKind:
          search.kind,

        checkedAt:
          new Date().toISOString()
      };

      if (
        !best ||
        item.matchScore >
          best.matchScore
      ) {
        best = item;
      }
    }

    /*
     * Exact phone match is strong enough.
     * No reason to spend another query.
     */
    if (
      best &&
      best.matchedBy.includes('phone')
    ) {
      break;
    }
  }

  return best;
}


async function findOfficialDomainEvidencePages(
  candidate
) {
  if (
    candidate.type !== 'company' ||
    !isOfficialWebsiteCandidate(
      candidate.website
    ) ||
    !process.env.YANDEX_SEARCH_API_KEY ||
    !process.env.YANDEX_FOLDER_ID
  ) {
    return [];
  }

  const domain =
    rootDomain(
      candidate.website
    );

  if (!domain) {
    return [];
  }

  const needsLegal =
    !candidate.legalIdentity;

  const needsExperience =
    !candidate.claimedExperience;

  if (
    !needsLegal &&
    !needsExperience
  ) {
    return [];
  }

  const queries = [];

  if (needsLegal) {
    queries.push({
      kind: 'legal',

      query:
        `"${domain}" ИНН ОГРН`
    });
  }

  if (needsExperience) {
    queries.push({
      kind: 'experience',

      query:
        `"${candidate.name}" "${domain}" "о компании"`
    });
  }

  const found = [];

  for (const search of queries) {
    let documents = [];

    try {
      documents =
        await yandexSearchDocuments(
          search.query,
          10
        );
    } catch {
      continue;
    }

    for (const document of documents) {
      let documentUrl;

      try {
        documentUrl =
          new URL(document.url);
      } catch {
        continue;
      }

      const documentDomain =
        rootDomain(
          documentUrl.href
        );

      /*
       * Critical safety rule:
       * Search is discovery only.
       * Evidence page must belong to
       * the same root official domain.
       */
      if (
        documentDomain !== domain
      ) {
        continue;
      }

      if (
        !['http:', 'https:']
          .includes(documentUrl.protocol)
      ) {
        continue;
      }

      documentUrl.hash = '';

      let score = 0;

      const hay =
        lower(
          [
            document.title,
            document.text,
            documentUrl.pathname
          ].join(' ')
        );

      if (
        search.kind === 'legal'
      ) {
        if (
          /инн|огрн|огрнип|реквизит/i
            .test(hay)
        ) {
          score += 100;
        }

        if (
          /контакт|contacts?/i
            .test(hay)
        ) {
          score += 30;
        }
      }

      if (
        search.kind === 'experience'
      ) {
        if (
          /о[\s_-]*компани|about/i
            .test(hay)
        ) {
          score += 100;
        }

        if (
          /\d{1,2}\s+лет|с\s+(?:19|20)\d{2}\s+года|на\s+рынке/i
            .test(hay)
        ) {
          score += 50;
        }
      }

      if (!score) {
        continue;
      }

      found.push({
        kind:
          search.kind,

        url:
          documentUrl.href,

        score
      });
    }
  }

  const selectedPages = [];

  for (const kind of [
    'legal',
    'experience'
  ]) {
    const best =
      found
        .filter(
          item =>
            item.kind === kind
        )
        .sort(
          (a, b) =>
            b.score - a.score
        )[0];

    if (!best) {
      continue;
    }

    const existing =
      selectedPages.find(
        item =>
          item.url === best.url
      );

    if (existing) {
      /*
       * The same official page may contain
       * both company history and legal data.
       */
      existing.kinds = [
        ...new Set([
          ...(existing.kinds || [
            existing.kind
          ]),
          kind
        ])
      ];

      continue;
    }

    selectedPages.push({
      ...best,
      kinds: [kind]
    });
  }

  return selectedPages;
}


async function enrichCandidatesWithOfficialDomainEvidence(
  candidates,
  maxCompanies = 5
) {
  const companies =
    candidates
      .filter(
        candidate =>
          candidate.type === 'company' &&
          isOfficialWebsiteCandidate(
            candidate.website
          ) &&
          (
            !candidate.legalIdentity ||
            !candidate.claimedExperience
          )
      )
      .slice(
        0,
        maxCompanies
      );

  for (const candidate of companies) {
    const pages =
      await findOfficialDomainEvidencePages(
        candidate
      );

    if (!pages.length) {
      continue;
    }

    candidate.officialEvidencePages =
      pages.map(page => ({
        kind:
          page.kind,

        kinds:
          page.kinds || [
            page.kind
          ],

        url:
          page.url
      }));

    for (const page of pages) {
      let crawl;

      try {
        crawl =
          await crawlCompanySite(
            page.url
          );
      } catch {
        continue;
      }

      if (!crawl?.ok) {
        continue;
      }

      /*
       * crawlCompanySite performs the actual
       * extraction and validation.
       * Yandex Search itself is never evidence.
       */

      if (
        !candidate.legalIdentity &&
        crawl.legalIdentity
      ) {
        candidate.legalIdentity = {
          ...crawl.legalIdentity,

          discoveredVia:
            'yandex_search',

          verifiedFrom:
            'official_site'
        };
      }

      if (
        !candidate.claimedExperience &&
        crawl.experience
      ) {
        candidate.claimedExperience = {
          ...crawl.experience,

          discoveredVia:
            'yandex_search',

          verifiedFrom:
            'official_site'
        };
      }

      if (
        candidate.legalIdentity &&
        candidate.claimedExperience
      ) {
        break;
      }
    }
  }

  return candidates;
}


function extractYandexServicesReputation(
  html,
  profileUrl
) {
  const source =
    String(html || '');

  /*
   * Prefer schema.org AggregateRating.
   * It is materially safer than parsing
   * arbitrary visible numbers.
   */
  const aggregateMatch =
    source.match(
      /"aggregateRating"\s*:\s*\{[\s\S]{0,500}?"ratingValue"\s*:\s*([0-9]+(?:\.[0-9]+)?)[\s\S]{0,300}?"reviewCount"\s*:\s*(\d+)/i
    );

  let rating = null;
  let reviewsCount = null;
  let ratingStats = null;

  /*
   * Aggregate rating distribution exposed
   * in the public Yandex Services profile state.
   */
  const ratingStatsMatch =
    source.match(
      /"ratingStats"\s*:\s*\{\s*"1"\s*:\s*(\d+)\s*,\s*"2"\s*:\s*(\d+)\s*,\s*"3"\s*:\s*(\d+)\s*,\s*"4"\s*:\s*(\d+)\s*,\s*"5"\s*:\s*(\d+)\s*\}/i
    );

  if (ratingStatsMatch) {
    ratingStats = {
      1: Number(ratingStatsMatch[1]),
      2: Number(ratingStatsMatch[2]),
      3: Number(ratingStatsMatch[3]),
      4: Number(ratingStatsMatch[4]),
      5: Number(ratingStatsMatch[5])
    };
  }

  /*
   * Some Yandex Services profiles expose
   * ratingStats but omit AggregateRating.
   * Derive aggregate values from the public
   * distribution instead of dropping reputation.
   */
  if (
    ratingStats &&
    (
      rating == null ||
      reviewsCount == null
    )
  ) {
    const total =
      Object.values(ratingStats)
        .reduce(
          (sum, count) =>
            sum + Number(count || 0),
          0
        );

    if (total > 0) {
      const weighted =
        Object.entries(ratingStats)
          .reduce(
            (sum, [stars, count]) =>
              sum +
              Number(stars) *
              Number(count || 0),
            0
          );

      reviewsCount =
        total;

      rating =
        Math.round(
          (weighted / total) * 10
        ) / 10;
    }
  }

  if (aggregateMatch) {
    rating =
      Number(
        aggregateMatch[1]
      );

    reviewsCount =
      Number(
        aggregateMatch[2]
      );
  }

  /*
   * Fallback for rendered profile text.
   */
  if (
    rating == null ||
    reviewsCount == null
  ) {
    const visible =
      source
        .replace(
          /<style\b[^>]*>[\s\S]*?<\/style>/gi,
          ' '
        )
        .replace(
          /<script\b[^>]*>[\s\S]*?<\/script>/gi,
          ' '
        )
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const match =
      visible.match(
        /Рейтинг специалиста\s*([1-5](?:[.,]\d+)?)\s*(\d+)\s*оцен/i
      );

    if (match) {
      rating =
        Number(
          match[1]
            .replace(',', '.')
        );

      reviewsCount =
        Number(match[2]);
    }
  }

  if (
    !Number.isFinite(rating) ||
    rating < 1 ||
    rating > 5 ||
    !Number.isFinite(reviewsCount) ||
    reviewsCount < 0
  ) {
    return null;
  }

  return {
    platform:
      'yandex_services',

    label:
      'Яндекс Исполнители',

    matched:
      true,

    matchType:
      'confirmed_source',

    rating,

    reviewsCount,

    ratingStats,

    profileUrl,

    reviews: {
      available:
        false,

      year:
        new Date()
          .getUTCFullYear(),

      positive: [],

      negative: []
    },

    checkedAt:
      new Date()
        .toISOString()
  };
}


async function enrichCandidatesWithYandexServicesReputation(
  candidates,
  maxProfiles = 5
) {
  const targets =
    candidates
      .filter(
        candidate =>
          candidate.type === 'private' &&
          (candidate.sources || [])
            .some(
              source =>
                source.kind ===
                'yandex_services' &&
                source.url
            )
      )
      .slice(
        0,
        maxProfiles
      );

  await Promise.all(
    targets.map(
      async candidate => {
        const source =
          (candidate.sources || [])
            .find(
              item =>
                item.kind ===
                'yandex_services' &&
                item.url
            );

        if (!source?.url) {
          return;
        }

        try {
          const response =
            await fetch(
              source.url,
              {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36',

                  'Accept-Language':
                    'ru-RU,ru;q=0.9,en;q=0.5'
                },

                redirect:
                  'follow',

                signal:
                  AbortSignal.timeout(
                    15000
                  )
              }
            );

          if (!response.ok) {
            return;
          }

          const html =
            await response.text();

          const enrichment =
            extractYandexServicesProfile(
              html,
              source.url
            );

          if (
            !enrichment?.reputation &&
            !enrichment?.profile
          ) {
            return;
          }

          if (enrichment.reputation) {
            candidate.yandexServicesReputation =
              enrichment.reputation;
          }

          if (enrichment.profile) {
            candidate.yandexServicesProfile =
              enrichment.profile;
          }
        } catch {}
      }
    )
  );

  return candidates;
}


function extractBalancedJsonValue(
  source,
  startIndex
) {
  let start =
    startIndex;

  while (
    start < source.length &&
    /\s/.test(source[start])
  ) {
    start += 1;
  }

  const opener =
    source[start];

  if (
    opener !== '[' &&
    opener !== '{'
  ) {
    return null;
  }

  const closer =
    opener === '['
      ? ']'
      : '}';

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (
    let i = start;
    i < source.length;
    i += 1
  ) {
    const char =
      source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === opener) {
      depth += 1;
      continue;
    }

    if (char === closer) {
      depth -= 1;

      if (depth === 0) {
        return source.slice(
          start,
          i + 1
        );
      }
    }
  }

  return null;
}


function extractYandexMapsReviewObjects(
  html
) {
  const source =
    String(html || '');

  const marker =
    '"reviewResults":{"reviews":';

  const index =
    source.indexOf(marker);

  if (index === -1) {
    return [];
  }

  const valueStart =
    index +
    marker.length;

  const json =
    extractBalancedJsonValue(
      source,
      valueStart
    );

  if (!json) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(json);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}


function normalizeYandexMapsReview(
  review,
  profileUrl
) {
  if (
    !review ||
    typeof review !== 'object'
  ) {
    return null;
  }

  const rating =
    Number(review.rating);

  const textValue =
    String(
      review.text || ''
    )
      .replace(/\s+/g, ' ')
      .trim();

  const updatedTime =
    String(
      review.updatedTime || ''
    );

  if (
    !review.reviewId ||
    !Number.isFinite(rating) ||
    rating < 1 ||
    rating > 5 ||
    !textValue ||
    !updatedTime
  ) {
    return null;
  }

  const date =
    new Date(updatedTime);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return {
    id:
      String(review.reviewId),

    author:
      String(
        review.author?.name ||
        'Пользователь Яндекс Карт'
      ),

    rating,

    text:
      textValue.slice(
        0,
        1200
      ),

    updatedTime:
      date.toISOString(),

    year:
      date.getUTCFullYear(),

    sourceUrl:
      profileUrl,

    businessComment:
      review.businessComment?.text
        ? String(
            review.businessComment.text
          )
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 800)
        : null
  };
}


function extractReviewTopics(
  reviews
) {
  const topicRules = [
    {
      key: 'quality',
      label: 'Качество работ',
      pattern:
        /качеств|качествен|передел|дефект|брак|косяк|недоч[её]т/i
    },
    {
      key: 'timing',
      label: 'Сроки',
      pattern:
        /срок|быстро|вовремя|задерж|опозд|перенос|долго/i
    },
    {
      key: 'communication',
      label: 'Коммуникация',
      pattern:
        /менеджер|консультац|объяснил|ответил|связи|общени|вежлив|отношени/i
    },
    {
      key: 'price',
      label: 'Стоимость',
      pattern:
        /цен[аыуе]|стоимост|дорог|дешев|смет|доплат|переплат/i
    },
    {
      key: 'installation',
      label: 'Монтаж',
      pattern:
        /монтаж|установ|замер|про[её]м|створк|окн/i
    },
    {
      key: 'cleanliness',
      label: 'Аккуратность',
      pattern:
        /аккурат|чист|мусор|убрал|опрят/i
    },
    {
      key: 'warranty',
      label: 'Гарантия и исправления',
      pattern:
        /гарант|исправ|устран|претензи|рекламац/i
    }
  ];

  const result = [];

  for (const rule of topicRules) {
    let mentions = 0;

    for (const review of reviews) {
      if (
        rule.pattern.test(
          String(review.text || '')
        )
      ) {
        mentions += 1;
      }
    }

    if (mentions > 0) {
      result.push({
        key:
          rule.key,

        label:
          rule.label,

        mentions
      });
    }
  }

  return result
    .sort(
      (a, b) =>
        b.mentions - a.mentions ||
        a.label.localeCompare(
          b.label,
          'ru'
        )
    )
    .slice(0, 4);
}


function groupYandexMapsReviews(
  reviews,
  year =
    new Date().getUTCFullYear()
) {
  const current =
    reviews
      .filter(
        review =>
          review &&
          review.year === year
      )
      .sort(
        (a, b) =>
          String(b.updatedTime)
            .localeCompare(
              String(a.updatedTime)
            )
      );

  const positive =
    current.filter(
      review =>
        review.rating >= 4
    );

  const neutral =
    current.filter(
      review =>
        review.rating === 3
    );

  const negative =
    current.filter(
      review =>
        review.rating <= 2
    );

  return {
    available:
      current.length > 0,

    year,

    totalFound:
      current.length,

    counts: {
      positive:
        positive.length,

      neutral:
        neutral.length,

      negative:
        negative.length
    },

    topics: {
      positive:
        extractReviewTopics(
          positive
        ),

      neutral:
        extractReviewTopics(
          neutral
        ),

      negative:
        extractReviewTopics(
          negative
        )
    },

    positive:
      positive.slice(0, 3),

    neutral:
      neutral.slice(0, 3),

    negative:
      negative.slice(0, 3)
  };
}


async function fetchYandexMapsReviews(
  profileUrl
) {
  if (!profileUrl) {
    return null;
  }

  let reviewsUrl;

  try {
    const url =
      new URL(profileUrl);

    url.pathname =
      url.pathname
        .replace(/\/+$/, '') +
      '/reviews/';

    url.search = '';
    url.hash = '';

    reviewsUrl =
      url.href;
  } catch {
    return null;
  }

  try {
    const response =
      await fetch(
        reviewsUrl,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36',

            'Accept-Language':
              'ru-RU,ru;q=0.9'
          },

          redirect:
            'follow',

          signal:
            AbortSignal.timeout(
              20000
            )
        }
      );

    if (!response.ok) {
      return null;
    }

    const html =
      await response.text();

    const raw =
      extractYandexMapsReviewObjects(
        html
      );

    const normalized =
      raw
        .map(
          review =>
            normalizeYandexMapsReview(
              review,
              reviewsUrl
            )
        )
        .filter(Boolean);

    return {
      profileUrl:
        reviewsUrl,

      reviews:
        groupYandexMapsReviews(
          normalized
        ),

      fetchedAt:
        new Date()
          .toISOString()
    };
  } catch {
    return null;
  }
}


async function enrichCandidatesWithYandexMapsReviews(
  candidates,
  maxCompanies = 5
) {
  const targets =
    candidates
      .filter(
        candidate =>
          candidate.type === 'company' &&
          candidate.yandexMapsLive
            ?.matchLevel ===
            'confirmed_match' &&
          candidate.yandexMapsLive
            ?.mapsUrl
      )
      .slice(
        0,
        maxCompanies
      );

  await Promise.all(
    targets.map(
      async candidate => {
        const result =
          await fetchYandexMapsReviews(
            candidate.yandexMapsLive
              .mapsUrl
          );

        if (!result) {
          return;
        }

        candidate.yandexMapsReviews =
          result;
      }
    )
  );

  return candidates;
}


async function enrichCandidatesWithYandexReputation(
  candidates,
  city,
  maxCompanies = 5
) {
  const companies =
    candidates
      .filter(
        candidate =>
          candidate.type === 'company'
      )
      .slice(
        0,
        maxCompanies
      );

  for (const candidate of companies) {
    const reputation =
      await findYandexReputation(
        candidate,
        city
      );

    if (!reputation) {
      continue;
    }

    /*
     * TRANSIENT:
     * stripTransientData() prevents this
     * object from entering SQLite and
     * localStorage.
     */
    candidate.yandexMapsLive =
      reputation;
  }

  return candidates;
}


async function enrichCandidatesWithFnsProfile(
  candidates,
  limit = 5
) {
  let checked = 0;

  for (const candidate of candidates) {
    if (checked >= limit) break;

    const legal =
      candidate?.legalIdentity;

    if (
      candidate?.type !== 'company' ||
      !legal?.inn
    ) {
      continue;
    }

    checked += 1;

    try {
      const existingProfile = candidate.fnsProfile;
      const profile =
        existingProfile &&
        String(existingProfile.inn || '').replace(/\D/g, '') === String(legal.inn || '').replace(/\D/g, '')
          ? existingProfile
          : await fetchFnsProfile({
              inn: legal.inn,
              ogrn: legal.ogrn || ''
            });

      if (
        !profile ||
        profile.available === false
      ) {
        continue;
      }

      candidate.fnsProfile =
        profile;

      candidate.legalIdentity = {
        ...legal,

        inn:
          profile.inn ||
          legal.inn,

        ogrn:
          profile.ogrn ||
          legal.ogrn,

        legalForm:
          legal.legalForm ||
          profile.legalForm ||
          null,

        legalName:
          legal.legalName ||
          profile.legalName ||
          null,

        registeredAt:
          profile.registeredAt ||
          legal.registeredAt ||
          '',

        active:
          typeof profile.active === 'boolean'
            ? profile.active
            : legal.active,

        statusLabel:
          profile.statusLabel ||
          legal.statusLabel ||
          '',

        officialRegistrySource:
          'fns_transparent_business',

        officialRegistryUrl:
          profile.sourceUrl ||
          '',

        officialRegistryCheckedAt:
          profile.checkedAt ||
          ''
      };
    } catch (error) {
      console.warn(
        'FNS profile enrichment failed',
        candidate?.id || candidate?.name || '',
        String(error?.message || error)
      );
    }
  }

  return candidates;
}


async function enrichCandidatesWithLegalIdentityDiscovery(
  candidates,
  city,
  limit = 5
) {
  let checked = 0;
  for (const candidate of candidates) {
    if (checked >= limit || candidate?.type !== 'company' || candidate.legalIdentity) continue;
    checked += 1;
    const documents = [];
    for (const query of buildLegalIdentityDiscoveryQueries(candidate, city)) {
      try {
        documents.push(...await yandexSearchDocuments(query, 10));
      } catch (error) {
        console.warn('Legal identity discovery search failed', candidate?.id || candidate?.name || '', String(error?.message || error));
      }
    }
    const selected = selectLegalIdentityDiscovery(candidate, city, documents);
    if (!selected) continue;
    try {
      const profile = await fetchFnsProfile({ inn: selected.inn, ogrn: selected.ogrn || '' });
      if (!profile || profile.available === false || String(profile.inn || '').replace(/\D/g, '') !== selected.inn) continue;
      candidate.fnsProfile = profile;
      candidate.legalIdentity = {
        legalForm: profile.legalForm || null,
        legalName: profile.legalName || profile.fullLegalName || null,
        inn: profile.inn,
        ogrn: profile.ogrn || selected.ogrn || '',
        registeredAt: profile.registeredAt || '',
        active: typeof profile.active === 'boolean' ? profile.active : null,
        statusLabel: profile.statusLabel || '',
        sourceUrl: profile.sourceUrl || '',
        confidence: 'high',
        discoveredVia: 'legal_identity_discovery',
        verifiedFrom: 'fns',
        matchSignals: selected.matchSignals,
        matchScore: selected.matchScore,
        matchedSources: selected.matchedSources,
        officialRegistrySource: 'fns_transparent_business',
        officialRegistryUrl: profile.sourceUrl || '',
        officialRegistryCheckedAt: profile.checkedAt || ''
      };
    } catch (error) {
      console.warn('Legal identity FNS verification failed', candidate?.id || candidate?.name || '', String(error?.message || error));
    }
  }
  return candidates;
}


async function enrichCandidatesWithDgis(
  candidates,
  city,
  maxCompanies = 10
) {
  if (!process.env.DGIS_API_KEY) {
    return candidates;
  }

  const companies =
    candidates
      .filter(
        candidate =>
          candidate.type === 'company'
      )
      .slice(0, maxCompanies);

  for (const candidate of companies) {
    let externalCandidates = [];

    try {
      externalCandidates =
        await dgisSearch(
          candidate.name,
          city
        );
    } catch {
      continue;
    }

    if (!externalCandidates.length) {
      continue;
    }

    let best = null;

    for (const external of externalCandidates) {
      const match =
        compareCompanyEntities(
          candidate,
          external
        );

      if (
        match.level !==
        'confirmed_match'
      ) {
        continue;
      }

      if (
        !best ||
        match.score > best.match.score
      ) {
        best = {
          external,
          match
        };
      }
    }

    if (!best) {
      continue;
    }

    mergeCandidateData(
      candidate,
      best.external,
      best.match
    );
  }

  return candidates;
}


async function enrichCompanyCandidates(candidates, maxSites=5) {
  const companies = candidates
    .filter(c => c.type === 'company');

  for (const c of companies) {
    c.emailStatus = c.email
      ? 'found'
      : c.website
        ? 'not_crawled'
        : 'no_website';

    c.telegramStatus = c.telegram || c.messenger
      ? 'found'
      : c.website
        ? 'not_crawled'
        : 'no_website';

    c.emailSourceUrl = '';
    c.emailSourceLabel = '';
    c.telegramSourceUrl = '';
    c.telegramSourceLabel = '';
  }

  const targets = companies
    .filter(
      c =>
        isOfficialWebsiteCandidate(
          c.website
        )
    )
    .slice(0, maxSites);

  const targetSet = new Set(targets);

  for (const c of companies) {
    if (
      c.website &&
      !targetSet.has(c) &&
      !c.email
    ) {
      c.emailStatus = 'not_crawled';
    }
  }

  const results = await Promise.allSettled(
    targets.map(async c => ({
      candidate: c,
      crawl: await crawlCompanySite(c.website)
    }))
  );

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;

    const { candidate: c, crawl } = result.value;

    if (!crawl?.ok) {
      if (!c.email) {
        c.emailStatus = 'crawl_failed';
      }

      continue;
    }

    const siteSourceId = `site-${hash(crawl.sourceUrl)}`;

    if (!c.email) {
      c.emailStatus = crawl.emails?.length
        ? 'found'
        : 'not_found';
    }

    if (!c.telegram && !c.messenger) {
      c.telegramStatus = crawl.telegrams?.length
        ? 'found'
        : 'not_found';
    }

    if (
      !(c.sources || []).some(
        x =>
          x.kind === 'official_site' &&
          x.url === crawl.sourceUrl
      )
    ) {
      c.sources.push({
        id: siteSourceId,
        kind: 'official_site',
        label: 'Официальный сайт',
        url: crawl.sourceUrl,
        host: hostOf(crawl.sourceUrl),
        checkedAt: crawl.fetchedAt
      });
    }

    if (crawl.name && crawl.name.length <= 100) {
      c.name = crawl.name;
    }

    if (crawl.phones?.length) {
      c.phone = crawl.phones[0];
      c.phones = crawl.phones;

      c.facts.push({
        status: 'confirmed',
        label: `Телефон: ${crawl.phones[0]}`,
        sourceId: siteSourceId
      });
    }

    if (crawl.emails?.length) {
      c.email = crawl.emails[0];
      c.emails = crawl.emails;
      c.emailStatus = 'found';

      const emailSource =
        (crawl.emailSources || [])
          .find(
            item =>
              item.email ===
              crawl.emails[0]
          );

      c.emailSourceUrl =
        emailSource?.url ||
        crawl.sourceUrl;

      c.emailSourceLabel =
        emailSource?.url
          ? 'Официальный сайт · страница контактов'
          : 'Официальный сайт';

      c.facts.push({
        status: 'confirmed',
        label: `Электронная почта: ${crawl.emails[0]}`,
        sourceId: siteSourceId
      });
    }

    if (crawl.telegrams?.length) {
      c.telegram = crawl.telegrams[0];
      c.telegrams = crawl.telegrams;
      c.telegramStatus = 'found';

      const telegramSource =
        (crawl.telegramSources || [])
          .find(
            item =>
              item.telegram ===
              crawl.telegrams[0]
          );

      c.telegramSourceUrl =
        telegramSource?.url ||
        crawl.sourceUrl;

      c.telegramSourceLabel =
        telegramSource?.url
          ? 'Официальный сайт · Telegram'
          : 'Официальный сайт';

      c.facts.push({
        status: 'confirmed',
        label: `Telegram: ${crawl.telegrams[0]}`,
        sourceId: siteSourceId
      });
    }

    c.legalIdentity =
      crawl.legalIdentity
        ? {
            ...crawl.legalIdentity,

            discoveredVia:
              'crawler',

            verifiedFrom:
              'official_site'
          }
        : null;

    c.claimedExperience =
      crawl.experience
        ? {
            claimedYears:
              crawl.experience.claimedYears ?? null,

            sinceYear:
              crawl.experience.sinceYear ?? null,

            statement:
              crawl.experience.statement || '',

            sourceUrl:
              crawl.experience.sourceUrl ||
              crawl.sourceUrl,

            evidenceType:
              crawl.experience.evidenceType ||
              'official_site_claim',

            confidence:
              crawl.experience.confidence ||
              'explicit',

            pattern:
              crawl.experience.pattern || ''
          }
        : null;

    const factLabels = {
      warranty: 'Гарантия',
      price: 'Цена',
      timing: 'Срок',
      measurement: 'Замер'
    };

    for (const [kind, values] of Object.entries(crawl.facts || {})) {
      for (const value of (values || []).slice(0, 2)) {
        if (!value || value.length > 230) continue;

        c.facts.push({
          status: 'claimed',
          label: `${factLabels[kind] || 'Факт'}: ${value}`,
          sourceId: siteSourceId
        });
      }
    }

    c.facts = c.facts.filter(
      (fact, index, all) =>
        all.findIndex(
          x => x.label === fact.label &&
               x.sourceId === fact.sourceId
        ) === index
    );

    c.crawl = {
      inspectedUrls:
        crawl.inspectedUrls ||
        [crawl.sourceUrl],

      fetchedAt:
        crawl.fetchedAt,

      emailsFound:
        (crawl.emails || []).length,

      phonesFound:
        (crawl.phones || []).length
    };
  }

  return candidates;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;

    if (size > 256 * 1024) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }

    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new Error('BAD_JSON');
  }
}

function stripTransientData(value) {
  if (Array.isArray(value)) {
    return value.map(
      item =>
        stripTransientData(item)
    );
  }

  if (
    value &&
    typeof value === 'object'
  ) {
    const result = {};

    for (
      const [key, item]
      of Object.entries(value)
    ) {
      if (
        key === 'transient' ||
        key === 'yandexMapsLive'
      ) {
        continue;
      }

      result[key] =
        stripTransientData(item);
    }

    return result;
  }

  return value;
}

function saveSearchRun(result, body = {}) {
  const runId =
    crypto.randomUUID();

  const now =
    new Date().toISOString();

  const refinement =
    body.refinement &&
    typeof body.refinement === 'object'
      ? body.refinement
      : {};

  const taskId =
    text(
      body.taskId ||
      body.task_id
    );

  const previousRunId =
    text(
      refinement.previousRunId ||
      refinement.previous_run_id
    );

  const requestMeta = {
    categoryStatus:
      text(
        body.categoryStatus ||
        body.category_status
      ) || 'matched',
    rawService:
      text(
        body.rawService ||
        body.raw_service ||
        body.description ||
        body.scope
      ).slice(0, 1000),
    domain:
      text(body.domain).slice(0, 120),
    suggestedCategory:
      text(
        body.suggestedCategory ||
        body.suggested_category
      ).slice(0, 160),
    region:
      text(body.region).slice(0, 160),
    regionId:
      text(body.regionId || body.region_id).slice(0, 120),
    locality:
      text(body.locality || body.city).slice(0, 160),
    localityId:
      text(body.localityId || body.locality_id).slice(0, 160),
    launchZone:
      text(body.launchZone || body.launch_zone).slice(0, 80)
  };

  db.prepare(`
    INSERT INTO search_runs
      (
        id,
        created_at,
        category_id,
        city,
        executor_preference,
        candidate_count,
        provider_state,
        status,
        error,
        task_id,
        previous_run_id,
        refinement_json
      )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).run(
    runId,
    now,
    result.categoryId,
    result.city,
    result.executorPreference,
    result.candidates.length,
    JSON.stringify(
      result.providers
    ),
    'ok',
    '',
    taskId || null,
    previousRunId || null,
    JSON.stringify({
      ...refinement,
      requestMeta
    })
  );

  for (
    const c of
    result.candidates
  ) {
    db.prepare(`
      INSERT INTO candidates
        (
          run_id,
          candidate_id,
          type,
          name,
          match_level,
          website,
          phone,
          address,
          raw_json
        )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
      runId,
      c.id,
      c.type,
      c.name,
      c.matchLevel,
      c.website || '',
      c.phone || '',
      c.address || '',
      JSON.stringify(
        stripTransientData(c)
      )
    );

    for (
      const source of
      c.sources || []
    ) {
      db.prepare(`
        INSERT INTO candidate_sources
          (
            run_id,
            candidate_id,
            source_type,
            source_name,
            source_url,
            collected_at
          )
        VALUES (
          ?, ?, ?, ?, ?, ?
        )
      `).run(
        runId,
        c.id,
        source.kind || 'web',
        source.label || 'Источник',
        source.url,
        source.checkedAt || now
      );
    }
  }

  return runId;
}

async function performSearch(body) {
  const categoryId =
    text(body.categoryId) || 'universal-home-repair';

  const city = text(body.city).slice(0, 120);

  if (!city) {
    const e = new Error('CITY_REQUIRED');
    e.status = 400;
    throw e;
  }

  const refinement =
    body.refinement &&
    typeof body.refinement === 'object'
      ? body.refinement
      : {};

  const refinementMode =
    text(
      refinement.executorPreference
    );

  const expandRegion =
    refinement.expandRegion === true;

  const reputationStrict =
    refinement.reputationStrict === true;

  const excludeCandidateIds =
    new Set(
      Array.isArray(
        refinement.excludeCandidateIds
      )
        ? refinement.excludeCandidateIds
            .map(text)
            .filter(Boolean)
            .slice(0, 100)
        : []
    );

  const refinementNote =
    text(
      refinement.note
    ).slice(0, 500);

  const requestedSources = new Set(
    Array.isArray(body.sources) && body.sources.length
      ? body.sources.filter(x =>
          ['web', 'yandex_services', 'avito', '2gis'].includes(x)
        )
      : ['web', 'yandex_services', 'avito']
  );

  const requestedTypes = new Set(
    Array.isArray(body.executorTypes) && body.executorTypes.length
      ? body.executorTypes.filter(x =>
          ['company', 'private'].includes(x)
        )
      : ['company', 'private']
  );

  if (
    refinementMode === 'company' ||
    refinementMode === 'private'
  ) {
    requestedTypes.clear();
    requestedTypes.add(
      refinementMode
    );
  }

  if (!requestedSources.size) {
    const e = new Error('SEARCH_SOURCES_REQUIRED');
    e.status = 400;
    throw e;
  }

  if (!requestedTypes.size) {
    const e = new Error('EXECUTOR_TYPES_REQUIRED');
    e.status = 400;
    throw e;
  }

  const allowCompany = requestedTypes.has('company');
  const allowPrivate = requestedTypes.has('private');

  const useWeb = requestedSources.has('web');
  const useYandexServices =
    requestedSources.has('yandex_services');
  const useAvito = requestedSources.has('avito');

  const executorPreference =
    allowCompany && allowPrivate
      ? 'any'
      : allowCompany
        ? 'company'
        : 'private';

  const requestedLimit = Math.max(
    1,
    Math.min(Number(body.limit || 5), 20)
  );

  const searchPlan = {
    /*
     * Search broadly, then spend expensive
     * enrichment only on the strongest pool.
     */
    discoveryLimit: 40,
    qualificationLimit: 20,
    enrichmentLimit: 12,
    shortlistLimit: Math.min(
      requestedLimit,
      5
    )
  };

  const limit =
    searchPlan.shortlistLimit;

  const query = categoryQuery(body);

  const providers = {
    yandexSearch: Boolean(
      process.env.YANDEX_SEARCH_API_KEY &&
      process.env.YANDEX_FOLDER_ID
    ),

    yandexMaps: Boolean(
      process.env.YANDEX_MAPS_API_KEY
    ),

    dgis: Boolean(
      process.env.DGIS_API_KEY
    )
  };

  if (!providers.yandexSearch && !providers.dgis) {
    const e = new Error('SEARCH_NOT_CONFIGURED');
    e.status = 503;
    throw e;
  }

  const jobs = [];

  const expandedRegions =
    expandRegion
      ? [
          'Москва',
          'Московская область'
        ].filter(
          region =>
            lower(region) !==
            lower(city)
        )
      : [];


  if (
    allowCompany &&
    useWeb &&
    providers.yandexSearch
  ) {
    jobs.push(
      yandexSearch(`${query} ${city}`, 'company')
        .catch(() => [])
    );
  }

  if (
    allowPrivate &&
    useYandexServices &&
    providers.yandexSearch
  ) {
    jobs.push(
      yandexSearch(
        `site:uslugi.yandex.ru/profile ${query} ${city}`,
        'private'
      )
    );
  }

  if (
    allowCompany &&
    allowPrivate &&
    useAvito &&
    providers.yandexSearch
  ) {
    jobs.push(
      yandexSearch(
        `site:avito.ru ${query} ${city}`,
        'avito'
      )
    );
  }

  for (
    const expandedRegion of
    expandedRegions
  ) {
    if (
      allowCompany &&
      useWeb &&
      providers.yandexSearch
    ) {
      jobs.push(
        yandexSearch(
          `${query} ${expandedRegion}`,
          'company'
        ).catch(() => [])
      );
    }

    if (
      allowPrivate &&
      useYandexServices &&
      providers.yandexSearch
    ) {
      jobs.push(
        yandexSearch(
          `site:uslugi.yandex.ru/profile ${query} ${expandedRegion}`,
          'private'
        ).catch(() => [])
      );
    }

    if (
      allowCompany &&
      allowPrivate &&
      useAvito &&
      providers.yandexSearch
    ) {
      jobs.push(
        yandexSearch(
          `site:avito.ru ${query} ${expandedRegion}`,
          'avito'
        ).catch(() => [])
      );
    }
  }

  const nested = await Promise.all(jobs);

  let candidates = mergeCandidates(
    nested.flat().filter(Boolean)
  );

  candidates = candidates.filter(c => {
    const kinds = new Set(
      (c.sources || []).map(x => x.kind)
    );

    if (c.type === 'company') {
      if (!allowCompany) return false;

      const fromWeb =
        kinds.has('web_search') ||
        kinds.has('official_site');

      return (
        useWeb &&
        fromWeb
      );
    }

    if (c.type === 'private') {
      return (
        allowPrivate &&
        useYandexServices &&
        kinds.has('yandex_services')
      );
    }

    if (c.type === 'unverified') {
      return (
        allowCompany &&
        allowPrivate &&
        useAvito &&
        kinds.has('avito')
      );
    }

    return false;
  });

  if (
    excludeCandidateIds.size
  ) {
    candidates =
      candidates.filter(
        candidate =>
          !excludeCandidateIds.has(
            String(candidate.id)
          )
      );
  }

  /*
   * SEARCH PIPELINE V2
   *
   * discovery
   * -> preliminary ranking
   * -> qualification pool
   * -> enrichment
   * -> final ranking
   * -> focused shortlist
   */

  const rawDiscoveredCount =
    candidates.length;

  /*
   * Preliminary ranking is used only
   * to decide which candidates enter
   * the bounded discovery pool.
   */

  const categoryEvaluated =
    candidates.map(c =>
      rankCandidate(
        c,
        city,
        query,
        executorPreference,
        categoryId
      )
    );

  const categoryRejectedCount =
    categoryEvaluated.filter(
      c =>
        c.categoryRelevance?.reject
    ).length;

  candidates = categoryEvaluated
    .filter(
      c =>
        !c.categoryRelevance?.reject
    )
    .sort(
      (a, b) =>
        b._score - a._score ||
        b.sources.length - a.sources.length
    )
    .slice(
      0,
      searchPlan.discoveryLimit
    );

  const discoveredCount =
    candidates.length;

  const qualificationPool =
    candidates.slice(
      0,
      searchPlan.qualificationLimit
    );

  const qualifiedCount =
    qualificationPool.length;

  const enrichmentTargets =
    qualificationPool
      .filter(
        c =>
          c.type === 'company' &&
          c.website
      )
      .slice(
        0,
        searchPlan.enrichmentLimit
      );

  const sitesAttemptedCount =
    enrichmentTargets.length;

  candidates =
    await enrichCompanyCandidates(
      qualificationPool,
      sitesAttemptedCount
    );

  /*
   * Trust enrichment runs only after
   * official-site crawling, because
   * domain and phone improve entity matching.
   */
  candidates =
    await enrichCandidatesWithOfficialDomainEvidence(
      candidates,
      5
    );

  candidates =
    await enrichCandidatesWithDomainAge(
      candidates,
      searchPlan.enrichmentLimit
    );

  candidates =
    await enrichCandidatesWithYandexServicesReputation(
      candidates,
      5
    );

  candidates =
    await enrichCandidatesWithYandexReputation(
      candidates,
      city,
      5
    );

  candidates =
    await enrichCandidatesWithYandexMapsReviews(
      candidates,
      5
    );

  candidates =
    await enrichCandidatesWithDgis(
      candidates,
      city,
      searchPlan.enrichmentLimit
    );

  candidates =
    await enrichCandidatesWithLegalIdentityDiscovery(
      candidates,
      city,
      5
    );

  candidates =
    await enrichCandidatesWithFnsProfile(
      candidates,
      5
    );

  const sitesCrawledCount =
    candidates.filter(
      c =>
        c.type === 'company' &&
        c.crawl?.fetchedAt
    ).length;

  const contactsFoundCount =
    candidates.filter(
      c =>
        c.type === 'company' &&
        c.crawl?.fetchedAt &&
        (
          Number(
            c.crawl?.emailsFound || 0
          ) > 0 ||
          Number(
            c.crawl?.phonesFound || 0
          ) > 0
        )
    ).length;

  candidates =
    candidates.map(candidate => ({
      ...candidate,
      trustProfile:
        buildTrustProfile(candidate)
    }));

  /*
   * Re-rank AFTER enrichment.
   * The crawler may have added:
   * - official site provenance
   * - phone
   * - email
   * - confirmed/claimed facts
   * - additional inspected pages
   */

  candidates = candidates
    .map(c =>
      rankCandidate(
        c,
        city,
        query,
        executorPreference,
        categoryId
      )
    )
    .sort(
      (a, b) =>
        b._score - a._score ||
        b.sources.length - a.sources.length
    );

  let reputationStrictApplied =
    false;

  let reputationStrictFallback =
    false;

  if (reputationStrict) {
    const reputationCandidates =
      candidates.filter(
        candidate => {
          const reputationScore =
            Number(
              candidate
                .selectionBreakdown
                ?.reputation || 0
            );

          const reviewsCount =
            Number(
              candidate
                .selectionBreakdown
                ?.reputationDetails
                ?.reviewsCount || 0
            );

          return (
            reputationScore >= 20 ||
            reviewsCount >= 10
          );
        }
      );

    if (reputationCandidates.length) {
      candidates =
        reputationCandidates;

      reputationStrictApplied =
        true;
    } else {
      /*
       * Do not return an empty result merely
       * because the stricter reputation filter
       * found nobody.
       */
      reputationStrictFallback =
        true;
    }
  }

  /*
   * Final shortlist:
   * strictly keep the strongest candidates.
   *
   * We no longer reserve slots by executor type.
   * Diversity can be shown through filters,
   * but it must not displace a stronger candidate.
   */

  candidates =
    candidates
      .filter(
        candidate =>
          candidate._score > 0
      )
      .slice(
        0,
        limit
      );

  const shortlistedCount =
    candidates.length;

  const searchMeta = {
    refinement: {
      active:
        Boolean(
          refinementMode ||
          expandRegion ||
          reputationStrict ||
          excludeCandidateIds.size ||
          refinementNote
        ),

      executorPreference:
        refinementMode || 'any',

      expandRegion,

      reputationStrict,

      reputationStrictApplied,

      reputationStrictFallback,

      excludedCandidates:
        excludeCandidateIds.size,

      note:
        refinementNote
    },

    rawDiscovered:
      rawDiscoveredCount,

    categoryRejected:
      categoryRejectedCount,

    discovered:
      discoveredCount,

    qualified:
      qualifiedCount,

    /*
     * Keep enriched for compatibility.
     * It now means successfully crawled
     * company sites.
     */
    enriched:
      sitesCrawledCount,

    sitesAttempted:
      sitesAttemptedCount,

    sitesCrawled:
      sitesCrawledCount,

    contactsFound:
      contactsFoundCount,

    shortlisted:
      shortlistedCount,

    funnel: {
      /*
       * rawFound may include records that are
       * later rejected or merged during discovery.
       */
      rawFound:
        rawDiscoveredCount,

      relevantFound:
        discoveredCount,

      qualified:
        qualifiedCount,

      deeplyChecked:
        Math.max(
          sitesCrawledCount,
          Math.min(
            qualifiedCount,
            searchPlan.enrichmentLimit
          )
        ),

      selected:
        shortlistedCount
    },

    limits: {
      discovery:
        searchPlan.discoveryLimit,
      qualification:
        searchPlan.qualificationLimit,
      enrichment:
        searchPlan.enrichmentLimit,
      shortlist:
        searchPlan.shortlistLimit
    }
  };

  candidates = candidates.map(
    ({
      _score,
      _taskScore,
      _reputationScore,
      ...publicCandidate
    }) => ({
      ...publicCandidate,

      selectionScore:
        _score,

      facts: [
        ...(publicCandidate.facts || []),
        {
          status: 'unknown',
          label:
            'Минимальный объём заказа, срок старта и окончательная цена требуют запроса исполнителю.'
        }
      ]
    })
  );

  return {
    categoryId,
    city,
    executorPreference,

    selection: {
      sources: [...requestedSources],
      executorTypes: [...requestedTypes]
    },

    providers,
    searchMeta,
    candidates
  };
}


const COMMERCIAL_TARIFFS = Object.freeze({
  find:Object.freeze({id:'find',name:'Подбор',amount:990,currency:'RUB',candidateLimit:5,additionalSearchLimit:1,searchPolicy:'one_additional',capabilities:Object.freeze({canRefineSearch:true,canCompareOffers:true,canFollowUpOffers:true})}),
  choice:Object.freeze({id:'choice',name:'До выбора',amount:2590,currency:'RUB',candidateLimit:15,additionalSearchLimit:null,searchPolicy:'until_task_choice',capabilities:Object.freeze({canRefineSearch:true,canCompareOffers:true,canFollowUpOffers:true})})
});
function basePaymentPlanId(value) {
  return text(value).replace(/_repeat$/, '');
}

function normalizeClientPhone(value) {
  const raw =
    text(value);

  if (!raw) {
    return '';
  }

  const digits =
    raw.replace(/\D+/g, '');

  if (
    digits.length === 11 &&
    digits.startsWith('8')
  ) {
    return `7${digits.slice(1)}`;
  }

  if (
    digits.length === 11 &&
    digits.startsWith('7')
  ) {
    return digits;
  }

  if (digits.length === 10) {
    return `7${digits}`;
  }

  return digits;
}


function normalizeClientEmail(value) {
  return text(value)
    .toLowerCase();
}


function validClientEmail(value) {
  if (!value) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(value);
}


function readRequestJson(req) {
  return new Promise(
    (resolve, reject) => {
      let raw = '';

      req.on(
        'data',
        chunk => {
          raw += chunk;

          if (
            raw.length >
            1024 * 1024
          ) {
            reject(
              new Error(
                'REQUEST_TOO_LARGE'
              )
            );

            req.destroy();
          }
        }
      );

      req.on(
        'end',
        () => {
          if (!raw) {
            resolve({});
            return;
          }

          try {
            resolve(
              JSON.parse(raw)
            );
          } catch {
            reject(
              new Error(
                'INVALID_JSON'
              )
            );
          }
        }
      );

      req.on(
        'error',
        reject
      );
    }
  );
}


function createPublicId(prefix) {
  return (
    prefix +
    '_' +
    crypto
      .randomBytes(10)
      .toString('hex')
  );
}


function getOrCreateClient({
  name,
  phone,
  email,
  preferredContact,
  ymClientId,
  consent
}) {
  const now =
    new Date().toISOString();

  const phoneNormalized =
    normalizeClientPhone(phone);

  const emailNormalized =
    normalizeClientEmail(email);

  let existing =
    null;

  if (phoneNormalized) {
    existing =
      db.prepare(`
        SELECT *
        FROM clients
        WHERE phone_normalized = ?
        ORDER BY created_at ASC
        LIMIT 1
      `).get(
        phoneNormalized
      );
  }

  if (
    !existing &&
    emailNormalized
  ) {
    existing =
      db.prepare(`
        SELECT *
        FROM clients
        WHERE email_normalized = ?
        ORDER BY created_at ASC
        LIMIT 1
      `).get(
        emailNormalized
      );
  }

  if (existing) {
    db.prepare(`
      UPDATE clients
      SET
        name = ?,
        phone = ?,
        phone_normalized = ?,
        email = ?,
        email_normalized = ?,
        preferred_contact = ?,
        ym_client_id = COALESCE(NULLIF(?, ''), ym_client_id),
        consent_personal_data = ?,
        consent_at = CASE
          WHEN ? = 1
            THEN COALESCE(consent_at, ?)
          ELSE consent_at
        END,
        consent_version = CASE
          WHEN ? = 1
            THEN ?
          ELSE consent_version
        END,
        updated_at = ?
      WHERE client_id_crm = ?
    `).run(
      name,
      phone,
      phoneNormalized,
      email || null,
      emailNormalized || null,
      preferredContact || null,
      ymClientId || '',
      consent ? 1 : 0,
      consent ? 1 : 0,
      now,
      consent ? 1 : 0,
      '2026-09-12',
      now,
      existing.client_id_crm
    );

    return existing.client_id_crm;
  }

  const clientId =
    createPublicId(
      'client'
    );

  db.prepare(`
    INSERT INTO clients (
      client_id_crm,
      name,
      phone,
      phone_normalized,
      email,
      email_normalized,
      preferred_contact,
      ym_client_id,
      consent_personal_data,
      consent_at,
      consent_version,
      created_at,
      updated_at
    )
    VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?
    )
  `).run(
    clientId,
    name,
    phone,
    phoneNormalized,
    email || null,
    emailNormalized || null,
    preferredContact || null,
    ymClientId || null,
    consent ? 1 : 0,
    consent ? now : null,
    consent ? '2026-09-12' : null,
    now,
    now
  );

  return clientId;
}


function savePreparedTask({
  task,
  clientIdCrm
}) {
  const now =
    new Date().toISOString();

  const taskId =
    text(task?.id) ||
    createPublicId(
      'task'
    );

  const serviceId =
    text(
      task?.categoryId
    );

  const serviceName =
    text(
      task?.category
    );

  const city =
    text(
      task?.city
    );

  const description =
    text(
      task?.scope ||
      task?.description
    );

  db.prepare(`
    INSERT INTO tasks (
      task_id,
      client_id_crm,
      service_id,
      service_name,
      city,
      description,
      task_json,
      status,
      created_at,
      updated_at
    )
    VALUES (
      ?,?,?,?,?,?,?,?, ?,?
    )
    ON CONFLICT(task_id)
    DO UPDATE SET
      client_id_crm = excluded.client_id_crm,
      service_id = excluded.service_id,
      service_name = excluded.service_name,
      city = excluded.city,
      description = excluded.description,
      task_json = excluded.task_json,
      updated_at = excluded.updated_at
  `).run(
    taskId,
    clientIdCrm,
    serviceId,
    serviceName,
    city || null,
    description || null,
    JSON.stringify(
      task || {}
    ),
    'ready_for_payment',
    now,
    now
  );

  return taskId;
}


function searchOrderEntitlement({
  orderId,
  taskId,
  refinement
}) {
  const hasRefinement =
    refinement &&
    typeof refinement === 'object' &&
    (
      text(
        refinement.executorPreference
      ) ||
      refinement.expandRegion === true ||
      refinement.reputationStrict === true ||
      (
        Array.isArray(
          refinement.excludeCandidateIds
        ) &&
        refinement.excludeCandidateIds.length > 0
      ) ||
      text(refinement.note) ||
      text(refinement.previousRunId)
    );

  /*
   * First search is still allowed while the
   * payment flow is being integrated.
   * Refined/repeated search already requires
   * a real server-side order entitlement.
   */
  if (!hasRefinement) {
    return {
      allowed: true,
      refinement: false,
      order: null,
      tariff: null
    };
  }

  const normalizedOrderId =
    text(orderId);

  if (!normalizedOrderId) {
    const error =
      new Error(
        'ORDER_REQUIRED_FOR_REFINEMENT'
      );

    error.status =
      403;

    throw error;
  }

  const order =
    db.prepare(`
      SELECT
        order_id,
        task_id,
        client_id_crm,
        tariff_id,
        tariff_name,
        amount,
        currency,
        status
      FROM orders
      WHERE order_id = ?
      LIMIT 1
    `).get(
      normalizedOrderId
    );

  if (!order) {
    const error =
      new Error(
        'ORDER_NOT_FOUND'
      );

    error.status =
      403;

    throw error;
  }

  if (
    taskId &&
    order.task_id &&
    String(order.task_id) !==
    String(taskId)
  ) {
    const error =
      new Error(
        'ORDER_TASK_MISMATCH'
      );

    error.status =
      403;

    throw error;
  }

  const tariff =
    COMMERCIAL_TARIFFS[
      order.tariff_id
    ];

  if (
    !tariff ||
    tariff.capabilities
      ?.canRefineSearch !== true
  ) {
    const error =
      new Error(
        'REFINEMENT_NOT_INCLUDED'
      );

    error.status =
      403;

    throw error;
  }

  const completedRefinements=db.prepare(`SELECT COUNT(*) AS n FROM search_runs WHERE task_id=? AND status='ok' AND COALESCE(previous_run_id,'')<>''`).get(taskId)?.n||0;
  if(tariff.additionalSearchLimit!=null&&completedRefinements>=tariff.additionalSearchLimit){const error=new Error('ADDITIONAL_SEARCH_LIMIT_REACHED');error.status=403;throw error;}
  const taskState=db.prepare(`SELECT selected_candidate_id,status FROM tasks WHERE task_id=? LIMIT 1`).get(taskId);
  if(taskState?.selected_candidate_id){const error=new Error('TASK_SELECTION_COMPLETED');error.status=409;throw error;}
  return {
    allowed: true,
    refinement: true,
    order,
    tariff,
    searchBudget:{used:completedRefinements,limit:tariff.additionalSearchLimit,remaining:tariff.additionalSearchLimit==null?null:Math.max(0,tariff.additionalSearchLimit-completedRefinements)}
  };
}


function cancelSelectionFollowups(
  taskId
) {
  const normalizedTaskId =
    text(taskId);

  if (!normalizedTaskId) {
    return;
  }

  const now =
    new Date().toISOString();

  db.prepare(`
    UPDATE client_followups
    SET
      status = 'cancelled',
      cancelled_at = ?,
      updated_at = ?
    WHERE task_id = ?
      AND type = 'selection_check'
      AND status = 'pending'
  `).run(
    now,
    now,
    normalizedTaskId
  );
}


function scheduleSelectionFollowup(
  taskId,
  triggerStage
) {
  const normalizedTaskId =
    text(taskId);

  const stage =
    text(triggerStage);

  if (
    !normalizedTaskId ||
    !stage
  ) {
    return null;
  }

  const task =
    db.prepare(`
      SELECT
        task_id,
        client_id_crm,
        selected_candidate_id
      FROM tasks
      WHERE task_id = ?
      LIMIT 1
    `).get(
      normalizedTaskId
    );

  if (
    !task ||
    task.selected_candidate_id
  ) {
    return null;
  }

  const order =
    db.prepare(`
      SELECT
        tariff_id
      FROM orders
      WHERE task_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(
      normalizedTaskId
    );

  const tariffId =
    text(
      order?.tariff_id
    ) || 'find';

  const shouldSchedule =
    (
      tariffId === 'find' &&
      stage === 'search_completed'
    ) ||
    (
      tariffId === 'choice' &&
      stage === 'comparison_ready'
    );

  if (!shouldSchedule) {
    return null;
  }

  const existing =
    db.prepare(`
      SELECT
        followup_id
      FROM client_followups
      WHERE task_id = ?
        AND type = 'selection_check'
        AND status = 'pending'
      LIMIT 1
    `).get(
      normalizedTaskId
    );

  const now =
    new Date();

  const dueAt =
    new Date(
      now.getTime() +
      24 * 60 * 60 * 1000
    ).toISOString();

  if (existing) {
    db.prepare(`
      UPDATE client_followups
      SET
        trigger_stage = ?,
        due_at = ?,
        updated_at = ?
      WHERE followup_id = ?
    `).run(
      stage,
      dueAt,
      now.toISOString(),
      existing.followup_id
    );

    return existing.followup_id;
  }

  const followupId =
    crypto.randomUUID();

  db.prepare(`
    INSERT INTO client_followups (
      followup_id,
      task_id,
      client_id_crm,
      type,
      trigger_stage,
      due_at,
      status,
      payload_json,
      created_at,
      updated_at
    )
    VALUES (
      ?, ?, ?,
      'selection_check',
      ?, ?,
      'pending',
      '{}',
      ?, ?
    )
  `).run(
    followupId,
    normalizedTaskId,
    task.client_id_crm,
    stage,
    dueAt,
    now.toISOString(),
    now.toISOString()
  );

  return followupId;
}


function schedulePostSelectionFollowups({
  taskId,
  candidateId,
  candidateName
}) {
  const normalizedTaskId =
    text(taskId);

  const normalizedCandidateId =
    text(candidateId);

  const normalizedCandidateName =
    text(candidateName);

  if (
    !normalizedTaskId ||
    !normalizedCandidateId
  ) {
    return [];
  }

  const task =
    db.prepare(`
      SELECT
        task_id,
        client_id_crm
      FROM tasks
      WHERE task_id = ?
      LIMIT 1
    `).get(
      normalizedTaskId
    );

  if (!task) {
    return [];
  }

  const now =
    new Date();

  const definitions = [
    {
      type:
        'service_feedback_after_selection',

      delayMs:
        3 * 60 * 60 * 1000
    },

    {
      type:
        'contractor_status_check',

      delayMs:
        7 * 24 * 60 * 60 * 1000
    }
  ];

  const result = [];

  for (
    const definition
    of definitions
  ) {
    const dueAt =
      new Date(
        now.getTime() +
        definition.delayMs
      ).toISOString();

    const payload =
      JSON.stringify({
        candidate_id:
          normalizedCandidateId,

        candidate_name:
          normalizedCandidateName ||
          null
      });

    /*
     * Do not create a second pending
     * follow-up of the same type.
     *
     * If the user changes contractor,
     * move the existing pending follow-up
     * to the newly selected contractor.
     */
    const existing =
      db.prepare(`
        SELECT
          followup_id
        FROM client_followups
        WHERE task_id = ?
          AND type = ?
          AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
      `).get(
        normalizedTaskId,
        definition.type
      );

    if (existing) {
      db.prepare(`
        UPDATE client_followups
        SET
          trigger_stage =
            'contractor_selected',

          due_at = ?,

          payload_json = ?,

          updated_at = ?

        WHERE followup_id = ?
      `).run(
        dueAt,
        payload,
        now.toISOString(),
        existing.followup_id
      );

      result.push(
        existing.followup_id
      );

      continue;
    }

    /*
     * Service feedback should only be
     * requested once for a task if the
     * user has already completed it.
     */
    if (
      definition.type ===
        'service_feedback_after_selection'
    ) {
      const completed =
        db.prepare(`
          SELECT
            followup_id
          FROM client_followups
          WHERE task_id = ?
            AND type = ?
            AND status = 'completed'
          LIMIT 1
        `).get(
          normalizedTaskId,
          definition.type
        );

      if (completed) {
        continue;
      }
    }

    const followupId =
      crypto.randomUUID();

    db.prepare(`
      INSERT INTO client_followups (
        followup_id,
        task_id,
        client_id_crm,
        type,
        trigger_stage,
        due_at,
        status,
        payload_json,
        created_at,
        updated_at
      )
      VALUES (
        ?, ?, ?,
        ?,
        'contractor_selected',
        ?,
        'pending',
        ?,
        ?, ?
      )
    `).run(
      followupId,
      normalizedTaskId,
      task.client_id_crm,
      definition.type,
      dueAt,
      payload,
      now.toISOString(),
      now.toISOString()
    );

    result.push(
      followupId
    );
  }

  return result;
}


function selectTaskContractor({
  taskId,
  candidateId,
  candidateName
}) {
  const normalizedTaskId =
    text(taskId);

  const normalizedCandidateId =
    text(candidateId);

  const normalizedCandidateName =
    text(candidateName);

  if (
    !normalizedTaskId ||
    !normalizedCandidateId ||
    !normalizedCandidateName
  ) {
    const error =
      new Error(
        'CONTRACTOR_SELECTION_INVALID'
      );

    error.statusCode = 400;
    throw error;
  }

  const task =
    db.prepare(`
      SELECT
        task_id,
        client_id_crm
      FROM tasks
      WHERE task_id = ?
      LIMIT 1
    `).get(
      normalizedTaskId
    );

  if (!task) {
    const error =
      new Error(
        'TASK_NOT_FOUND'
      );

    error.statusCode = 404;
    throw error;
  }

  /*
   * Candidate must actually belong to
   * one of this task's search runs.
   */
  const candidate =
    db.prepare(`
      SELECT
        c.candidate_id,
        c.name
      FROM candidates c
      INNER JOIN search_runs sr
        ON sr.id = c.run_id
      WHERE sr.task_id = ?
        AND c.candidate_id = ?
      ORDER BY sr.created_at DESC
      LIMIT 1
    `).get(
      normalizedTaskId,
      normalizedCandidateId
    );

  if (!candidate) {
    const error =
      new Error(
        'CANDIDATE_NOT_IN_TASK'
      );

    error.statusCode = 400;
    throw error;
  }

  const now =
    new Date().toISOString();

  db.exec(
    'BEGIN IMMEDIATE'
  );

  try {
    db.prepare(`
      UPDATE tasks
      SET
        selected_candidate_id = ?,
        selected_candidate_name = ?,
        last_completed_stage = 'contractor_selected',
        status = 'contractor_selected',
        exit_stage = NULL,
        updated_at = ?
      WHERE task_id = ?
    `).run(
      candidate.candidate_id,
      candidate.name ||
        normalizedCandidateName,
      now,
      normalizedTaskId
    );

    cancelSelectionFollowups(
      normalizedTaskId
    );

    schedulePostSelectionFollowups({
      taskId:
        normalizedTaskId,

      candidateId:
        candidate.candidate_id,

      candidateName:
        candidate.name ||
        normalizedCandidateName
    });

    db.exec(
      'COMMIT'
    );

  } catch (error) {
    db.exec(
      'ROLLBACK'
    );

    throw error;
  }

  return {
    taskId:
      normalizedTaskId,

    candidateId:
      candidate.candidate_id,

    candidateName:
      candidate.name ||
      normalizedCandidateName,

    selectedAt:
      now
  };
}


function updateTaskLifecycle(
  taskId,
  stage,
  {
    status = null,
    exitStage = undefined,
    feedbackStatus = undefined,
    completedAt = undefined
  } = {}
) {
  const normalizedTaskId =
    text(taskId);

  const normalizedStage =
    text(stage);

  if (
    !normalizedTaskId ||
    !normalizedStage
  ) {
    return;
  }

  const now =
    new Date().toISOString();

  const current =
    db.prepare(`
      SELECT
        task_id
      FROM tasks
      WHERE task_id = ?
      LIMIT 1
    `).get(
      normalizedTaskId
    );

  if (!current) {
    return;
  }

  const fields = [
    'last_completed_stage = ?',
    'updated_at = ?'
  ];

  const values = [
    normalizedStage,
    now
  ];

  if (status != null) {
    fields.push(
      'status = ?'
    );

    values.push(
      text(status)
    );
  }

  if (exitStage !== undefined) {
    fields.push(
      'exit_stage = ?'
    );

    values.push(
      exitStage == null
        ? null
        : text(exitStage)
    );
  }

  if (feedbackStatus !== undefined) {
    fields.push(
      'feedback_status = ?'
    );

    values.push(
      feedbackStatus == null
        ? null
        : text(feedbackStatus)
    );
  }

  if (completedAt !== undefined) {
    fields.push(
      'completed_at = ?'
    );

    values.push(
      completedAt == null
        ? null
        : text(completedAt)
    );
  }

  values.push(
    normalizedTaskId
  );

  db.prepare(`
    UPDATE tasks
    SET ${fields.join(', ')}
    WHERE task_id = ?
  `).run(
    ...values
  );
}


function createPreparedOrder({
  taskId,
  clientIdCrm,
  tariffId,
  ymClientId,
  attribution
}) {
  const tariff =
    COMMERCIAL_TARIFFS[
      tariffId
    ];

  if (!tariff) {
    const error =
      new Error(
        'UNKNOWN_TARIFF'
      );

    error.statusCode =
      400;

    throw error;
  }

  const now =
    new Date().toISOString();

  const existingOrder =
    db.prepare(`
      SELECT
        order_id,
        tariff_id,
        tariff_name,
        amount,
        currency,
        status,
        created_at
      FROM orders
      WHERE task_id = ?
        AND client_id_crm = ?
        AND tariff_id = ?
        AND status = 'awaiting_payment'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(
      taskId,
      clientIdCrm,
      tariff.id
    );

  if (existingOrder) {
    return {
      orderId:
        existingOrder.order_id,

      tariff,

      reused:
        true
    };
  }

  const orderId =
    createPublicId(
      'order'
    );

  db.prepare(`
    INSERT INTO orders (
      order_id,
      task_id,
      client_id_crm,
      tariff_id,
      tariff_name,
      amount,
      currency,
      status,
      ym_client_id,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      yclid,
      ysclid,
      gclid,
      referrer,
      landing_page,
      created_at,
      updated_at
    )
    VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    )
  `).run(
    orderId,
    taskId,
    clientIdCrm,
    tariff.id,
    tariff.name,
    tariff.amount,
    tariff.currency,
    'awaiting_payment',
    ymClientId || null,
    text(
      attribution?.utm_source
    ) || null,
    text(
      attribution?.utm_medium
    ) || null,
    text(
      attribution?.utm_campaign
    ) || null,
    text(
      attribution?.utm_content
    ) || null,
    text(
      attribution?.utm_term
    ) || null,
    text(
      attribution?.yclid
    ) || null,
    text(
      attribution?.ysclid
    ) || null,
    text(
      attribution?.gclid
    ) || null,
    text(
      attribution?.referrer
    ) || null,
    text(
      attribution?.landing_page
    ) || null,
    now,
    now
  );

  return {
    orderId,
    tariff
  };
}


function saveTaskNotificationPreferences({
  taskId,
  clientIdCrm,
  notifications
}) {
  const source =
    notifications &&
    typeof notifications === 'object'
      ? notifications
      : {};

  const bool = (
    key,
    fallback
  ) =>
    source[key] === undefined
      ? fallback
      : source[key] === true;

  const now =
    new Date().toISOString();

  const values = {
    emailEnabled:
      bool(
        'email_enabled',
        true
      ),

    telegramEnabled:
      bool(
        'telegram_enabled',
        false
      ),

    selectionReady:
      bool(
        'telegram_selection_ready',
        true
      ),

    outreachSent:
      bool(
        'telegram_outreach_sent',
        true
      ),

    replyReceived:
      bool(
        'telegram_reply_received',
        true
      ),

    waitingReplies:
      bool(
        'telegram_waiting_replies',
        false
      ),

    comparisonReady:
      bool(
        'telegram_comparison_ready',
        true
      ),

    actionRequired:
      bool(
        'telegram_action_required',
        true
      ),

    taskSummary:
      bool(
        'telegram_task_summary',
        true
      )
  };

  db.prepare(`
    INSERT INTO task_notification_preferences (
      task_id,
      client_id_crm,
      email_enabled,
      telegram_enabled,
      telegram_selection_ready,
      telegram_outreach_sent,
      telegram_reply_received,
      telegram_waiting_replies,
      telegram_comparison_ready,
      telegram_action_required,
      telegram_task_summary,
      created_at,
      updated_at
    )
    VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?
    )
    ON CONFLICT(task_id)
    DO UPDATE SET
      client_id_crm = excluded.client_id_crm,
      email_enabled = excluded.email_enabled,
      telegram_enabled = excluded.telegram_enabled,
      telegram_selection_ready = excluded.telegram_selection_ready,
      telegram_outreach_sent = excluded.telegram_outreach_sent,
      telegram_reply_received = excluded.telegram_reply_received,
      telegram_waiting_replies = excluded.telegram_waiting_replies,
      telegram_comparison_ready = excluded.telegram_comparison_ready,
      telegram_action_required = excluded.telegram_action_required,
      telegram_task_summary = excluded.telegram_task_summary,
      updated_at = excluded.updated_at
  `).run(
    taskId,
    clientIdCrm,
    values.emailEnabled ? 1 : 0,
    values.telegramEnabled ? 1 : 0,
    values.selectionReady ? 1 : 0,
    values.outreachSent ? 1 : 0,
    values.replyReceived ? 1 : 0,
    values.waitingReplies ? 1 : 0,
    values.comparisonReady ? 1 : 0,
    values.actionRequired ? 1 : 0,
    values.taskSummary ? 1 : 0,
    now,
    now
  );

  return values;
}



async function sendTelegramMessage(
  chatId,
  message,
  {
    replyMarkup = null
  } = {}
) {
  if (
    !TELEGRAM_GATEWAY_URL ||
    !TELEGRAM_GATEWAY_SECRET ||
    !chatId
  ) {
    return false;
  }

  const response =
    await fetch(
      `${TELEGRAM_GATEWAY_URL}/telegram/send`,
      {
        method: 'POST',

        headers: {
          'content-type':
            'application/json',

          'x-sdelaet-gateway-secret':
            TELEGRAM_GATEWAY_SECRET
        },

        body:
          JSON.stringify({
            chat_id:
              String(chatId),

            text:
              String(message || ''),

            disable_web_page_preview:
              true,

            ...(replyMarkup &&
            typeof replyMarkup ===
              'object'
              ? {
                  reply_markup:
                    replyMarkup
                }
              : {})
          })
      }
    );

  const data =
    await response
      .json()
      .catch(
        () => ({})
      );

  if (
    !response.ok ||
    data.ok !== true
  ) {
    throw new Error(
      data.error ||
      'TELEGRAM_GATEWAY_SEND_FAILED'
    );
  }

  return true;
}


async function editTelegramMessage(
  chatId,
  messageId,
  message,
  {
    replyMarkup = null
  } = {}
) {
  if (
    !TELEGRAM_GATEWAY_URL ||
    !TELEGRAM_GATEWAY_SECRET ||
    !chatId ||
    !messageId
  ) {
    return false;
  }

  const response =
    await fetch(
      `${TELEGRAM_GATEWAY_URL}/telegram/message/edit`,
      {
        method: 'POST',

        headers: {
          'content-type':
            'application/json',

          'x-sdelaet-gateway-secret':
            TELEGRAM_GATEWAY_SECRET
        },

        body:
          JSON.stringify({
            chat_id:
              String(chatId),

            message_id:
              Number(messageId),

            text:
              String(message || ''),

            disable_web_page_preview:
              true,

            ...(replyMarkup &&
            typeof replyMarkup ===
              'object'
              ? {
                  reply_markup:
                    replyMarkup
                }
              : {})
          })
      }
    );

  const data =
    await response
      .json()
      .catch(
        () => ({})
      );

  if (
    !response.ok ||
    data.ok !== true
  ) {
    throw new Error(
      data.error ||
      'TELEGRAM_MESSAGE_EDIT_FAILED'
    );
  }

  return true;
}


async function answerTelegramCallback(
  callbackQueryId,
  message = ''
) {
  if (
    !TELEGRAM_GATEWAY_URL ||
    !TELEGRAM_GATEWAY_SECRET ||
    !callbackQueryId
  ) {
    return false;
  }

  const response =
    await fetch(
      `${TELEGRAM_GATEWAY_URL}/telegram/callback/answer`,
      {
        method: 'POST',

        headers: {
          'content-type':
            'application/json',

          'x-sdelaet-gateway-secret':
            TELEGRAM_GATEWAY_SECRET
        },

        body:
          JSON.stringify({
            callback_query_id:
              String(
                callbackQueryId
              ),

            ...(message
              ? {
                  text:
                    String(message)
                }
              : {})
          })
      }
    );

  const data =
    await response
      .json()
      .catch(
        () => ({})
      );

  if (
    !response.ok ||
    data.ok !== true
  ) {
    throw new Error(
      data.error ||
      'TELEGRAM_CALLBACK_ANSWER_FAILED'
    );
  }

  return true;
}


function saveTelegramBusinessConnection(
  connection
) {
  if (
    !connection ||
    typeof connection !== 'object'
  ) {
    return {
      ok: true,
      ignored: true
    };
  }

  const connectionId =
    text(
      connection.id
    );

  const userChatId =
    text(
      connection.user_chat_id
    );

  if (!connectionId) {
    return {
      ok: true,
      ignored: true
    };
  }

  const user =
    connection.user &&
    typeof connection.user === 'object'
      ? connection.user
      : {};

  const allowedBusinessUserId =
    text(
      process.env
        .TELEGRAM_ALLOWED_BUSINESS_USER_ID
    );

  const businessUserId =
    text(
      user.id
    );

  if (
    !allowedBusinessUserId ||
    !businessUserId ||
    businessUserId !==
      allowedBusinessUserId
  ) {
    return {
      ok: true,
      ignored: true,
      reason:
        'BUSINESS_USER_NOT_ALLOWED'
    };
  }

  const rights =
    connection.rights &&
    typeof connection.rights === 'object'
      ? connection.rights
      : {};

  /*
   * We already know the Telegram chat ID
   * of clients who connected notifications.
   * BusinessConnection.user_chat_id allows
   * us to bind the Business connection to
   * the same CRM client automatically.
   */
  const client =
    userChatId
      ? db.prepare(`
          SELECT
            client_id_crm
          FROM clients
          WHERE telegram_chat_id = ?
          LIMIT 1
        `).get(
          userChatId
        )
      : null;

  const now =
    new Date().toISOString();

  const isEnabled =
    connection.is_enabled === true;

  const canReply =
    rights.can_reply === true;

  /*
   * Keep this separately even if Telegram
   * changes/extends its Business rights.
   */
  const canReadMessages =
    rights.can_read_messages === true;

  db.prepare(`
    INSERT INTO telegram_business_connections (
      connection_id,
      client_id_crm,
      telegram_user_id,
      user_chat_id,
      username,
      first_name,
      last_name,
      can_reply,
      can_read_messages,
      is_enabled,
      connected_at,
      updated_at,
      raw_json
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(connection_id)
    DO UPDATE SET
      client_id_crm =
        COALESCE(
          excluded.client_id_crm,
          telegram_business_connections.client_id_crm
        ),
      telegram_user_id =
        excluded.telegram_user_id,
      user_chat_id =
        excluded.user_chat_id,
      username =
        excluded.username,
      first_name =
        excluded.first_name,
      last_name =
        excluded.last_name,
      can_reply =
        excluded.can_reply,
      can_read_messages =
        excluded.can_read_messages,
      is_enabled =
        excluded.is_enabled,
      updated_at =
        excluded.updated_at,
      raw_json =
        excluded.raw_json
  `).run(
    connectionId,
    client?.client_id_crm || null,

    text(user.id) || null,
    userChatId || null,

    text(user.username) || null,
    text(user.first_name) || null,
    text(user.last_name) || null,

    canReply ? 1 : 0,
    canReadMessages ? 1 : 0,
    isEnabled ? 1 : 0,

    isEnabled
      ? now
      : null,

    now,

    JSON.stringify(
      connection
    )
  );

  return {
    ok: true,
    business_connection: true,

    connection_id:
      connectionId,

    client_id_crm:
      client?.client_id_crm ||
      null,

    is_enabled:
      isEnabled,

    can_reply:
      canReply
  };
}


function saveTelegramBusinessMessage(
  message,
  updateType =
    'business_message'
) {
  if (
    !message ||
    typeof message !== 'object'
  ) {
    return {
      ok: true,
      ignored: true
    };
  }

  const connectionId =
    text(
      message.business_connection_id
    );

  const chatId =
    text(
      message.chat?.id
    );

  const messageId =
    text(
      message.message_id
    );

  if (
    !connectionId ||
    !chatId ||
    !messageId
  ) {
    return {
      ok: true,
      ignored: true
    };
  }

  const connection =
    db.prepare(`
      SELECT
        client_id_crm,
        telegram_user_id
      FROM telegram_business_connections
      WHERE connection_id = ?
      LIMIT 1
    `).get(
      connectionId
    );

  const allowedBusinessUserId =
    text(
      process.env
        .TELEGRAM_ALLOWED_BUSINESS_USER_ID
    );

  if (
    !allowedBusinessUserId ||
    !connection ||
    String(
      connection.telegram_user_id || ''
    ) !== String(
      allowedBusinessUserId
    )
  ) {
    return {
      ok: true,
      ignored: true,
      reason:
        'BUSINESS_CONNECTION_NOT_ALLOWED'
    };
  }

  const fromUserId =
    text(
      message.from?.id
    );

  const direction =
    connection?.telegram_user_id &&
    String(
      connection.telegram_user_id
    ) === String(
      fromUserId
    )
      ? 'outbound'
      : 'inbound';

  const now =
    new Date().toISOString();

  const telegramDate =
    Number(
      message.date
    );

  const messageDate =
    Number.isFinite(
      telegramDate
    ) &&
    telegramDate > 0
      ? new Date(
          telegramDate * 1000
        ).toISOString()
      : null;

  db.prepare(`
    INSERT INTO telegram_business_messages (
      connection_id,
      chat_id,
      message_id,
      task_id,
      candidate_id,
      direction,
      from_user_id,
      from_username,
      message_text,
      message_date,
      status,
      ai_status,
      created_at,
      updated_at,
      raw_json
    )
    VALUES (
      ?, ?, ?,
      NULL,
      NULL,
      ?, ?, ?, ?, ?,
      'received',
      'pending',
      ?, ?, ?
    )
    ON CONFLICT(
      connection_id,
      chat_id,
      message_id
    )
    DO UPDATE SET
      direction =
        excluded.direction,
      from_user_id =
        excluded.from_user_id,
      from_username =
        excluded.from_username,
      message_text =
        excluded.message_text,
      message_date =
        excluded.message_date,
      updated_at =
        excluded.updated_at,
      raw_json =
        excluded.raw_json
  `).run(
    connectionId,
    chatId,
    messageId,

    direction,

    fromUserId || null,

    text(
      message.from?.username
    ) || null,

    text(
      message.text ||
      message.caption
    ) || null,

    messageDate,

    now,
    now,

    JSON.stringify({
      update_type:
        updateType,

      message
    })
  );

  return {
    ok: true,
    business_message: true,

    connection_id:
      connectionId,

    chat_id:
      chatId,

    message_id:
      messageId,

    direction,

    client_id_crm:
      connection?.client_id_crm ||
      null
  };
}


async function handleContractorReviewRecommendationCallback(
  callbackQuery
) {
  const callbackId =
    text(
      callbackQuery?.id
    );

  const chatId =
    text(
      callbackQuery?.message?.chat?.id
    );

  const messageId =
    callbackQuery?.message?.message_id;

  const data =
    text(
      callbackQuery?.data
    );

  const match =
    data.match(
      /^crr:([^:]+):(yes|maybe|no)$/
    );

  if (
    !callbackId ||
    !chatId ||
    !match
  ) {
    return {
      ok: true,
      ignored: true
    };
  }

  const reviewId =
    match[1];

  const recommendation =
    match[2];

  const review =
    db.prepare(`
      SELECT
        r.review_id,
        r.client_id_crm,
        r.status,

        c.telegram_chat_id

      FROM contractor_reviews r

      INNER JOIN clients c
        ON c.client_id_crm =
           r.client_id_crm

      WHERE r.review_id = ?
      LIMIT 1
    `).get(
      reviewId
    );

  if (
    !review ||
    String(
      review.telegram_chat_id || ''
    ) !== String(
      chatId
    )
  ) {
    await answerTelegramCallback(
      callbackId,
      'Отзыв уже не актуален.'
    );

    return {
      ok: true,
      ignored: true
    };
  }

  const now =
    new Date().toISOString();

  db.prepare(`
    UPDATE contractor_reviews
    SET
      recommendation = ?,
      status =
        'recommendation_received',
      updated_at = ?
    WHERE review_id = ?
  `).run(
    recommendation,
    now,
    reviewId
  );

  const labels = {
    yes:
      'Да',

    maybe:
      'Возможно',

    no:
      'Нет'
  };

  await answerTelegramCallback(
    callbackId,
    'Ответ сохранён.'
  );

  const originalMessage =
    text(
      callbackQuery?.message?.text
    );

  if (
    messageId &&
    originalMessage
  ) {
    await editTelegramMessage(
      chatId,
      messageId,
      `${originalMessage}\n\n✓ ${labels[recommendation]}`,
      {
        replyMarkup: {
          inline_keyboard: []
        }
      }
    );
  }

  await sendTelegramMessage(
    chatId,
    [
      'Расскажите, как всё прошло.',
      '',
      'Что понравилось, а что можно было сделать лучше?',
      '',
      'Можно ответить одним сообщением.'
    ].join('\n')
  );

  return {
    ok: true,
    contractor_review_recommendation:
      true,
    review_id:
      reviewId,
    recommendation
  };
}


async function handleContractorReviewPhotoCallback(
  callbackQuery
) {
  const callbackId =
    text(
      callbackQuery?.id
    );

  const chatId =
    text(
      callbackQuery?.message?.chat?.id
    );

  const messageId =
    callbackQuery?.message?.message_id;

  const data =
    text(
      callbackQuery?.data
    );

  const match =
    data.match(
      /^crphoto:([^:]+):skip$/
    );

  if (
    !callbackId ||
    !chatId ||
    !match
  ) {
    return {
      ok: true,
      ignored: true
    };
  }

  const reviewId =
    match[1];

  const review =
    db.prepare(`
      SELECT
        r.review_id,
        r.client_id_crm,

        c.telegram_chat_id

      FROM contractor_reviews r

      INNER JOIN clients c
        ON c.client_id_crm =
           r.client_id_crm

      WHERE r.review_id = ?
      LIMIT 1
    `).get(
      reviewId
    );

  if (
    !review ||
    String(
      review.telegram_chat_id || ''
    ) !== String(
      chatId
    )
  ) {
    return {
      ok: true,
      ignored: true
    };
  }

  const now =
    new Date().toISOString();

  db.prepare(`
    UPDATE contractor_reviews
    SET
      status =
        'awaiting_public_consent',
      updated_at = ?
    WHERE review_id = ?
  `).run(
    now,
    reviewId
  );

  await answerTelegramCallback(
    callbackId,
    'Фото можно добавить позже.'
  );

  const originalMessage =
    text(
      callbackQuery?.message?.text
    );

  if (
    messageId &&
    originalMessage
  ) {
    await editTelegramMessage(
      chatId,
      messageId,
      `${originalMessage}\n\n✓ Без фото`,
      {
        replyMarkup: {
          inline_keyboard: []
        }
      }
    );
  }

  await sendTelegramMessage(
    chatId,
    'Можно ли опубликовать ваш отзыв в «Сделает»?',
    {
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text:
                '✅ Да, можно',

              callback_data:
                `crpub:${reviewId}:yes`
            }
          ],

          [
            {
              text:
                'Нет, только для сервиса',

              callback_data:
                `crpub:${reviewId}:no`
            }
          ]
        ]
      }
    }
  );

  return {
    ok: true,
    contractor_review_photo_skip:
      true
  };
}


async function handleContractorReviewPublicConsentCallback(
  callbackQuery
) {
  const callbackId =
    text(
      callbackQuery?.id
    );

  const chatId =
    text(
      callbackQuery?.message?.chat?.id
    );

  const messageId =
    callbackQuery?.message?.message_id;

  const data =
    text(
      callbackQuery?.data
    );

  const match =
    data.match(
      /^crpub:([^:]+):(yes|no)$/
    );

  if (
    !callbackId ||
    !chatId ||
    !match
  ) {
    return {
      ok: true,
      ignored: true
    };
  }

  const reviewId =
    match[1];

  const consent =
    match[2] === 'yes';

  const review =
    db.prepare(`
      SELECT
        r.review_id,
        r.client_id_crm,

        c.telegram_chat_id

      FROM contractor_reviews r

      INNER JOIN clients c
        ON c.client_id_crm =
           r.client_id_crm

      WHERE r.review_id = ?
      LIMIT 1
    `).get(
      reviewId
    );

  if (
    !review ||
    String(
      review.telegram_chat_id || ''
    ) !== String(
      chatId
    )
  ) {
    return {
      ok: true,
      ignored: true
    };
  }

  const now =
    new Date().toISOString();

  db.prepare(`
    UPDATE contractor_reviews
    SET
      public_consent = ?,
      status = 'completed',
      completed_at = ?,
      updated_at = ?
    WHERE review_id = ?
  `).run(
    consent ? 1 : 0,
    now,
    now,
    reviewId
  );

  await answerTelegramCallback(
    callbackId,
    'Спасибо.'
  );

  const originalMessage =
    text(
      callbackQuery?.message?.text
    );

  if (
    messageId &&
    originalMessage
  ) {
    await editTelegramMessage(
      chatId,
      messageId,
      `${originalMessage}\n\n${
        consent
          ? '✓ Публикация разрешена'
          : '✓ Только для сервиса'
      }`,
      {
        replyMarkup: {
          inline_keyboard: []
        }
      }
    );
  }

  await sendTelegramMessage(
    chatId,
    [
      'Спасибо за отзыв.',
      '',
      'Он поможет нам точнее оценивать исполнителей и улучшать подбор.'
    ].join('\n')
  );

  return {
    ok: true,
    contractor_review_completed:
      true,
    public_consent:
      consent
  };
}


async function handleContractorReviewPriceMatchCallback(
  callbackQuery
) {
  const callbackId =
    text(
      callbackQuery?.id
    );

  const chatId =
    text(
      callbackQuery?.message?.chat?.id
    );

  const messageId =
    callbackQuery?.message?.message_id;

  const data =
    text(
      callbackQuery?.data
    );

  const match =
    data.match(
      /^crp:([^:]+):(matched|slightly_higher|much_higher|lower|not_quoted)$/
    );

  if (
    !callbackId ||
    !chatId ||
    !match
  ) {
    return {
      ok: true,
      ignored: true
    };
  }

  const reviewId =
    match[1];

  const priceMatch =
    match[2];

  const review =
    db.prepare(`
      SELECT
        r.review_id,
        r.client_id_crm,
        r.status,

        c.telegram_chat_id

      FROM contractor_reviews r

      INNER JOIN clients c
        ON c.client_id_crm =
           r.client_id_crm

      WHERE r.review_id = ?
      LIMIT 1
    `).get(
      reviewId
    );

  if (
    !review ||
    String(
      review.telegram_chat_id || ''
    ) !== String(
      chatId
    )
  ) {
    await answerTelegramCallback(
      callbackId,
      'Отзыв уже не актуален.'
    );

    return {
      ok: true,
      ignored: true
    };
  }

  const now =
    new Date().toISOString();

  db.prepare(`
    UPDATE contractor_reviews
    SET
      price_match = ?,
      status =
        'price_match_received',
      updated_at = ?
    WHERE review_id = ?
  `).run(
    priceMatch,
    now,
    reviewId
  );

  const labels = {
    matched:
      'Да, совпала',

    slightly_higher:
      'Немного выше',

    much_higher:
      'Заметно выше',

    lower:
      'Получилось дешевле',

    not_quoted:
      'Точную сумму заранее не называли'
  };

  await answerTelegramCallback(
    callbackId,
    'Ответ сохранён.'
  );

  const originalMessage =
    text(
      callbackQuery?.message?.text
    );

  if (
    messageId &&
    originalMessage
  ) {
    await editTelegramMessage(
      chatId,
      messageId,
      `${originalMessage}\n\n✓ ${labels[priceMatch]}`,
      {
        replyMarkup: {
          inline_keyboard: []
        }
      }
    );
  }

  await sendTelegramMessage(
    chatId,
    [
      'Порекомендовали бы вы этого исполнителя другим?'
    ].join('\n'),
    {
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text:
                '👍 Да',

              callback_data:
                `crr:${reviewId}:yes`
            },

            {
              text:
                '🤔 Возможно',

              callback_data:
                `crr:${reviewId}:maybe`
            },

            {
              text:
                '👎 Нет',

              callback_data:
                `crr:${reviewId}:no`
            }
          ]
        ]
      }
    }
  );

  return {
    ok: true,
    contractor_review_price_match:
      true,
    review_id:
      reviewId,
    price_match:
      priceMatch
  };
}


async function handleContractorReviewCompletionCallback(
  callbackQuery
) {
  const callbackId =
    text(
      callbackQuery?.id
    );

  const chatId =
    text(
      callbackQuery?.message?.chat?.id
    );

  const messageId =
    callbackQuery?.message?.message_id;

  const data =
    text(
      callbackQuery?.data
    );

  const match =
    data.match(
      /^crc:([^:]+):(all|partial|no)$/
    );

  if (
    !callbackId ||
    !chatId ||
    !match
  ) {
    return {
      ok: true,
      ignored: true
    };
  }

  const reviewId =
    match[1];

  const completion =
    match[2];

  const review =
    db.prepare(`
      SELECT
        r.review_id,
        r.task_id,
        r.client_id_crm,
        r.candidate_id,
        r.candidate_name,
        r.rating,
        r.completion_status,
        r.status,

        c.telegram_chat_id,
        c.name AS client_name

      FROM contractor_reviews r

      INNER JOIN clients c
        ON c.client_id_crm =
           r.client_id_crm

      WHERE r.review_id = ?
      LIMIT 1
    `).get(
      reviewId
    );

  if (
    !review ||
    String(
      review.telegram_chat_id || ''
    ) !== String(
      chatId
    )
  ) {
    await answerTelegramCallback(
      callbackId,
      'Отзыв уже не актуален.'
    );

    return {
      ok: true,
      ignored: true
    };
  }

  /*
   * This callback may be delivered more
   * than once by Telegram.
   */
  if (
    review.status !==
      'rating_received'
  ) {
    await answerTelegramCallback(
      callbackId,
      'Ответ уже сохранён.'
    );

    return {
      ok: true,
      already_completed: true,
      review_id:
        review.review_id
    };
  }

  const now =
    new Date().toISOString();

  let recoveryCaseId =
    null;

  db.exec(
    'BEGIN IMMEDIATE'
  );

  try {
    db.prepare(`
      UPDATE contractor_reviews
      SET
        completion_status = ?,
        status =
          'completion_received',
        updated_at = ?
      WHERE review_id = ?
    `).run(
      completion,
      now,
      reviewId
    );

    if (
      completion === 'partial' ||
      completion === 'no'
    ) {
      const existingRecovery =
        db.prepare(`
          SELECT
            case_id
          FROM service_recovery_cases
          WHERE task_id = ?
            AND source =
              'contractor_review'
            AND status NOT IN (
              'resolved',
              'closed'
            )
          ORDER BY created_at DESC
          LIMIT 1
        `).get(
          review.task_id
        );

      const problemLevel =
        completion === 'no'
          ? 'problem'
          : 'partial';

      const reasonCode =
        completion === 'no'
          ? 'work_not_completed'
          : 'work_partially_completed';

      const priority =
        completion === 'no'
          ? 'high'
          : 'normal';

      if (existingRecovery) {
        recoveryCaseId =
          existingRecovery.case_id;

        db.prepare(`
          UPDATE service_recovery_cases
          SET
            problem_level = ?,
            reason_code = ?,
            priority = ?,
            updated_at = ?
          WHERE case_id = ?
        `).run(
          problemLevel,
          reasonCode,
          priority,
          now,
          recoveryCaseId
        );

      } else {
        recoveryCaseId =
          crypto.randomUUID();

        db.prepare(`
          INSERT INTO service_recovery_cases (
            case_id,
            task_id,
            client_id_crm,
            feedback_id,
            source,
            problem_level,
            reason_code,
            contact_requested,
            status,
            priority,
            created_at,
            updated_at
          )
          VALUES (
            ?, ?, ?,
            NULL,
            'contractor_review',
            ?, ?,
            0,
            'new',
            ?,
            ?, ?
          )
        `).run(
          recoveryCaseId,
          review.task_id,
          review.client_id_crm,
          problemLevel,
          reasonCode,
          priority,
          now,
          now
        );
      }
    }

    db.exec(
      'COMMIT'
    );

  } catch (error) {
    db.exec(
      'ROLLBACK'
    );

    throw error;
  }

  const labels = {
    all:
      'Да, всё выполнено',

    partial:
      'Выполнено частично',

    no:
      'Нет, не всё выполнено'
  };

  await answerTelegramCallback(
    callbackId,
    'Ответ сохранён.'
  );

  const originalMessage =
    text(
      callbackQuery?.message?.text
    );

  if (
    messageId &&
    originalMessage
  ) {
    await editTelegramMessage(
      chatId,
      messageId,
      `${originalMessage}\n\n✓ ${labels[completion]}`,
      {
        replyMarkup: {
          inline_keyboard: []
        }
      }
    );
  }

  if (
    completion === 'partial' ||
    completion === 'no'
  ) {
    await sendTelegramMessage(
      chatId,
      [
        'Спасибо, это важно.',
        '',
        completion === 'no'
          ? 'Зафиксировали, что договорённости были выполнены не полностью.'
          : 'Зафиксировали, что часть договорённостей не была выполнена.',
        '',
        'Хотите, чтобы мы помогли разобраться?'
      ].join('\n'),
      {
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text:
                  '🛠 Да, помогите',

                callback_data:
                  `crh:${reviewId}:yes`
              }
            ],

            [
              {
                text:
                  'Пока не нужно',

                callback_data:
                  `crh:${reviewId}:later`
              }
            ]
          ]
        }
      }
    );

  } else {
    await sendTelegramMessage(
      chatId,
      [
        'Отлично.',
        '',
        'Совпала ли итоговая стоимость с той, которую исполнитель озвучивал изначально?'
      ].join('\n'),
      {
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text:
                  '✅ Да, совпала',

                callback_data:
                  `crp:${reviewId}:matched`
              }
            ],

            [
              {
                text:
                  '↗️ Немного выше',

                callback_data:
                  `crp:${reviewId}:slightly_higher`
              },

              {
                text:
                  '⚠️ Заметно выше',

                callback_data:
                  `crp:${reviewId}:much_higher`
              }
            ],

            [
              {
                text:
                  '⬇️ Получилось дешевле',

                callback_data:
                  `crp:${reviewId}:lower`
              }
            ],

            [
              {
                text:
                  '❔ Заранее точно не называли',

                callback_data:
                  `crp:${reviewId}:not_quoted`
              }
            ]
          ]
        }
      }
    );
  }

  return {
    ok: true,

    contractor_review_completion:
      true,

    review_id:
      reviewId,

    completion_status:
      completion,

    recovery_case_id:
      recoveryCaseId
  };
}


async function handleContractorReviewHelpCallback(
  callbackQuery
) {
  const callbackId =
    text(
      callbackQuery?.id
    );

  const chatId =
    text(
      callbackQuery?.message?.chat?.id
    );

  const messageId =
    callbackQuery?.message?.message_id;

  const data =
    text(
      callbackQuery?.data
    );

  const match =
    data.match(
      /^crh:([^:]+):(yes|later)$/
    );

  if (
    !callbackId ||
    !chatId ||
    !match
  ) {
    return {
      ok: true,
      ignored: true
    };
  }

  const reviewId =
    match[1];

  const answer =
    match[2];

  const review =
    db.prepare(`
      SELECT
        r.review_id,
        r.task_id,
        r.client_id_crm,
        r.candidate_name,
        r.completion_status,

        c.telegram_chat_id,
        c.name AS client_name

      FROM contractor_reviews r

      INNER JOIN clients c
        ON c.client_id_crm =
           r.client_id_crm

      WHERE r.review_id = ?
      LIMIT 1
    `).get(
      reviewId
    );

  if (
    !review ||
    String(
      review.telegram_chat_id || ''
    ) !== String(
      chatId
    )
  ) {
    await answerTelegramCallback(
      callbackId,
      'Запрос уже не актуален.'
    );

    return {
      ok: true,
      ignored: true
    };
  }

  const recovery =
    db.prepare(`
      SELECT
        case_id,
        contact_requested,
        status
      FROM service_recovery_cases
      WHERE task_id = ?
        AND source =
          'contractor_review'
        AND status NOT IN (
          'resolved',
          'closed'
        )
      ORDER BY created_at DESC
      LIMIT 1
    `).get(
      review.task_id
    );

  if (!recovery) {
    await answerTelegramCallback(
      callbackId,
      'Проблемный кейс не найден.'
    );

    return {
      ok: true,
      ignored: true
    };
  }

  const wasRequested =
    Number(
      recovery.contact_requested
    ) === 1;

  const now =
    new Date().toISOString();

  if (answer === 'yes') {
    db.prepare(`
      UPDATE service_recovery_cases
      SET
        contact_requested = 1,
        status =
          'contact_requested',
        updated_at = ?
      WHERE case_id = ?
    `).run(
      now,
      recovery.case_id
    );

  } else {
    db.prepare(`
      UPDATE service_recovery_cases
      SET
        contact_requested = 0,
        status = 'deferred',
        updated_at = ?
      WHERE case_id = ?
    `).run(
      now,
      recovery.case_id
    );
  }

  await answerTelegramCallback(
    callbackId,
    answer === 'yes'
      ? 'Принято. Постараемся помочь.'
      : 'Хорошо.'
  );

  const originalMessage =
    text(
      callbackQuery?.message?.text
    );

  if (
    messageId &&
    originalMessage
  ) {
    await editTelegramMessage(
      chatId,
      messageId,
      `${originalMessage}\n\n${
        answer === 'yes'
          ? '✓ Нужна помощь'
          : '✓ Пока не нужно'
      }`,
      {
        replyMarkup: {
          inline_keyboard: []
        }
      }
    );
  }

  if (answer === 'yes') {
    await sendTelegramMessage(
      chatId,
      'Спасибо. Разберёмся в ситуации и напишем вам.'
    );

    if (!wasRequested) {
      const adminChatId =
        text(
          process.env
            .ADMIN_TELEGRAM_CHAT_ID
        );

      if (adminChatId) {
        try {
          await sendTelegramMessage(
            adminChatId,
            [
              '⚠️ Проблема после выполненных работ',
              '',
              `Клиент: ${
                text(review.client_name) ||
                'Клиент'
              }`,
              `Исполнитель: ${
                text(review.candidate_name) ||
                'не указан'
              }`,
              `Результат: ${
                review.completion_status === 'no'
                  ? 'договорённости не выполнены'
                  : 'выполнены частично'
              }`,
              '',
              'Клиент просит помощи.',
              '',
              'Открыть recovery-очередь:',
              'https://onsdelaet.ru/admin/recovery/'
            ].join('\n')
          );

        } catch (error) {
          console.error(
            '[contractor-review.admin-notification]',
            error
          );
        }
      }
    }
  }

  return {
    ok: true,
    contractor_review_help: true,
    review_id:
      reviewId,
    recovery_case_id:
      recovery.case_id,
    contact_requested:
      answer === 'yes'
  };
}


async function handleContractorReviewCallback(
  callbackQuery
) {
  const callbackId =
    text(
      callbackQuery?.id
    );

  const chatId =
    text(
      callbackQuery?.message?.chat?.id
    );

  const messageId =
    callbackQuery?.message?.message_id;

  const data =
    text(
      callbackQuery?.data
    );

  const match =
    data.match(
      /^cr:([^:]+):([1-5])$/
    );

  if (
    !callbackId ||
    !chatId ||
    !match
  ) {
    return {
      ok: true,
      ignored: true
    };
  }

  const followupId =
    match[1];

  const rating =
    Number(
      match[2]
    );

  const followup =
    db.prepare(`
      SELECT
        f.followup_id,
        f.task_id,
        f.client_id_crm,
        f.status,
        f.payload_json,

        c.telegram_chat_id,

        t.status
          AS task_status,

        t.selected_candidate_id,
        t.selected_candidate_name

      FROM client_followups f

      INNER JOIN clients c
        ON c.client_id_crm =
           f.client_id_crm

      LEFT JOIN tasks t
        ON t.task_id =
           f.task_id

      WHERE f.followup_id = ?
        AND f.type =
          'contractor_review_request'

      LIMIT 1
    `).get(
      followupId
    );

  if (
    !followup ||
    String(
      followup.telegram_chat_id || ''
    ) !== String(
      chatId
    )
  ) {
    await answerTelegramCallback(
      callbackId,
      'Запрос уже не актуален.'
    );

    return {
      ok: true,
      ignored: true
    };
  }

  const existing =
    db.prepare(`
      SELECT
        review_id,
        rating
      FROM contractor_reviews
      WHERE task_id = ?
        AND client_id_crm = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(
      followup.task_id,
      followup.client_id_crm
    );

  if (
    followup.status === 'completed' &&
    existing
  ) {
    await answerTelegramCallback(
      callbackId,
      'Оценка уже сохранена.'
    );

    return {
      ok: true,
      already_completed: true,
      review_id:
        existing.review_id
    };
  }

  const payload = (() => {
    try {
      return JSON.parse(
        followup.payload_json ||
        '{}'
      );
    } catch {
      return {};
    }
  })();

  const candidateId =
    text(
      payload.candidate_id
    ) ||
    text(
      followup.selected_candidate_id
    ) ||
    null;

  const candidateName =
    text(
      payload.candidate_name
    ) ||
    text(
      followup.selected_candidate_name
    ) ||
    'исполнитель';

  const now =
    new Date().toISOString();

  const reviewId =
    existing?.review_id ||
    crypto.randomUUID();

  db.exec(
    'BEGIN IMMEDIATE'
  );

  try {
    if (existing) {
      db.prepare(`
        UPDATE contractor_reviews
        SET
          candidate_id = ?,
          candidate_name = ?,
          rating = ?,
          completion_status =
            'completed',
          verified = 1,
          source = 'task_followup',
          status = 'rating_received',
          updated_at = ?
        WHERE review_id = ?
      `).run(
        candidateId,
        candidateName,
        rating,
        now,
        reviewId
      );

    } else {
      db.prepare(`
        INSERT INTO contractor_reviews (
          review_id,
          task_id,
          client_id_crm,
          candidate_id,
          candidate_name,
          rating,
          completion_status,
          public_consent,
          verified,
          source,
          status,
          created_at,
          updated_at,
          completed_at
        )
        VALUES (
          ?, ?, ?, ?, ?,
          ?,
          'completed',
          0,
          1,
          'task_followup',
          'rating_received',
          ?, ?,
          NULL
        )
      `).run(
        reviewId,
        followup.task_id,
        followup.client_id_crm,
        candidateId,
        candidateName,
        rating,
        now,
        now
      );
    }

    db.prepare(`
      UPDATE client_followups
      SET
        status = 'completed',
        completed_at = ?,
        updated_at = ?
      WHERE followup_id = ?
        AND status IN (
          'pending',
          'processing',
          'sent'
        )
    `).run(
      now,
      now,
      followupId
    );

    db.exec(
      'COMMIT'
    );

  } catch (error) {
    db.exec(
      'ROLLBACK'
    );

    throw error;
  }

  await answerTelegramCallback(
    callbackId,
    'Спасибо, оценка сохранена.'
  );

  const originalMessage =
    text(
      callbackQuery?.message?.text
    );

  if (
    messageId &&
    originalMessage
  ) {
    await editTelegramMessage(
      chatId,
      messageId,
      `${originalMessage}\n\n✓ Оценка: ${rating} из 5`,
      {
        replyMarkup: {
          inline_keyboard: []
        }
      }
    );
  }

  await sendTelegramMessage(
    chatId,
    [
      'Спасибо за оценку.',
      '',
      'Всё ли, о чём договаривались с исполнителем, было выполнено?'
    ].join('\n'),
    {
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text:
                '✅ Да, всё',

              callback_data:
                `crc:${reviewId}:all`
            }
          ],

          [
            {
              text:
                '🟡 Частично',

              callback_data:
                `crc:${reviewId}:partial`
            },

            {
              text:
                '❌ Нет',

              callback_data:
                `crc:${reviewId}:no`
            }
          ]
        ]
      }
    }
  );

  return {
    ok: true,
    contractor_review: true,
    review_id:
      reviewId,
    rating
  };
}


async function handleContractorStatusCallback(
  callbackQuery
) {
  const callbackId =
    text(
      callbackQuery?.id
    );

  const chatId =
    text(
      callbackQuery?.message?.chat?.id
    );

  const messageId =
    callbackQuery?.message?.message_id;

  const data =
    text(
      callbackQuery?.data
    );

  const match =
    data.match(
      /^cs:([^:]+):(completed|ongoing|not_started|other|problem)$/
    );

  if (
    !callbackId ||
    !chatId ||
    !match
  ) {
    return {
      ok: true,
      ignored: true
    };
  }

  const followupId =
    match[1];

  const status =
    match[2];

  const followup =
    db.prepare(`
      SELECT
        f.followup_id,
        f.task_id,
        f.client_id_crm,
        f.status,
        f.payload_json,

        c.telegram_chat_id,

        t.selected_candidate_id,
        t.selected_candidate_name

      FROM client_followups f

      INNER JOIN clients c
        ON c.client_id_crm =
           f.client_id_crm

      LEFT JOIN tasks t
        ON t.task_id =
           f.task_id

      WHERE f.followup_id = ?
        AND f.type =
          'contractor_status_check'

      LIMIT 1
    `).get(
      followupId
    );

  if (
    !followup ||
    String(
      followup.telegram_chat_id || ''
    ) !== String(
      chatId
    )
  ) {
    await answerTelegramCallback(
      callbackId,
      'Запрос уже не актуален.'
    );

    return {
      ok: true,
      ignored: true
    };
  }

  /*
   * Telegram may retry callbacks.
   * Do not create duplicate follow-ups
   * or recovery cases.
   */
  if (
    followup.status ===
      'completed'
  ) {
    await answerTelegramCallback(
      callbackId,
      'Статус уже сохранён.'
    );

    return {
      ok: true,
      already_completed: true
    };
  }

  const now =
    new Date();

  const nowIso =
    now.toISOString();

  const payload = (() => {
    try {
      return JSON.parse(
        followup.payload_json ||
        '{}'
      );
    } catch {
      return {};
    }
  })();

  const candidateName =
    text(
      payload.candidate_name
    ) ||
    text(
      followup.selected_candidate_name
    ) ||
    'исполнитель';

  const labels = {
    completed:
      'Работы завершены',

    ongoing:
      'Работы ещё идут',

    not_started:
      'Работы ещё не начались',

    other:
      'Выбран другой исполнитель',

    problem:
      'Возникла проблема'
  };

  let nextFollowupId =
    null;

  let recoveryCaseId =
    null;

  db.exec(
    'BEGIN IMMEDIATE'
  );

  try {
    db.prepare(`
      UPDATE client_followups
      SET
        status = 'completed',
        completed_at = ?,
        updated_at = ?
      WHERE followup_id = ?
        AND status IN (
          'sent',
          'processing',
          'pending'
        )
    `).run(
      nowIso,
      nowIso,
      followupId
    );

    if (
      status === 'completed'
    ) {
      db.prepare(`
        UPDATE tasks
        SET
          status = 'completed',
          last_completed_stage =
            'work_completed',
          completed_at = ?,
          updated_at = ?
        WHERE task_id = ?
      `).run(
        nowIso,
        nowIso,
        followup.task_id
      );

      const existingReviewFollowup =
        db.prepare(`
          SELECT
            followup_id
          FROM client_followups
          WHERE task_id = ?
            AND type =
              'contractor_review_request'
            AND status IN (
              'pending',
              'sent',
              'processing'
            )
          LIMIT 1
        `).get(
          followup.task_id
        );

      if (!existingReviewFollowup) {
        const reviewFollowupId =
          crypto.randomUUID();

        const reviewDueAt =
          new Date(
            now.getTime() +
            5 * 60 * 1000
          ).toISOString();

        db.prepare(`
          INSERT INTO client_followups (
            followup_id,
            task_id,
            client_id_crm,
            type,
            trigger_stage,
            due_at,
            status,
            payload_json,
            created_at,
            updated_at
          )
          VALUES (
            ?, ?, ?,
            'contractor_review_request',
            'work_completed',
            ?,
            'pending',
            ?,
            ?, ?
          )
        `).run(
          reviewFollowupId,
          followup.task_id,
          followup.client_id_crm,
          reviewDueAt,
          JSON.stringify({
            candidate_id:
              payload.candidate_id ||
              followup.selected_candidate_id ||
              null,

            candidate_name:
              candidateName
          }),
          nowIso,
          nowIso
        );
      }
    }

    if (
      status === 'ongoing' ||
      status === 'not_started'
    ) {
      const delayMs =
        status === 'ongoing'
          ? 7 * 24 * 60 * 60 * 1000
          : 3 * 24 * 60 * 60 * 1000;

      const dueAt =
        new Date(
          now.getTime() +
          delayMs
        ).toISOString();

      nextFollowupId =
        crypto.randomUUID();

      db.prepare(`
        INSERT INTO client_followups (
          followup_id,
          task_id,
          client_id_crm,
          type,
          trigger_stage,
          due_at,
          status,
          payload_json,
          created_at,
          updated_at
        )
        VALUES (
          ?, ?, ?,
          'contractor_status_check',
          'contractor_status_followup',
          ?,
          'pending',
          ?,
          ?, ?
        )
      `).run(
        nextFollowupId,
        followup.task_id,
        followup.client_id_crm,
        dueAt,
        JSON.stringify({
          candidate_id:
            payload.candidate_id ||
            followup.selected_candidate_id ||
            null,

          candidate_name:
            candidateName,

          previous_status:
            status,

          previous_followup_id:
            followupId
        }),
        nowIso,
        nowIso
      );
    }

    if (
      status === 'other'
    ) {
      db.prepare(`
        UPDATE tasks
        SET
          status =
            'contractor_changed',
          last_completed_stage =
            'contractor_changed',
          updated_at = ?
        WHERE task_id = ?
      `).run(
        nowIso,
        followup.task_id
      );
    }

    if (
      status === 'problem'
    ) {
      const existingRecovery =
        db.prepare(`
          SELECT
            case_id
          FROM service_recovery_cases
          WHERE task_id = ?
            AND source =
              'contractor_status'
            AND status NOT IN (
              'resolved',
              'closed'
            )
          ORDER BY created_at DESC
          LIMIT 1
        `).get(
          followup.task_id
        );

      if (existingRecovery) {
        recoveryCaseId =
          existingRecovery.case_id;

        db.prepare(`
          UPDATE service_recovery_cases
          SET
            problem_level =
              'problem',
            reason_code =
              'contractor_problem',
            contact_requested = 1,
            status =
              'contact_requested',
            priority = 'high',
            updated_at = ?
          WHERE case_id = ?
        `).run(
          nowIso,
          recoveryCaseId
        );

      } else {
        recoveryCaseId =
          crypto.randomUUID();

        db.prepare(`
          INSERT INTO service_recovery_cases (
            case_id,
            task_id,
            client_id_crm,
            feedback_id,
            source,
            problem_level,
            reason_code,
            contact_requested,
            status,
            priority,
            created_at,
            updated_at
          )
          VALUES (
            ?, ?, ?,
            NULL,
            'contractor_status',
            'problem',
            'contractor_problem',
            1,
            'contact_requested',
            'high',
            ?, ?
          )
        `).run(
          recoveryCaseId,
          followup.task_id,
          followup.client_id_crm,
          nowIso,
          nowIso
        );
      }
    }

    db.exec(
      'COMMIT'
    );

  } catch (error) {
    db.exec(
      'ROLLBACK'
    );

    throw error;
  }

  await answerTelegramCallback(
    callbackId,
    'Статус сохранён.'
  );

  const originalMessage =
    text(
      callbackQuery?.message?.text
    );

  if (
    messageId &&
    originalMessage
  ) {
    await editTelegramMessage(
      chatId,
      messageId,
      `${originalMessage}\n\n✓ ${labels[status]}`,
      {
        replyMarkup: {
          inline_keyboard: []
        }
      }
    );
  }

  if (
    status === 'completed'
  ) {
    await sendTelegramMessage(
      chatId,
      [
        'Отлично, спасибо.',
        '',
        `Отметили, что работы с «${candidateName}» завершены.`,
        '',
        'Дальше попросим коротко оценить результат и исполнителя.'
      ].join('\n')
    );
  }

  if (
    status === 'ongoing'
  ) {
    await sendTelegramMessage(
      chatId,
      'Хорошо. Через неделю уточним, как идут работы.'
    );
  }

  if (
    status === 'not_started'
  ) {
    await sendTelegramMessage(
      chatId,
      'Хорошо. Через несколько дней уточним статус ещё раз.'
    );
  }

  if (
    status === 'other'
  ) {
    await sendTelegramMessage(
      chatId,
      [
        'Поняли, отметили, что в итоге выбран другой исполнитель.',
        '',
        ''
      ].join('\n')
    );
  }

  if (
    status === 'problem'
  ) {
    await sendTelegramMessage(
      chatId,
      [
        'Поняли. Поможем разобраться с ситуацией по исполнителю.',
        '',
        ''
      ].join('\n')
    );

    const adminChatId =
      text(
        process.env
          .ADMIN_TELEGRAM_CHAT_ID
      );

    if (adminChatId) {
      const client =
        db.prepare(`
          SELECT
            name
          FROM clients
          WHERE client_id_crm = ?
          LIMIT 1
        `).get(
          followup.client_id_crm
        );

      try {
        await sendTelegramMessage(
          adminChatId,
          [
            '⚠️ Проблема с исполнителем',
            '',
            `Клиент: ${
              text(client?.name) ||
              'Клиент'
            }`,
            `Исполнитель: ${candidateName}`,
            'Приоритет: высокий',
            '',
            'Клиент сообщил о проблеме после выбора исполнителя.',
            '',
            'Открыть recovery-очередь:',
            'https://onsdelaet.ru/admin/recovery/'
          ].join('\n')
        );

      } catch (error) {
        console.error(
          '[contractor-status.admin-notification]',
          error
        );
      }
    }
  }

  return {
    ok: true,

    contractor_status: true,

    status,

    followup_id:
      followupId,

    next_followup_id:
      nextFollowupId,

    recovery_case_id:
      recoveryCaseId
  };
}


async function handleServiceRecoveryCallback(
  callbackQuery
) {
  const callbackId =
    text(
      callbackQuery?.id
    );

  const chatId =
    text(
      callbackQuery?.message?.chat?.id
    );

  const messageId =
    callbackQuery?.message?.message_id;

  const data =
    text(
      callbackQuery?.data
    );

  const match =
    data.match(
      /^src:([^:]+):(yes|later)$/
    );

  if (
    !callbackId ||
    !chatId ||
    !match
  ) {
    return {
      ok: true,
      ignored: true
    };
  }

  const followupId =
    match[1];

  const answer =
    match[2];

  const recovery =
    db.prepare(`
      SELECT
        r.case_id,
        r.status,
        r.priority,
        r.problem_level,
        r.reason_code,
        r.client_id_crm,

        c.name
          AS client_name,

        c.telegram_chat_id,

        t.selected_candidate_name

      FROM service_recovery_cases r

      INNER JOIN service_feedback f
        ON f.feedback_id =
           r.feedback_id

      INNER JOIN clients c
        ON c.client_id_crm =
           r.client_id_crm

      LEFT JOIN tasks t
        ON t.task_id =
           r.task_id

      WHERE f.stage = ?
      LIMIT 1
    `).get(
      `selection:${followupId}`
    );

  if (
    !recovery ||
    String(
      recovery.telegram_chat_id || ''
    ) !== String(
      chatId
    )
  ) {
    await answerTelegramCallback(
      callbackId,
      'Запрос уже не актуален.'
    );

    return {
      ok: true,
      ignored: true
    };
  }

  const now =
    new Date().toISOString();

  const becameContactRequested =
    answer === 'yes' &&
    recovery.status !==
      'contact_requested';

  if (answer === 'yes') {
    db.prepare(`
      UPDATE service_recovery_cases
      SET
        contact_requested = 1,
        status = 'contact_requested',
        updated_at = ?
      WHERE case_id = ?
    `).run(
      now,
      recovery.case_id
    );

  } else {
    db.prepare(`
      UPDATE service_recovery_cases
      SET
        contact_requested = 0,
        status = 'deferred',
        updated_at = ?
      WHERE case_id = ?
    `).run(
      now,
      recovery.case_id
    );
  }

  await answerTelegramCallback(
    callbackId,
    answer === 'yes'
      ? 'Принято. Постараемся помочь.'
      : 'Хорошо. Если понадобится помощь — вернёмся к этому позже.'
  );

  const originalMessage =
    text(
      callbackQuery?.message?.text
    );

  if (
    messageId &&
    originalMessage
  ) {
    await editTelegramMessage(
      chatId,
      messageId,
      `${originalMessage}\n\n${
        answer === 'yes'
          ? '✓ Нужна помощь'
          : '✓ Не сейчас'
      }`,
      {
        replyMarkup: {
          inline_keyboard: []
        }
      }
    );
  }

  if (answer === 'yes') {
    await sendTelegramMessage(
      chatId,
      'Поняли. Поможем разобраться — напишем вам по этой задаче.'
    );
  }

  if (
    becameContactRequested
  ) {
    const adminChatId =
      text(
        process.env
          .ADMIN_TELEGRAM_CHAT_ID
      );

    if (adminChatId) {
      const reasonLabels = {
        few_options:
          'Мало подходящих вариантов',

        verification:
          'Не хватило проверки',

        comparison:
          'Сложно сравнить',

        choice_help:
          'Не хватило помощи с выбором',

        other:
          'Другая причина'
      };

      const problemLabel =
        recovery.problem_level === 'no'
          ? 'Сервис не помог'
          : 'Сервис помог частично';

      const reasonLabel =
        reasonLabels[
          recovery.reason_code
        ] ||
        recovery.reason_code ||
        'Причина не указана';

      const clientName =
        text(
          recovery.client_name
        ) ||
        'Клиент';

      const candidateName =
        text(
          recovery
            .selected_candidate_name
        ) ||
        'не указан';

      try {
        await sendTelegramMessage(
          adminChatId,
          [
            '🔴 Новый клиент просит помощи',
            '',
            `Клиент: ${clientName}`,
            `Сигнал: ${problemLabel}`,
            `Причина: ${reasonLabel}`,
            `Исполнитель: ${candidateName}`,
            '',
            'Открыть recovery-очередь:',
            'https://onsdelaet.ru/admin/recovery/'
          ].join('\n')
        );

      } catch (error) {
        console.error(
          '[service-recovery.admin-notification]',
          error
        );
      }
    }
  }

  return {
    ok: true,
    service_recovery: true,
    case_id:
      recovery.case_id,
    contact_requested:
      answer === 'yes'
  };
}


async function handleServiceFeedbackReasonCallback(
  callbackQuery
) {
  const callbackId =
    text(
      callbackQuery?.id
    );

  const chatId =
    text(
      callbackQuery?.message?.chat?.id
    );

  const messageId =
    callbackQuery?.message?.message_id;

  const data =
    text(
      callbackQuery?.data
    );

  const match =
    data.match(
      /^sfr:([^:]+):(few_options|verification|comparison|choice_help|other)$/
    );

  if (
    !callbackId ||
    !chatId ||
    !match
  ) {
    return {
      ok: true,
      ignored: true
    };
  }

  const followupId =
    match[1];

  const reason =
    match[2];

  const labels = {
    few_options:
      'Мало подходящих вариантов',

    verification:
      'Не хватило проверки',

    comparison:
      'Сложно сравнить',

    choice_help:
      'Не хватило помощи с выбором',

    other:
      'Другое'
  };

  const followup =
    db.prepare(`
      SELECT
        f.followup_id,
        f.task_id,
        f.client_id_crm,
        c.telegram_chat_id

      FROM client_followups f

      INNER JOIN clients c
        ON c.client_id_crm =
           f.client_id_crm

      WHERE f.followup_id = ?
        AND f.type =
          'service_feedback_after_selection'

      LIMIT 1
    `).get(
      followupId
    );

  if (
    !followup ||
    String(
      followup.telegram_chat_id || ''
    ) !== String(
      chatId
    )
  ) {
    await answerTelegramCallback(
      callbackId,
      'Ответ не удалось сохранить.'
    );

    return {
      ok: true,
      ignored: true
    };
  }

  const feedback =
    db.prepare(`
      SELECT
        feedback_id
      FROM service_feedback
      WHERE task_id = ?
        AND stage = ?
      LIMIT 1
    `).get(
      followup.task_id,
      `selection:${followupId}`
    );

  if (!feedback) {
    await answerTelegramCallback(
      callbackId,
      'Основной ответ не найден.'
    );

    return {
      ok: true,
      ignored: true
    };
  }

  const now =
    new Date().toISOString();

  db.exec(
    'BEGIN IMMEDIATE'
  );

  try {
    db.prepare(`
      UPDATE service_feedback
      SET
        reason_not_selected = ?,
        updated_at = ?
      WHERE feedback_id = ?
    `).run(
      reason,
      now,
      feedback.feedback_id
    );

    db.prepare(`
      UPDATE service_recovery_cases
      SET
        reason_code = ?,
        updated_at = ?
      WHERE feedback_id = ?
    `).run(
      reason,
      now,
      feedback.feedback_id
    );

    db.exec(
      'COMMIT'
    );

  } catch (error) {
    db.exec(
      'ROLLBACK'
    );

    throw error;
  }

  await answerTelegramCallback(
    callbackId,
    'Спасибо, причина сохранена.'
  );

  const originalMessage =
    text(
      callbackQuery?.message?.text
    );

  if (
    messageId &&
    originalMessage
  ) {
    await editTelegramMessage(
      chatId,
      messageId,
      `${originalMessage}\n\n✓ ${labels[reason]}`,
      {
        replyMarkup: {
          inline_keyboard: []
        }
      }
    );
  }

  const solutionText = {
    few_options:
      'Можем уточнить задачу и попробовать найти дополнительные подходящие варианты.',

    verification:
      'Можем дополнительно проверить выбранных кандидатов и доступные данные о них.',

    comparison:
      'Можем привести предложения к одному виду и помочь разобраться в различиях.',

    choice_help:
      'Можем помочь разобрать финальные варианты и подсветить важные различия.',

    other:
      'Можем разобраться в ситуации вручную и предложить следующий шаг.'
  }[reason];

  await sendTelegramMessage(
    chatId,
    `${solutionText}\n\nХотите, поможем?`,
    {
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text:
                '🛠 Да, помогите',

              callback_data:
                `src:${followupId}:yes`
            }
          ],

          [
            {
              text:
                'Не сейчас',

              callback_data:
                `src:${followupId}:later`
            }
          ]
        ]
      }
    }
  );

  return {
    ok: true,
    service_feedback_reason: true,
    reason
  };
}


function upsertServiceRecoveryCase({
  taskId,
  clientIdCrm,
  feedbackId,
  problemLevel,
  reasonCode = null
}) {
  const normalizedTaskId =
    text(taskId);

  const normalizedClientId =
    text(clientIdCrm);

  const normalizedFeedbackId =
    text(feedbackId);

  const normalizedLevel =
    text(problemLevel);

  const normalizedReason =
    text(reasonCode) || null;

  if (
    !normalizedTaskId ||
    !normalizedClientId ||
    !normalizedFeedbackId ||
    !normalizedLevel
  ) {
    return null;
  }

  const priority =
    normalizedLevel === 'no'
      ? 'high'
      : 'normal';

  const now =
    new Date().toISOString();

  const existing =
    db.prepare(`
      SELECT
        case_id
      FROM service_recovery_cases
      WHERE feedback_id = ?
      LIMIT 1
    `).get(
      normalizedFeedbackId
    );

  if (existing) {
    db.prepare(`
      UPDATE service_recovery_cases
      SET
        problem_level = ?,
        reason_code =
          COALESCE(
            ?,
            reason_code
          ),
        priority = ?,
        updated_at = ?
      WHERE case_id = ?
    `).run(
      normalizedLevel,
      normalizedReason,
      priority,
      now,
      existing.case_id
    );

    return existing.case_id;
  }

  const caseId =
    crypto.randomUUID();

  db.prepare(`
    INSERT INTO service_recovery_cases (
      case_id,
      task_id,
      client_id_crm,
      feedback_id,
      source,
      problem_level,
      reason_code,
      contact_requested,
      status,
      priority,
      created_at,
      updated_at
    )
    VALUES (
      ?, ?, ?, ?,
      'service_feedback',
      ?, ?,
      0,
      'new',
      ?,
      ?, ?
    )
  `).run(
    caseId,
    normalizedTaskId,
    normalizedClientId,
    normalizedFeedbackId,
    normalizedLevel,
    normalizedReason,
    priority,
    now,
    now
  );

  return caseId;
}


async function handleServiceFeedbackCallback(
  callbackQuery
) {
  const callbackId =
    text(
      callbackQuery?.id
    );

  const chatId =
    text(
      callbackQuery?.message?.chat?.id
    );

  const data =
    text(
      callbackQuery?.data
    );

  const match =
    data.match(
      /^sf:([^:]+):(yes|partial|no)$/
    );

  if (
    !callbackId ||
    !chatId ||
    !match
  ) {
    return {
      ok: true,
      ignored: true
    };
  }

  const followupId =
    match[1];

  const answer =
    match[2];

  const followup =
    db.prepare(`
      SELECT
        f.followup_id,
        f.task_id,
        f.client_id_crm,
        f.type,
        f.status,

        c.telegram_chat_id

      FROM client_followups f

      INNER JOIN clients c
        ON c.client_id_crm =
           f.client_id_crm

      WHERE f.followup_id = ?
      LIMIT 1
    `).get(
      followupId
    );

  if (
    !followup ||
    followup.type !==
      'service_feedback_after_selection'
  ) {
    await answerTelegramCallback(
      callbackId,
      'Этот вопрос больше не актуален.'
    );

    return {
      ok: true,
      ignored: true,
      reason:
        'FOLLOWUP_NOT_FOUND'
    };
  }

  /*
   * Never accept a callback from another
   * Telegram account.
   */
  if (
    String(
      followup.telegram_chat_id || ''
    ) !== String(
      chatId
    )
  ) {
    await answerTelegramCallback(
      callbackId,
      'Не удалось подтвердить Telegram-аккаунт.'
    );

    return {
      ok: true,
      ignored: true,
      reason:
        'TELEGRAM_CHAT_MISMATCH'
    };
  }

  const helpedChoose =
    answer === 'yes'
      ? 'yes'
      : answer === 'partial'
        ? 'partial'
        : 'no';

  const rating =
    answer === 'yes'
      ? 5
      : answer === 'partial'
        ? 3
        : 1;

  const now =
    new Date().toISOString();

  db.exec(
    'BEGIN IMMEDIATE'
  );

  try {
    /*
     * Idempotency:
     * one feedback record per follow-up.
     */
    const existing =
      db.prepare(`
        SELECT
          feedback_id
        FROM service_feedback
        WHERE task_id = ?
          AND stage = ?
        LIMIT 1
      `).get(
        followup.task_id,
        `selection:${followup.followup_id}`
      );

    let feedbackId =
      existing?.feedback_id ||
      null;

    if (!feedbackId) {
      feedbackId =
        crypto.randomUUID();

      db.prepare(`
        INSERT INTO service_feedback (
          feedback_id,
          task_id,
          client_id_crm,
          stage,
          rating,
          helped_choose,
          contractor_selected,
          public_consent,
          status,
          created_at,
          updated_at
        )
        VALUES (
          ?, ?, ?, ?,
          ?, ?,
          1,
          0,
          'received',
          ?, ?
        )
      `).run(
        feedbackId,
        followup.task_id,
        followup.client_id_crm,
        `selection:${followup.followup_id}`,
        rating,
        helpedChoose,
        now,
        now
      );
    }

    if (
      helpedChoose === 'partial' ||
      helpedChoose === 'no'
    ) {
      upsertServiceRecoveryCase({
        taskId:
          followup.task_id,

        clientIdCrm:
          followup.client_id_crm,

        feedbackId,

        problemLevel:
          helpedChoose
      });
    }

    db.prepare(`
      UPDATE client_followups
      SET
        status = 'completed',
        completed_at =
          COALESCE(
            completed_at,
            ?
          ),
        updated_at = ?
      WHERE followup_id = ?
        AND status IN (
          'sent',
          'completed'
        )
    `).run(
      now,
      now,
      followup.followup_id
    );

    db.exec(
      'COMMIT'
    );

  } catch (error) {
    db.exec(
      'ROLLBACK'
    );

    throw error;
  }

  const confirmation =
    helpedChoose === 'yes'
      ? 'Спасибо! Здорово, что «Сделает» помог с выбором.'
      : helpedChoose === 'partial'
        ? 'Спасибо. Это поможет нам улучшить подбор.'
        : 'Спасибо. Будем улучшать подбор.';

  await answerTelegramCallback(
    callbackId,
    confirmation
  );

  const answerLabel =
    helpedChoose === 'yes'
      ? 'Да, помог'
      : helpedChoose === 'partial'
        ? 'Частично'
        : 'Нет';

  const originalMessage =
    text(
      callbackQuery?.message?.text
    );

  const messageId =
    callbackQuery?.message?.message_id;

  if (
    messageId &&
    originalMessage
  ) {
    await editTelegramMessage(
      chatId,
      messageId,
      `${originalMessage}\n\n✓ Ваш ответ: ${answerLabel}`,
      {
        replyMarkup: {
          inline_keyboard: []
        }
      }
    );
  }

  if (
    helpedChoose === 'partial' ||
    helpedChoose === 'no'
  ) {
    await sendTelegramMessage(
      chatId,
      'Подскажите, чего больше всего не хватило?',
      {
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text:
                  'Мало подходящих вариантов',

                callback_data:
                  `sfr:${followup.followup_id}:few_options`
              }
            ],

            [
              {
                text:
                  'Не хватило проверки',

                callback_data:
                  `sfr:${followup.followup_id}:verification`
              }
            ],

            [
              {
                text:
                  'Сложно сравнить',

                callback_data:
                  `sfr:${followup.followup_id}:comparison`
              },

              {
                text:
                  'Не хватило помощи с выбором',

                callback_data:
                  `sfr:${followup.followup_id}:choice_help`
              }
            ],

            [
              {
                text:
                  'Другое',

                callback_data:
                  `sfr:${followup.followup_id}:other`
              }
            ]
          ]
        }
      }
    );
  }

  return {
    ok: true,
    service_feedback: true,
    followup_id:
      followup.followup_id,
    helped_choose:
      helpedChoose
  };
}


async function handleTelegramWebhook(
  update
) {
  if (
    update?.business_connection
  ) {
    return saveTelegramBusinessConnection(
      update.business_connection
    );
  }

  if (
    update?.business_message
  ) {
    return saveTelegramBusinessMessage(
      update.business_message,
      'business_message'
    );
  }

  if (
    update?.edited_business_message
  ) {
    return saveTelegramBusinessMessage(
      update.edited_business_message,
      'edited_business_message'
    );
  }

  if (
    update?.callback_query
  ) {
    const callbackData =
      text(
        update.callback_query.data
      );

    if (
      callbackData.startsWith(
        'sf:'
      )
    ) {
      return handleServiceFeedbackCallback(
        update.callback_query
      );
    }

    if (
      callbackData.startsWith(
        'sfr:'
      )
    ) {
      return handleServiceFeedbackReasonCallback(
        update.callback_query
      );
    }

    if (
      callbackData.startsWith(
        'crpub:'
      )
    ) {
      return handleContractorReviewPublicConsentCallback(
        update.callback_query
      );
    }


    if (
      callbackData.startsWith(
        'crphoto:'
      )
    ) {
      return handleContractorReviewPhotoCallback(
        update.callback_query
      );
    }


    if (
      callbackData.startsWith(
        'crr:'
      )
    ) {
      return handleContractorReviewRecommendationCallback(
        update.callback_query
      );
    }


    if (
      callbackData.startsWith(
        'crp:'
      )
    ) {
      return handleContractorReviewPriceMatchCallback(
        update.callback_query
      );
    }


    if (
      callbackData.startsWith(
        'crh:'
      )
    ) {
      return handleContractorReviewHelpCallback(
        update.callback_query
      );
    }


    if (
      callbackData.startsWith(
        'crc:'
      )
    ) {
      return handleContractorReviewCompletionCallback(
        update.callback_query
      );
    }


    if (
      callbackData.startsWith(
        'cr:'
      )
    ) {
      return handleContractorReviewCallback(
        update.callback_query
      );
    }


    if (
      callbackData.startsWith(
        'cs:'
      )
    ) {
      return handleContractorStatusCallback(
        update.callback_query
      );
    }


    if (
      callbackData.startsWith(
        'src:'
      )
    ) {
      return handleServiceRecoveryCallback(
        update.callback_query
      );
    }

    return {
      ok: true,
      ignored: true,
      reason:
        'UNSUPPORTED_CALLBACK'
    };
  }


  const message =
    update &&
    typeof update === 'object'
      ? update.message
      : null;

  /*
   * Callback queries and other update types
   * will be handled separately later.
   */
  if (!message) {
    return {
      ok: true,
      ignored: true
    };
  }

  const chatId =
    text(
      message.chat?.id
    );

  const telegramUsername =
    text(
      message.from?.username
    );

  const messagePhotos =
    Array.isArray(
      message.photo
    )
      ? message.photo
      : [];

  const messageText =
    text(
      message.text
    );

  if (!chatId) {
    return {
      ok: true,
      ignored: true
    };
  }

  const pendingReview =
    db.prepare(`
      SELECT
        r.review_id,
        r.status

      FROM contractor_reviews r

      INNER JOIN clients c
        ON c.client_id_crm =
           r.client_id_crm

      WHERE c.telegram_chat_id = ?
        AND r.status IN (
          'recommendation_received',
          'awaiting_photo'
        )

      ORDER BY r.updated_at DESC

      LIMIT 1
    `).get(
      chatId
    );

  if (
    pendingReview &&
    pendingReview.status ===
      'recommendation_received' &&
    messageText
  ) {
    const now =
      new Date().toISOString();

    db.prepare(`
      UPDATE contractor_reviews
      SET
        comment = ?,
        status = 'awaiting_photo',
        updated_at = ?
      WHERE review_id = ?
    `).run(
      messageText,
      now,
      pendingReview.review_id
    );

    await sendTelegramMessage(
      chatId,
      [
        'Спасибо, отзыв сохранили.',
        '',
        'Можно добавить фото результата.',
        'Это необязательно, но фото поможет подтвердить отзыв.',
        '',
        'Отправьте фото следующим сообщением или нажмите «Пропустить».'
      ].join('\n'),
      {
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text:
                  'Пропустить',

                callback_data:
                  `crphoto:${pendingReview.review_id}:skip`
              }
            ]
          ]
        }
      }
    );

    return {
      ok: true,
      contractor_review_comment:
        true,
      review_id:
        pendingReview.review_id
    };
  }


  if (
    pendingReview &&
    pendingReview.status ===
      'awaiting_photo' &&
    messagePhotos.length
  ) {
    const photo =
      messagePhotos[
        messagePhotos.length - 1
      ];

    const fileId =
      text(
        photo?.file_id
      );

    if (fileId) {
      const now =
        new Date().toISOString();

      db.prepare(`
        INSERT INTO contractor_review_photos (
          photo_id,
          review_id,
          telegram_file_id,
          telegram_file_unique_id,
          source,
          created_at
        )
        VALUES (
          ?, ?, ?, ?,
          'telegram',
          ?
        )
      `).run(
        crypto.randomUUID(),
        pendingReview.review_id,
        fileId,
        text(
          photo?.file_unique_id
        ) || null,
        now
      );

      db.prepare(`
        UPDATE contractor_reviews
        SET
          status =
            'awaiting_public_consent',
          updated_at = ?
        WHERE review_id = ?
      `).run(
        now,
        pendingReview.review_id
      );

      await sendTelegramMessage(
        chatId,
        'Фото добавлено. Можно ли использовать ваш отзыв и фото публично в «Сделает»?',
        {
          replyMarkup: {
            inline_keyboard: [
              [
                {
                  text:
                    '✅ Да, можно',

                  callback_data:
                    `crpub:${pendingReview.review_id}:yes`
                }
              ],

              [
                {
                  text:
                    'Нет, только для сервиса',

                  callback_data:
                    `crpub:${pendingReview.review_id}:no`
                }
              ]
            ]
          }
        }
      );

      return {
        ok: true,
        contractor_review_photo:
          true,
        review_id:
          pendingReview.review_id
      };
    }
  }


  const startMatch =
    messageText.match(
      /^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]+))?$/i
    );

  /*
   * At this stage the bot only processes /start.
   */
  if (!startMatch) {
    return {
      ok: true,
      ignored: true
    };
  }

  const token =
    text(
      startMatch[1]
    );

  /*
   * User opened the bot manually instead of
   * through the task-specific deep link.
   */
  if (!token) {
    await sendTelegramMessage(
      chatId,
      'Чтобы подключить уведомления к задаче, откройте Telegram по кнопке «Подключить Telegram» в сервисе «Сделает».'
    );

    return {
      ok: true,
      connected: false,
      reason: 'START_TOKEN_REQUIRED'
    };
  }

  const link =
    db.prepare(`
      SELECT
        token,
        client_id_crm,
        task_id,
        status,
        created_at,
        expires_at,
        used_at,
        telegram_chat_id
      FROM telegram_link_tokens
      WHERE token = ?
      LIMIT 1
    `).get(
      token
    );

  if (!link) {
    await sendTelegramMessage(
      chatId,
      'Ссылка подключения не найдена или уже недействительна. Вернитесь в «Сделает» и подключите Telegram ещё раз.'
    );

    return {
      ok: true,
      connected: false,
      reason: 'TOKEN_NOT_FOUND'
    };
  }

  const now =
    new Date();

  const nowIso =
    now.toISOString();

  const expiresAt =
    link.expires_at
      ? new Date(
          link.expires_at
        )
      : null;

  if (
    expiresAt &&
    Number.isFinite(
      expiresAt.getTime()
    ) &&
    expiresAt.getTime() <
      now.getTime()
  ) {
    if (
      link.status === 'pending'
    ) {
      db.prepare(`
        UPDATE telegram_link_tokens
        SET status = 'expired'
        WHERE token = ?
          AND status = 'pending'
      `).run(
        token
      );
    }

    await sendTelegramMessage(
      chatId,
      'Срок действия ссылки истёк. Вернитесь в «Сделает» и нажмите «Подключить Telegram» ещё раз.'
    );

    return {
      ok: true,
      connected: false,
      reason: 'TOKEN_EXPIRED'
    };
  }

  /*
   * Telegram can retry the same webhook.
   * Treat an already-used token from the same
   * chat as an idempotent success.
   */
  if (
    link.status === 'used'
  ) {
    if (
      link.telegram_chat_id &&
      String(
        link.telegram_chat_id
      ) !== String(
        chatId
      )
    ) {
      await sendTelegramMessage(
        chatId,
        'Эта ссылка уже была использована для другого Telegram-аккаунта.'
      );

      return {
        ok: true,
        connected: false,
        reason: 'TOKEN_ALREADY_USED'
      };
    }

    const existingTask =
      db.prepare(`
        SELECT
          service_name,
          city
        FROM tasks
        WHERE task_id = ?
        LIMIT 1
      `).get(
        link.task_id
      );

    const taskName =
      text(
        existingTask?.service_name
      ) || 'вашей задаче';

    await sendTelegramMessage(
      chatId,
      `Telegram уже подключён к задаче «${taskName}». Уведомления будут приходить сюда.`
    );

    return {
      ok: true,
      connected: true,
      reused: true,
      task_id:
        link.task_id
    };
  }

  if (
    link.status !== 'pending'
  ) {
    await sendTelegramMessage(
      chatId,
      'Эта ссылка подключения больше не активна. Вернитесь в «Сделает» и создайте новую.'
    );

    return {
      ok: true,
      connected: false,
      reason: 'TOKEN_NOT_PENDING'
    };
  }

  const task =
    db.prepare(`
      SELECT
        task_id,
        client_id_crm,
        service_name,
        city
      FROM tasks
      WHERE task_id = ?
      LIMIT 1
    `).get(
      link.task_id
    );

  if (
    !task ||
    String(
      task.client_id_crm
    ) !== String(
      link.client_id_crm
    )
  ) {
    const error =
      new Error(
        'TELEGRAM_LINK_TASK_INVALID'
      );

    error.statusCode = 400;

    throw error;
  }

  db.exec(
    'BEGIN IMMEDIATE'
  );

  try {
    const tokenUpdate =
      db.prepare(`
        UPDATE telegram_link_tokens
        SET
          status = 'used',
          used_at = ?,
          telegram_chat_id = ?
        WHERE token = ?
          AND status = 'pending'
      `).run(
        nowIso,
        chatId,
        token
      );

    if (
      Number(
        tokenUpdate.changes
      ) !== 1
    ) {
      throw new Error(
        'TELEGRAM_LINK_ALREADY_PROCESSED'
      );
    }

    db.prepare(`
      UPDATE clients
      SET
        telegram_chat_id = ?,
        telegram_username = ?,
        telegram_connected_at = ?,
        updated_at = ?
      WHERE client_id_crm = ?
    `).run(
      chatId,
      telegramUsername || null,
      nowIso,
      nowIso,
      link.client_id_crm
    );

    db.exec(
      'COMMIT'
    );

  } catch (error) {
    db.exec(
      'ROLLBACK'
    );

    throw error;
  }

  const taskName =
    text(
      task.service_name
    ) || 'вашей задаче';

  const city =
    text(
      task.city
    );

  const citySuffix =
    city
      ? ` · ${city}`
      : '';

  /*
   * DB is committed before sending.
   * If Telegram delivery temporarily fails,
   * the retried webhook follows the idempotent
   * "used" branch above.
   */
  await sendTelegramMessage(
    chatId,
    `Telegram подключён к задаче «${taskName}»${citySuffix}.\n\nБудем присылать сюда только выбранные вами уведомления по задаче.`
  );

  return {
    ok: true,
    connected: true,
    task_id:
      task.task_id,
    client_id_crm:
      task.client_id_crm
  };
}


function createTelegramLink({
  taskId,
  orderId
}) {
  if (
    !TELEGRAM_BOT_USERNAME ||
    !TELEGRAM_BOT_TOKEN
  ) {
    const error =
      new Error(
        'TELEGRAM_NOT_CONFIGURED'
      );

    error.statusCode =
      503;

    throw error;
  }

  const task =
    db.prepare(`
      SELECT
        task_id,
        client_id_crm
      FROM tasks
      WHERE task_id = ?
      LIMIT 1
    `).get(
      text(taskId)
    );

  if (!task) {
    const error =
      new Error(
        'TASK_NOT_FOUND'
      );

    error.statusCode =
      404;

    throw error;
  }

  const order =
    db.prepare(`
      SELECT
        order_id,
        task_id,
        client_id_crm
      FROM orders
      WHERE order_id = ?
      LIMIT 1
    `).get(
      text(orderId)
    );

  if (
    !order ||
    String(order.task_id) !==
      String(task.task_id) ||
    String(order.client_id_crm) !==
      String(task.client_id_crm)
  ) {
    const error =
      new Error(
        'ORDER_NOT_FOUND'
      );

    error.statusCode =
      404;

    throw error;
  }

  const prefs =
    db.prepare(`
      SELECT
        telegram_enabled
      FROM task_notification_preferences
      WHERE task_id = ?
      LIMIT 1
    `).get(
      task.task_id
    );

  if (
    !prefs ||
    Number(
      prefs.telegram_enabled
    ) !== 1
  ) {
    const error =
      new Error(
        'TELEGRAM_NOT_ENABLED'
      );

    error.statusCode =
      400;

    throw error;
  }

  const token =
    crypto
      .randomBytes(24)
      .toString('base64url');

  const now =
    new Date();

  const expiresAt =
    new Date(
      now.getTime() +
      30 * 60 * 1000
    ).toISOString();

  db.prepare(`
    INSERT INTO telegram_link_tokens (
      token,
      client_id_crm,
      task_id,
      status,
      created_at,
      expires_at
    )
    VALUES (?, ?, ?, 'pending', ?, ?)
  `).run(
    token,
    task.client_id_crm,
    task.task_id,
    now.toISOString(),
    expiresAt
  );

  return {
    url:
      `https://t.me/${TELEGRAM_BOT_USERNAME}` +
      `?start=${encodeURIComponent(token)}`,

    expiresAt
  };
}


async function prepareOrder(req) {
  const body =
    await readRequestJson(req);

  const client =
    body.client || {};

  const task =
    body.task || {};

  const attribution =
    body.attribution || {};

  const notifications =
    body.notifications &&
    typeof body.notifications === 'object'
      ? body.notifications
      : {};

  const name =
    text(
      client.name
    );

  const phone =
    text(
      client.phone
    );

  const phoneNormalized =
    normalizeClientPhone(
      phone
    );

  const email =
    normalizeClientEmail(
      client.email
    );

  const preferredContact =
    text(
      client.preferred_contact
    );

  const consent =
    client.consent_personal_data === true;

  const ymClientId =
    text(
      client.ym_client_id ||
      body.ym_client_id
    );

  if (
    name.length < 2
  ) {
    const error =
      new Error(
        'NAME_REQUIRED'
      );

    error.statusCode =
      400;

    throw error;
  }

  if (
    phoneNormalized.length !== 11
  ) {
    const error =
      new Error(
        'INVALID_PHONE'
      );

    error.statusCode =
      400;

    throw error;
  }

  if (!email) {
    const error =
      new Error(
        'EMAIL_REQUIRED'
      );

    error.statusCode =
      400;

    throw error;
  }

  if (
    !validClientEmail(email)
  ) {
    const error =
      new Error(
        'INVALID_EMAIL'
      );

    error.statusCode =
      400;

    throw error;
  }

  if (!consent) {
    const error =
      new Error(
        'CONSENT_REQUIRED'
      );

    error.statusCode =
      400;

    throw error;
  }

  if (
    !text(task.categoryId) ||
    !text(task.category)
  ) {
    const error =
      new Error(
        'TASK_REQUIRED'
      );

    error.statusCode =
      400;

    throw error;
  }

  db.exec(
    'BEGIN IMMEDIATE'
  );

  try {
    const clientIdCrm =
      getOrCreateClient({
        name,
        phone,
        email,
        preferredContact,
        ymClientId,
        consent
      });

    const taskId =
      savePreparedTask({
        task,
        clientIdCrm
      });

    const notificationPreferences =
      saveTaskNotificationPreferences({
        taskId,
        clientIdCrm,
        notifications
      });

    const prepared =
      createPreparedOrder({
        taskId,
        clientIdCrm,
        tariffId:
          text(
            body.tariff_id
          ) || 'find',
        ymClientId,
        attribution
      });

          updateTaskLifecycle(
        taskId,
        'order_created',
        {
          status:
            'awaiting_payment'
        }
      );

db.exec('COMMIT');

    return {
      ok: true,

      client_id_crm:
        clientIdCrm,

      task_id:
        taskId,

      order_id:
        prepared.orderId,

      tariff_id:
        prepared.tariff.id,

      tariff_name:
        prepared.tariff.name,

      amount:
        prepared.tariff.amount,

      currency:
        prepared.tariff.currency,

      telegram_required:
        notificationPreferences
          .telegramEnabled,

      status:
        'awaiting_payment'
    };

  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {}

    throw error;
  }
}


function saveTaxonomySignal(body = {}) {
  const rawService = text(
    body.raw_service ??
    body.rawService ??
    body.description
  ).slice(0, 500);

  const categoryStatus = text(
    body.category_status ??
    body.categoryStatus
  );

  if (!rawService || rawService.length < 3) {
    const error = new Error('RAW_SERVICE_REQUIRED');
    error.status = 400;
    throw error;
  }

  if (!['unclassified_in_domain', 'unsupported_domain'].includes(categoryStatus)) {
    const error = new Error('INVALID_CATEGORY_STATUS');
    error.status = 400;
    throw error;
  }

  const normalizedKey = lower(rawService)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);

  const suggestedCategory = text(
    body.suggested_category ??
    body.suggestedCategory
  ).slice(0, 120);

  const domain = text(body.domain).slice(0, 80);
  const region = text(body.region).slice(0, 160);
  const createdAt = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO taxonomy_signals (
      raw_service,
      normalized_key,
      category_status,
      suggested_category,
      domain,
      region,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    rawService,
    normalizedKey,
    categoryStatus,
    suggestedCategory || null,
    domain || null,
    region || null,
    createdAt
  );

  return {
    id: Number(result.lastInsertRowid),
    categoryStatus,
    createdAt
  };
}

function listTaxonomySignalsReport() {
  const rows = db.prepare(`
    SELECT
      MIN(raw_service) AS raw_service,
      region AS normalized_region,
      category_status AS classification_status,
      suggested_category,
      domain,
      COUNT(*) AS requests_count,
      MIN(created_at) AS first_seen,
      MAX(created_at) AS last_seen
    FROM taxonomy_signals
    GROUP BY
      normalized_key,
      COALESCE(region, ''),
      category_status,
      COALESCE(domain, ''),
      COALESCE(suggested_category, '')
    ORDER BY
      requests_count DESC,
      last_seen DESC
    LIMIT 500
  `).all();

  return {
    rows,
    groups: {
      unclassified_in_domain: rows.filter((row) => row.classification_status === 'unclassified_in_domain'),
      unsupported_domain: rows.filter((row) => row.classification_status === 'unsupported_domain')
    }
  };
}


function requireAdminRequest(
  req
) {
  const configured =
    text(
      process.env
        .ADMIN_INTERNAL_SECRET
    );

  const supplied =
    text(
      req.headers[
        'x-sdelaet-admin-secret'
      ]
    );

  if (
    !configured ||
    !supplied ||
    supplied !== configured
  ) {
    const error =
      new Error(
        'ADMIN_FORBIDDEN'
      );

    error.statusCode = 403;

    throw error;
  }

  return true;
}


function listAdminRecoveryCases() {
  return db.prepare(`
    SELECT
      r.case_id,
      r.task_id,
      r.client_id_crm,
      r.feedback_id,
      r.source,
      r.problem_level,
      r.reason_code,
      r.contact_requested,
      r.status,
      r.priority,
      r.assigned_to,
      r.solution_notes,
      r.created_at,
      r.updated_at,
      r.contacted_at,
      r.resolved_at,
      r.closed_at,

      c.name
        AS client_name,

      c.phone
        AS client_phone,

      c.email
        AS client_email,

      c.telegram_username,

      c.telegram_chat_id,

      t.status
        AS task_status,

      t.selected_candidate_id,

      t.selected_candidate_name,

      f.rating,
      f.helped_choose,
      f.feedback_text

    FROM service_recovery_cases r

    LEFT JOIN clients c
      ON c.client_id_crm =
         r.client_id_crm

    LEFT JOIN tasks t
      ON t.task_id =
         r.task_id

    LEFT JOIN service_feedback f
      ON f.feedback_id =
         r.feedback_id

    ORDER BY
      CASE r.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        ELSE 4
      END,

      CASE r.status
        WHEN 'contact_requested' THEN 1
        WHEN 'new' THEN 2
        WHEN 'in_progress' THEN 3
        WHEN 'deferred' THEN 4
        WHEN 'resolved' THEN 5
        WHEN 'closed' THEN 6
        ELSE 7
      END,

      r.created_at ASC
  `).all();
}


function adminRecoveryStats() {
  return db.prepare(`
    SELECT
      COUNT(*) AS total,

      SUM(
        CASE
          WHEN status = 'new'
          THEN 1
          ELSE 0
        END
      ) AS new_count,

      SUM(
        CASE
          WHEN status = 'contact_requested'
          THEN 1
          ELSE 0
        END
      ) AS contact_requested_count,

      SUM(
        CASE
          WHEN status = 'in_progress'
          THEN 1
          ELSE 0
        END
      ) AS in_progress_count,

      SUM(
        CASE
          WHEN status = 'resolved'
          THEN 1
          ELSE 0
        END
      ) AS resolved_count,

      SUM(
        CASE
          WHEN status = 'closed'
          THEN 1
          ELSE 0
        END
      ) AS closed_count,

      SUM(
        CASE
          WHEN priority = 'high'
               OR priority = 'urgent'
          THEN 1
          ELSE 0
        END
      ) AS important_count

    FROM service_recovery_cases
  `).get();
}


function updateAdminRecoveryCase(
  caseId,
  {
    action = null,
    assignedTo = null,
    solutionNotes = undefined
  } = {}
) {
  const normalizedCaseId =
    text(caseId);

  if (!normalizedCaseId) {
    const error =
      new Error(
        'RECOVERY_CASE_ID_REQUIRED'
      );

    error.statusCode = 400;

    throw error;
  }

  const current =
    db.prepare(`
      SELECT
        *
      FROM service_recovery_cases
      WHERE case_id = ?
      LIMIT 1
    `).get(
      normalizedCaseId
    );

  if (!current) {
    const error =
      new Error(
        'RECOVERY_CASE_NOT_FOUND'
      );

    error.statusCode = 404;

    throw error;
  }

  const normalizedAction =
    text(action);

  const allowedActions =
    new Set([
      'take',
      'contacted',
      'resolved',
      'closed',
      'reopen',
      'defer'
    ]);

  if (
    normalizedAction &&
    !allowedActions.has(
      normalizedAction
    )
  ) {
    const error =
      new Error(
        'RECOVERY_ACTION_INVALID'
      );

    error.statusCode = 400;

    throw error;
  }

  const now =
    new Date().toISOString();

  let status =
    current.status;

  let contactedAt =
    current.contacted_at;

  let resolvedAt =
    current.resolved_at;

  let closedAt =
    current.closed_at;

  if (
    normalizedAction === 'take'
  ) {
    status =
      'in_progress';
  }

  if (
    normalizedAction ===
      'contacted'
  ) {
    status =
      'in_progress';

    contactedAt =
      contactedAt || now;
  }

  if (
    normalizedAction ===
      'resolved'
  ) {
    status =
      'resolved';

    resolvedAt =
      now;
  }

  if (
    normalizedAction ===
      'closed'
  ) {
    status =
      'closed';

    closedAt =
      now;
  }

  if (
    normalizedAction ===
      'defer'
  ) {
    status =
      'deferred';
  }

  if (
    normalizedAction ===
      'reopen'
  ) {
    status =
      current.contact_requested
        ? 'contact_requested'
        : 'new';

    resolvedAt =
      null;

    closedAt =
      null;
  }

  const nextAssignedTo =
    assignedTo === null
      ? current.assigned_to
      : text(
          assignedTo
        ) || null;

  const nextNotes =
    solutionNotes === undefined
      ? current.solution_notes
      : text(
          solutionNotes
        ) || null;

  db.prepare(`
    UPDATE service_recovery_cases
    SET
      status = ?,
      assigned_to = ?,
      solution_notes = ?,
      contacted_at = ?,
      resolved_at = ?,
      closed_at = ?,
      updated_at = ?
    WHERE case_id = ?
  `).run(
    status,
    nextAssignedTo,
    nextNotes,
    contactedAt,
    resolvedAt,
    closedAt,
    now,
    normalizedCaseId
  );

  return db.prepare(`
    SELECT
      *
    FROM service_recovery_cases
    WHERE case_id = ?
    LIMIT 1
  `).get(
    normalizedCaseId
  );
}


db.exec(`CREATE TABLE IF NOT EXISTS outreach_authorizations (
 id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, order_id TEXT NOT NULL, task_id TEXT NOT NULL,
 plan TEXT NOT NULL, candidate_ids_json TEXT NOT NULL, message_sha256 TEXT NOT NULL,
 created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'authorized'
); CREATE INDEX IF NOT EXISTS idx_outreach_auth_task ON outreach_authorizations(task_id,created_at);`);

async function authorizeOutreach(body){
 const taskId=text(body.taskId||body.task_id),orderId=text(body.orderId||body.order_id),key=text(body.idempotencyKey||body.idempotency_key);
 const ids=[...new Set((Array.isArray(body.candidateIds)?body.candidateIds:[]).map(text).filter(Boolean))],message=text(body.message);
 if(!taskId||!orderId||!key||!message||body.explicitConfirm!==true||!ids.length){const e=new Error('OUTREACH_CONFIRMATION_REQUIRED');e.status=400;throw e;}
 const prior=db.prepare('SELECT * FROM outreach_authorizations WHERE idempotency_key=?').get(key); if(prior)return {replayed:true,authorizationId:prior.id,plan:prior.plan,candidateIds:JSON.parse(prior.candidate_ids_json)};
 const pr=await fetch('http://127.0.0.1:8790/v1/payments/'+encodeURIComponent(orderId)),pd=await pr.json().catch(()=>({})),order=pd?.order;
 if(!pr.ok||!pd?.ok||!order||order.status!=='paid'||text(order.taskId)!==taskId){const e=new Error('PAID_ENTITLEMENT_REQUIRED');e.status=403;throw e;}
 const tariff=COMMERCIAL_TARIFFS[basePaymentPlanId(order.plan)]; if(!tariff){const e=new Error('UNKNOWN_TARIFF');e.status=403;throw e;}
 const runs=db.prepare("SELECT id FROM search_runs WHERE task_id=? AND status='ok' ORDER BY created_at").all(taskId); const allowed=new Set();
 for(const run of runs)for(const row of db.prepare('SELECT candidate_id,raw_json FROM candidates WHERE run_id=?').all(run.id)){allowed.add(text(row.candidate_id));try{const c=JSON.parse(row.raw_json);allowed.add(text(c.id||c.candidateId||c.candidate_id));}catch{}}
 if(ids.some(id=>!allowed.has(id))){const e=new Error('CANDIDATE_NOT_IN_TASK_SHORTLIST');e.status=403;throw e;}
 const usedRows=db.prepare('SELECT candidate_ids_json FROM outreach_authorizations WHERE task_id=? AND status=?').all(taskId,'authorized'),used=new Set(); for(const r of usedRows)for(const id of JSON.parse(r.candidate_ids_json))used.add(id); ids.forEach(id=>used.add(id));
 if(used.size>tariff.candidateLimit){const e=new Error('TARIFF_CANDIDATE_LIMIT_REACHED');e.status=403;throw e;}
 const recent=db.prepare("SELECT count(*) n FROM outreach_authorizations WHERE task_id=? AND created_at>=datetime('now','-1 hour')").get(taskId); if(Number(recent?.n||0)>=20){const e=new Error('OUTREACH_RATE_LIMITED');e.status=429;throw e;}
 const id='oa_'+crypto.randomUUID(),sha=crypto.createHash('sha256').update(message).digest('hex'),createdAt=new Date().toISOString();
 db.prepare('INSERT INTO outreach_authorizations(id,idempotency_key,order_id,task_id,plan,candidate_ids_json,message_sha256,created_at,status) VALUES(?,?,?,?,?,?,?,?,?)').run(id,key,orderId,taskId,tariff.id,JSON.stringify(ids),sha,createdAt,'authorized');
 return {replayed:false,authorizationId:id,plan:tariff.id,candidateLimit:tariff.candidateLimit,candidateIds:ids,messageSha256:sha};
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';

  if (req.method === 'OPTIONS') {
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return sendJson(
        res,
        403,
        { ok: false, error: 'ORIGIN_NOT_ALLOWED' }
      );
    }

    res.writeHead(204, {
      'Access-Control-Allow-Origin':
        origin || 'https://onsdelaet.ru',
      'Access-Control-Allow-Methods':
        'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers':
        'content-type',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '600',
      'Vary': 'Origin'
    });

    return res.end();
  }

  if (await customerAuth.handle(req, res, origin)) {
    return;
  }

  if (await customerAccount.handle(req, res, origin)) {
    return;
  }

  if(req.method==='POST'&&req.url==='/v1/outreach/authorize'){try{const body=await readBody(req);const result=await authorizeOutreach(body);return sendJson(res,200,{ok:true,authorized:true,...result},origin);}catch(error){return sendJson(res,Number(error?.status||500),{ok:false,authorized:false,error:error?.message||'OUTREACH_AUTH_FAILED'},origin);}}

  if (
    req.url?.startsWith('/v1/outreach/') &&
      !/^\/v1\/outreach\/[^/?]+\/replies$/.test(
        req.url
      )
  ) {
    const handled =
      await handleOutreach(
        req,
        res,
        { sendJson, origin }
      );

    if (handled) return;
  }

  if (
    req.method === 'GET' &&
    req.url === '/health'
  ) {
    return sendJson(
      res,
      200,
      {
        ok: true,
        service: 'sdelaet-api',
        version: '0.2.0',
        providers: {
          yandexSearch: Boolean(
            process.env.YANDEX_SEARCH_API_KEY &&
            process.env.YANDEX_FOLDER_ID
          ),
          dgis: Boolean(
            process.env.DGIS_API_KEY
          )
        },
        database: 'ok'
      },
      origin
    );
  }

  if (
    req.method === 'POST' &&
    req.url === '/v1/orders/prepare'
  ) {
    try {
      const result =
        await prepareOrder(req);

      sendJson(
        res,
        200,
        result,
        origin
      );

    } catch (error) {
      console.error(
        '[orders.prepare]',
        error
      );

      sendJson(
        res,
        Number(
          error?.statusCode ||
          500
        ),
        {
          ok: false,

          error:
            error?.message ||
            'ORDER_PREPARE_FAILED'
        },
        origin
      );
    }

    return;
  }


  if (
    req.method === 'POST' &&
    req.url === '/v1/tasks/select-contractor'
  ) {
    try {
      const body =
        await readBody(req);

      const selected =
        selectTaskContractor({
          taskId:
            body.task_id ||
            body.taskId,

          candidateId:
            body.candidate_id ||
            body.candidateId,

          candidateName:
            body.candidate_name ||
            body.candidateName
        });

      return sendJson(
        res,
        200,
        {
          ok: true,

          task_id:
            selected.taskId,

          candidate_id:
            selected.candidateId,

          candidate_name:
            selected.candidateName,

          selected_at:
            selected.selectedAt
        },
        origin
      );

    } catch (error) {
      return sendJson(
        res,
        error.statusCode ||
        error.status ||
        500,
        {
          ok: false,

          error:
            error?.message ||
            'CONTRACTOR_SELECTION_FAILED'
        },
        origin
      );
    }
  }


  if (
    req.method === 'POST' &&
    req.url === '/v1/telegram/webhook'
  ) {
    try {
      const secret =
        text(
          req.headers[
            'x-telegram-bot-api-secret-token'
          ]
        );

      if (
        !TELEGRAM_WEBHOOK_SECRET ||
        secret !==
          TELEGRAM_WEBHOOK_SECRET
      ) {
        return sendJson(
          res,
          403,
          {
            ok: false,
            error:
              'INVALID_TELEGRAM_WEBHOOK_SECRET'
          },
          origin
        );
      }

      const body =
        await readBody(req);

      const result =
        await handleTelegramWebhook(
          body
        );

      return sendJson(
        res,
        200,
        result,
        origin
      );

    } catch (error) {
      return sendJson(
        res,
        500,
        {
          ok: false,
          error:
            error?.message ||
            'TELEGRAM_WEBHOOK_FAILED'
        },
        origin
      );
    }
  }


  if (
    req.method === 'POST' &&
    req.url === '/v1/telegram/link'
  ) {
    try {
      const body =
        await readBody(req);

      const link =
        createTelegramLink({
          taskId:
            body.task_id ||
            body.taskId,

          orderId:
            body.order_id ||
            body.orderId
        });

      return sendJson(
        res,
        200,
        {
          ok: true,

          telegram_url:
            link.url,

          expires_at:
            link.expiresAt
        },
        origin
      );

    } catch (error) {
      return sendJson(
        res,
        error.statusCode ||
        error.status ||
        500,
        {
          ok: false,

          error:
            error.message ||
            'TELEGRAM_LINK_FAILED'
        },
        origin
      );
    }
  }


  if (req.method === 'POST' && req.url === '/v1/shortlists/prepared') {
    try { const body=await readBody(req),taskId=text(body.taskId||body.task_id); if(!taskId)return sendJson(res,400,{ok:false,error:'TASK_ID_REQUIRED'},origin); const run=db.prepare(`SELECT id,created_at,candidate_count FROM search_runs WHERE task_id=? AND status='ok' AND candidate_count>0 AND COALESCE(previous_run_id,'')='' ORDER BY created_at DESC LIMIT 1`).get(taskId); if(!run)return sendJson(res,200,{ok:true,prepared:false,taskId},origin); const rows=db.prepare(`SELECT raw_json FROM candidates WHERE run_id=? ORDER BY rowid`).all(run.id); let sourceCount=0,strongCount=0; const sources=new Set(); for(const row of rows){try{const c=JSON.parse(row.raw_json); for(const x of (c.sources||[]))sources.add(x.sourceName||x.name||x.sourceType||x.type||'source'); if(c.matchLevel==='strong'||c.matchLevel==='high')strongCount++;}catch{}} sourceCount=sources.size; return sendJson(res,200,{ok:true,prepared:true,taskId,runId:run.id,generatedAt:run.created_at,count:run.candidate_count,sourceCount,strongCount},origin); } catch(error){return sendJson(res,500,{ok:false,error:error?.message||'SHORTLIST_READ_FAILED'},origin);}
  }

  if (req.method === 'POST' && req.url === '/v1/shortlists/unlocked') {
    try { const body=await readBody(req),taskId=text(body.taskId||body.task_id),orderId=text(body.orderId||body.order_id); if(!taskId||!orderId)return sendJson(res,400,{ok:false,error:'TASK_AND_ORDER_REQUIRED'},origin); const pr=await fetch('http://127.0.0.1:8790/v1/payments/'+encodeURIComponent(orderId)); const pd=await pr.json().catch(()=>({})); const order=pd?.order; if(!pr.ok||!pd?.ok||!order||order.status!=='paid'||text(order.taskId)!==taskId||!['find','choice'].includes(basePaymentPlanId(order.plan)))return sendJson(res,403,{ok:false,unlocked:false,error:'PAID_ENTITLEMENT_REQUIRED'},origin); const run=db.prepare(`SELECT id,created_at,candidate_count FROM search_runs WHERE task_id=? AND status='ok' AND candidate_count>0 AND COALESCE(previous_run_id,'')='' ORDER BY created_at DESC LIMIT 1`).get(taskId); if(!run)return sendJson(res,404,{ok:false,unlocked:false,error:'SHORTLIST_NOT_FOUND'},origin); const rows=db.prepare(`SELECT raw_json FROM candidates WHERE run_id=? ORDER BY rowid`).all(run.id); const allCandidates=rows.map(r=>{try{return JSON.parse(r.raw_json)}catch{return null}}).filter(Boolean); const tariff=COMMERCIAL_TARIFFS[basePaymentPlanId(order.plan)]; if(!tariff)return sendJson(res,403,{ok:false,unlocked:false,error:'UNKNOWN_TARIFF'},origin); const seen=new Set(),unique=[]; for(const c of allCandidates){const key=text(c.companyId||c.company_id||c.id||c.candidateId||c.candidate_id||c.website||c.url||c.phone||c.email||c.name).toLowerCase(); if(!key||seen.has(key))continue;seen.add(key);unique.push(c);} const candidates=unique.slice(0,tariff.candidateLimit); return sendJson(res,200,{ok:true,unlocked:true,taskId,orderId,plan:order.plan,limits:{candidateLimit:tariff.candidateLimit,additionalSearchLimit:tariff.additionalSearchLimit,searchPolicy:tariff.searchPolicy},runId:run.id,generatedAt:run.created_at,marketCount:unique.length,count:candidates.length,hasMore:unique.length>candidates.length,candidates},origin); } catch(error){return sendJson(res,500,{ok:false,unlocked:false,error:error?.message||'ENTITLEMENT_CHECK_FAILED'},origin);}
  }


  if (
    req.method === 'POST' &&
    req.url === '/v1/taxonomy/signals'
  ) {
    try {
      const body = await readBody(req);
      const saved = saveTaxonomySignal(body);
      return sendJson(
        res,
        201,
        { ok: true, saved: true, ...saved },
        origin
      );
    } catch (error) {
      return sendJson(
        res,
        error.status || error.statusCode || 500,
        { ok: false, saved: false, error: error.message || 'TAXONOMY_SIGNAL_FAILED' },
        origin
      );
    }
  }


  if (
    req.method === 'POST' &&
    req.url === '/v1/candidates/contact-refresh'
  ) {
    try {
      const body = await readBody(req);
      const taskId = text(body.taskId || body.task_id);
      const candidateId = text(body.candidateId || body.candidate_id);

      if (!taskId || !candidateId) {
        return sendJson(
          res,
          400,
          { ok: false, error: 'TASK_AND_CANDIDATE_REQUIRED' },
          origin
        );
      }

      const row = db.prepare(`
        SELECT
          c.rowid AS candidate_rowid,
          c.raw_json,
          c.website
        FROM candidates c
        INNER JOIN search_runs sr
          ON sr.id = c.run_id
        WHERE sr.task_id = ?
          AND c.candidate_id = ?
        ORDER BY sr.created_at DESC
        LIMIT 1
      `).get(taskId, candidateId);

      if (!row) {
        return sendJson(
          res,
          404,
          { ok: false, error: 'CANDIDATE_NOT_IN_TASK' },
          origin
        );
      }

      let candidate = {};
      try {
        candidate = JSON.parse(row.raw_json || '{}');
      } catch {}

      const website = text(row.website || candidate.website);

      if (!website) {
        return sendJson(
          res,
          200,
          {
            ok: true,
            candidateId,
            telegram: '',
            telegrams: [],
            telegramStatus: 'no_website'
          },
          origin
        );
      }

      const crawl = await crawlCompanySite(website);

      if (!crawl?.ok) {
        return sendJson(
          res,
          200,
          {
            ok: true,
            candidateId,
            telegram: '',
            telegrams: [],
            telegramStatus: 'crawl_failed'
          },
          origin
        );
      }

      candidate.telegramStatus =
        crawl.telegrams?.length
          ? 'found'
          : 'not_found';

      if (crawl.telegrams?.length) {
        candidate.telegram = crawl.telegrams[0];
        candidate.telegrams = crawl.telegrams;

        const source =
          (crawl.telegramSources || [])
            .find(item =>
              item.telegram === crawl.telegrams[0]
            );

        candidate.telegramSourceUrl =
          source?.url || crawl.sourceUrl;

        candidate.telegramSourceLabel =
          source?.url
            ? 'Официальный сайт · Telegram'
            : 'Официальный сайт';
      }

      if (!candidate.email && crawl.emails?.length) {
        candidate.email = crawl.emails[0];
        candidate.emails = crawl.emails;
        candidate.emailStatus = 'found';
      }

      db.prepare(
        'UPDATE candidates SET raw_json = ? WHERE rowid = ?'
      ).run(
        JSON.stringify(candidate),
        row.candidate_rowid
      );

      return sendJson(
        res,
        200,
        {
          ok: true,
          candidateId,
          telegram: candidate.telegram || '',
          telegrams: candidate.telegrams || [],
          telegramStatus: candidate.telegramStatus,
          telegramSourceUrl: candidate.telegramSourceUrl || '',
          telegramSourceLabel: candidate.telegramSourceLabel || '',
          email: candidate.email || ''
        },
        origin
      );
    } catch (error) {
      return sendJson(
        res,
        error.status || 500,
        {
          ok: false,
          error:
            error.message ||
            'CONTACT_REFRESH_FAILED'
        },
        origin
      );
    }
  }


  if (
    req.method === 'POST' &&
    req.url === '/v1/candidates/search'
  ) {
    try {
      const body = await readBody(req);

      const entitlement =
        searchOrderEntitlement({
          orderId:
            body.orderId ||
            body.order_id,

          taskId:
            body.taskId ||
            body.task_id,

          refinement:
            body.refinement
        });

      const result =
        await performSearch(body);

      result.entitlement = {
        refinement:
          entitlement.refinement,

        tariffId:
          entitlement.tariff?.id ||
          null
      };

      const runId = saveSearchRun(result, body);

      updateTaskLifecycle(
        body.taskId ||
        body.task_id,
        body.refinement
          ? 'refined_search'
          : 'search_completed'
      );

      if (!body.refinement) {
        scheduleSelectionFollowup(
          body.taskId ||
          body.task_id,
          'search_completed'
        );
      }

      return sendJson(
        res,
        200,
        {
          ok: true,
          runId,
          count: result.candidates.length,
          providers: result.providers,
          selection: result.selection,
          searchMeta: result.searchMeta,
          candidates: result.candidates,
          generatedAt: new Date().toISOString()
        },
        origin
      );
    } catch (error) {
      let status = error.status || 500;

      if (error.message === 'BAD_JSON') status = 400;
      if (error.message === 'PAYLOAD_TOO_LARGE') status = 413;

      const messages = {
        SEARCH_NOT_CONFIGURED:
          'Поисковые провайдеры ещё не настроены.',
        CITY_REQUIRED:
          'Нужен город или район для поиска.',
        CATEGORY_NOT_SUPPORTED:
          'Категория пока не подключена к автоматическому поиску.',
        BAD_JSON:
          'Некорректный JSON.',
        PAYLOAD_TOO_LARGE:
          'Запрос слишком большой.',

        ORDER_REQUIRED_FOR_REFINEMENT:
          'Повторный поиск доступен после выбора подходящего тарифа.',

        ORDER_NOT_FOUND:
          'Заказ для повторного поиска не найден.',

        ORDER_TASK_MISMATCH:
          'Этот заказ относится к другой задаче.',

        REFINEMENT_NOT_INCLUDED:
          'Повторный поиск не входит в выбранный тариф.'
      };

      return sendJson(
        res,
        status,
        {
          ok: false,
          error: error.message || 'SEARCH_FAILED',
          message:
            messages[error.message] ||
            'Не удалось выполнить поиск.'
        },
        origin
      );
    }
  }


    const outreachReplyMatch =
      req.url
        ? req.url.match(
            /^\/v1\/outreach\/([^/?]+)\/replies$/
          )
        : null;

    if (
      req.method === 'POST' &&
      outreachReplyMatch
    ) {
      try {
        const requestId =
          decodeURIComponent(
            outreachReplyMatch[1]
          );

        const body =
          await readBody(req);

        const result =
          processContractorReply(
            db,
            {
              requestId,

              rawText:
                body.raw_text ??
                body.rawText ??
                body.text,

              channel:
                body.channel,

              externalMessageId:
                body.external_message_id ??
                body.externalMessageId,

              receivedAt:
                body.received_at ??
                body.receivedAt,

              metadata:
                body.metadata || {}
            }
          );

        return sendJson(
          res,
          201,
          {
            ok: true,
            ...result
          },
          origin
        );

      } catch (error) {
        return sendJson(
          res,
          error.statusCode || 500,
          {
            ok: false,

            error:
              error.message ||
              'OFFER_REPLY_FAILED'
          },
          origin
        );
      }
    }

    const preparedComparisonMatch=req.url?req.url.match(/^\/v1\/tasks\/([^/?]+)\/prepared-comparison$/):null;
    if(req.method==='GET'&&preparedComparisonMatch){const taskId=decodeURIComponent(preparedComparisonMatch[1]);const offers=listTaskOffers(db,taskId);const comparison=compareNormalizedOffers(offers);return sendJson(res,200,{ok:true,task_id:taskId,prepared:comparison.ready,generated_at:new Date().toISOString(),source:{offer_count:offers.length,latest_versions_only:true},comparison},origin);}

    const dialogueHistoryMatch = req.url ? req.url.match(/^\/v1\/offer-dialogues\/([^/?]+)$/) : null;
    if (req.method === 'GET' && dialogueHistoryMatch) { const requestId=decodeURIComponent(dialogueHistoryMatch[1]); return sendJson(res,200,{ok:true,...getOfferDialogueHistory(db,requestId)},origin); }

    const taskOffersMatch =
      req.url
        ? req.url.match(
            /^\/v1\/tasks\/([^/?]+)\/offers$/
          )
        : null;

    if (
      req.method === 'GET' &&
      taskOffersMatch
    ) {
      try {
        const taskId =
          decodeURIComponent(
            taskOffersMatch[1]
          );

        const offers =
          listTaskOffers(
            db,
            taskId
          );

        return sendJson(
          res,
          200,
          {
            ok: true,
            task_id: taskId,
            count: offers.length,
            offers
          },
          origin
        );

      } catch (error) {
        return sendJson(
          res,
          500,
          {
            ok: false,

            error:
              error.message ||
              'OFFER_LIST_FAILED'
          },
          origin
        );
      }
    }

  /*
   * Private administration API.
   *
   * Public api.onsdelaet.ru/v1/admin/*
   * is blocked by nginx.
   *
   * Requests are accepted only through
   * the authenticated same-origin
   * /admin-api/ nginx proxy, which adds
   * X-Sdelaet-Admin-Secret.
   */
  if (
    req.method === 'GET' &&
    req.url === '/v1/admin/taxonomy/signals'
  ) {
    try {
      requireAdminRequest(req);
      const data = listTaxonomySignalsReport();
      return sendJson(
        res,
        200,
        { ok: true, report: 'Неопознанные услуги', ...data },
        origin
      );
    } catch (error) {
      return sendJson(
        res,
        error.statusCode || error.status || 500,
        { ok: false, error: error.message || 'TAXONOMY_REPORT_FAILED' },
        origin
      );
    }
  }


  if (
    req.method === 'GET' &&
    req.url ===
      '/v1/admin/recovery'
  ) {
    try {
      requireAdminRequest(req);

      const cases =
        listAdminRecoveryCases();

      const stats =
        adminRecoveryStats();

      return sendJson(
        res,
        200,
        {
          ok: true,
          stats,
          cases,
          generated_at:
            new Date()
              .toISOString()
        },
        origin
      );

    } catch (error) {
      return sendJson(
        res,
        error.statusCode || 500,
        {
          ok: false,

          error:
            error?.message ||
            'ADMIN_RECOVERY_LIST_FAILED'
        },
        origin
      );
    }
  }


  const adminRecoveryMatch =
    req.url
      ? req.url.match(
          /^\/v1\/admin\/recovery\/([^/?]+)$/
        )
      : null;

  if (
    req.method === 'POST' &&
    adminRecoveryMatch
  ) {
    try {
      requireAdminRequest(req);

      const caseId =
        decodeURIComponent(
          adminRecoveryMatch[1]
        );

      const body =
        await readBody(req);

      const updated =
        updateAdminRecoveryCase(
          caseId,
          {
            action:
              body.action,

            assignedTo:
              body.assigned_to ??
              body.assignedTo ??
              null,

            solutionNotes:
              Object.prototype
                .hasOwnProperty.call(
                  body,
                  'solution_notes'
                )
                ? body.solution_notes
                : Object.prototype
                    .hasOwnProperty.call(
                      body,
                      'solutionNotes'
                    )
                  ? body.solutionNotes
                  : undefined
          }
        );

      return sendJson(
        res,
        200,
        {
          ok: true,
          case: updated
        },
        origin
      );

    } catch (error) {
      return sendJson(
        res,
        error.statusCode || 500,
        {
          ok: false,

          error:
            error?.message ||
            'ADMIN_RECOVERY_UPDATE_FAILED'
        },
        origin
      );
    }
  }


  return sendJson(
    res,
    404,
    {
      ok: false,
      error: 'NOT_FOUND'
    },
    origin
  );
});

server.listen(PORT, HOST, () => {
  console.log(
    `Sdelaet API v0.2.0 listening on ${HOST}:${PORT}`
  );
});
