import crypto from 'node:crypto';
import { createConnection } from 'node:net';
import { DatabaseSync } from 'node:sqlite';

const DB_PATH =
  process.env.DB_PATH ||
  '/var/lib/sdelaet/db/sdelaet.sqlite';

const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA foreign_keys=ON;

  CREATE TABLE IF NOT EXISTS outreach_attempts (
    request_id TEXT PRIMARY KEY,
    reply_token TEXT NOT NULL UNIQUE,

    task_id TEXT,
    search_run_id TEXT,
    authorization_id TEXT,

    candidate_id TEXT NOT NULL,
    candidate_name TEXT NOT NULL,
    candidate_type TEXT NOT NULL,

    channel TEXT NOT NULL,
    recipient TEXT,

    sent_by TEXT,

    from_email TEXT,
    reply_to TEXT,

    subject TEXT NOT NULL,
    body_text TEXT NOT NULL,

    status TEXT NOT NULL,

    prepared_at TEXT NOT NULL,
    sent_at TEXT,
    delivered_at TEXT,
    replied_at TEXT,
    failed_at TEXT,

    external_message_id TEXT,
    last_error TEXT,

    metadata_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS idx_outreach_candidate
    ON outreach_attempts(candidate_id, prepared_at);

  CREATE INDEX IF NOT EXISTS idx_outreach_task
    ON outreach_attempts(task_id, prepared_at);

  CREATE TABLE IF NOT EXISTS outreach_events (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    actor TEXT,
    occurred_at TEXT NOT NULL,
    data_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS idx_outreach_events_request
    ON outreach_events(request_id, occurred_at);

  CREATE TABLE IF NOT EXISTS inbound_messages (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,

    provider TEXT NOT NULL,
    provider_email_id TEXT UNIQUE,
    provider_message_id TEXT,

    from_email TEXT,
    to_email TEXT,
    subject TEXT,

    text_body TEXT,
    html_body TEXT,

    attachments_json TEXT NOT NULL DEFAULT '[]',

    received_at TEXT NOT NULL,
    raw_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS idx_inbound_request
    ON inbound_messages(request_id, received_at);
`);

const outreachAttemptColumns = new Set(
  db.prepare('PRAGMA table_info(outreach_attempts)').all().map(row => row.name)
);
if (!outreachAttemptColumns.has('authorization_id')) {
  db.exec(`ALTER TABLE outreach_attempts ADD COLUMN authorization_id TEXT`);
}
db.exec(`CREATE INDEX IF NOT EXISTS idx_outreach_authorization ON outreach_attempts(authorization_id,candidate_id,channel)`);

function now() {
  return new Date().toISOString();
}

function newId(prefix) {
  return (
    prefix +
    '_' +
    Date.now().toString(36) +
    '_' +
    crypto.randomBytes(6).toString('base64url')
  );
}

function newReplyToken() {
  return crypto
    .randomBytes(12)
    .toString('base64url')
    .toLowerCase();
}

async function readRawBody(req, max = 512 * 1024) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;

    if (total > max) {
      throw new Error('PAYLOAD_TOO_LARGE');
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf8');
}

async function readJsonBody(req) {
  const raw = await readRawBody(req);

  try {
    return JSON.parse(raw || '{}');
  } catch {
    throw new Error('BAD_JSON');
  }
}

function addEvent(
  requestId,
  eventType,
  actor = '',
  data = {}
) {
  db.prepare(`
    INSERT INTO outreach_events
      (
        id,
        request_id,
        event_type,
        actor,
        occurred_at,
        data_json
      )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    newId('evt'),
    requestId,
    eventType,
    actor,
    now(),
    JSON.stringify(data || {})
  );
}

function getAttempt(requestId) {
  return db.prepare(`
    SELECT *
    FROM outreach_attempts
    WHERE request_id = ?
  `).get(requestId);
}

function safeAttempt(row) {
  if (!row) return null;

  return {
    requestId: row.request_id,
    taskId: row.task_id,
    searchRunId: row.search_run_id,
    authorizationId: row.authorization_id,
    candidateId: row.candidate_id,
    candidateName: row.candidate_name,
    candidateType: row.candidate_type,
    channel: row.channel,
    recipient: row.recipient,
    replyTo: row.reply_to,
    status: row.status,
    preparedAt: row.prepared_at,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    repliedAt: row.replied_at,
    failedAt: row.failed_at
  };
}

function cleanHeader(value) {
  const text = String(value || '').trim();

  if (/[\r\n]/.test(text)) {
    throw new Error('INVALID_EMAIL_HEADER');
  }

  return text;
}

function encodeHeader(value) {
  const text = cleanHeader(value);

  if (/^[\x20-\x7e]*$/.test(text)) {
    return text;
  }

  return (
    '=?UTF-8?B?' +
    Buffer.from(text, 'utf8').toString('base64') +
    '?='
  );
}

function encodeMailbox(value) {
  const text = cleanHeader(value);
  const match = text.match(/^(.*?)\s*<([^<>]+)>$/);

  if (!match) {
    return text;
  }

  const name = match[1].trim();
  const email = match[2].trim();

  return name
    ? `${encodeHeader(name)} <${email}>`
    : `<${email}>`;
}

function validEmail(value) {
  return /^[^\s@<>]+@[^\s@<>]+$/.test(
    String(value || '').trim()
  );
}

function authorizationError(code,status=403) { const error=new Error(code); error.status=status; return error; }
function parseAuthorizationTargets(auth) { try { const value=JSON.parse(auth?.targets_json||'[]'); return Array.isArray(value)?value:[]; } catch { return []; } }
function canonicalAuthorizedChannel(channel) { const value=String(channel||'').trim(); return value==='messenger'?'telegram':value; }
function assertAuthorizedTarget(auth,{taskId,candidateId,channel,recipient='',telegram='',message=''}) {
  if(!auth) throw authorizationError('OUTREACH_AUTHORIZATION_INVALID');
  if(String(auth.task_id||'')!==String(taskId||'')) throw authorizationError('OUTREACH_AUTHORIZATION_TASK_MISMATCH');
  const ids=new Set(JSON.parse(auth.candidate_ids_json||'[]').map(String));
  if(!ids.has(String(candidateId||''))) throw authorizationError('OUTREACH_AUTHORIZATION_CANDIDATE_MISMATCH');
  const sha=crypto.createHash('sha256').update(String(message||'')).digest('hex');
  if(sha!==String(auth.message_sha256||'')) throw authorizationError('OUTREACH_AUTHORIZATION_MESSAGE_MISMATCH');
  const target=parseAuthorizationTargets(auth).find(x=>String(x?.candidateId||'')===String(candidateId||''));
  if(!target) throw authorizationError('OUTREACH_AUTHORIZATION_TARGET_MISSING');
  const canonical=canonicalAuthorizedChannel(channel);
  const channels=new Set((Array.isArray(target.channels)?target.channels:[]).map(String));
  if(!channels.has(canonical)) throw authorizationError('OUTREACH_AUTHORIZATION_CHANNEL_MISMATCH');
  if(canonical==='email') {
    if(String(target.email||'').trim().toLowerCase()!==String(recipient||'').trim().toLowerCase()) throw authorizationError('OUTREACH_AUTHORIZATION_RECIPIENT_MISMATCH');
  }
  if(canonical==='telegram') {
    if(String(target.telegram||'').trim()!==String(telegram||'').trim()) throw authorizationError('OUTREACH_AUTHORIZATION_RECIPIENT_MISMATCH');
  }
  return target;
}

function sendViaLocalExim({
  envelopeFrom,
  recipient,
  message
}) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({
      host: '127.0.0.1',
      port: 25
    });

    let buffer = '';
    let step = 0;
    let finished = false;

    const commands = [
      () => 'EHLO onsdelaet.local\r\n',
      () => `MAIL FROM:<${envelopeFrom}>\r\n`,
      () => `RCPT TO:<${recipient}>\r\n`,
      () => 'DATA\r\n',
      () => {
        const stuffed = message
          .replace(/\r?\n/g, '\r\n')
          .replace(/(^|\r\n)\./g, '$1..');

        return stuffed + '\r\n.\r\n';
      },
      () => 'QUIT\r\n'
    ];

    function fail(text) {
      if (finished) return;
      finished = true;
      socket.destroy();

      const error = new Error(
        'LOCAL_SMTP_ERROR: ' + text
      );

      error.status = 503;
      reject(error);
    }

    function succeed() {
      if (finished) return;
      finished = true;
      socket.end();
      resolve();
    }

    function sendNext() {
      if (step >= commands.length) {
        succeed();
        return;
      }

      socket.write(commands[step]());
      step += 1;
    }

    socket.setTimeout(15000);

    socket.on('timeout', () => {
      fail('timeout');
    });

    socket.on('error', error => {
      fail(error.message || String(error));
    });

    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!/^\d{3}[ -]/.test(line)) {
          continue;
        }

        if (/^\d{3}-/.test(line)) {
          continue;
        }

        const code = Number(line.slice(0, 3));

        if (step === 0) {
          if (code !== 220) {
            fail(line);
            return;
          }

          sendNext();
          continue;
        }

        if (step === 4) {
          if (code !== 354) {
            fail(line);
            return;
          }

          sendNext();
          continue;
        }

        if (step === 6) {
          if (code !== 221) {
            fail(line);
            return;
          }

          succeed();
          return;
        }

        if (code < 200 || code >= 300) {
          fail(line);
          return;
        }

        sendNext();
      }
    });
  });
}

async function prepare(body) {
  const candidate = body.candidate || {};
  const authorizationId=String(body.authorizationId||'').trim();
  if(!authorizationId){const error=new Error('OUTREACH_AUTHORIZATION_REQUIRED');error.status=403;throw error;}
  const auth=db.prepare('SELECT * FROM outreach_authorizations WHERE id=? AND status=? LIMIT 1').get(authorizationId,'authorized');
  if(!auth){const error=new Error('OUTREACH_AUTHORIZATION_INVALID');error.status=403;throw error;}
  if(String(auth.task_id||'')!==String(body.taskId||'')){const error=new Error('OUTREACH_AUTHORIZATION_TASK_MISMATCH');error.status=403;throw error;}
  const authorizedIds=new Set(JSON.parse(auth.candidate_ids_json||'[]').map(String));

  const candidateId =
    String(candidate.id || body.candidateId || '').trim();

  if(!authorizedIds.has(candidateId)){const error=new Error('OUTREACH_AUTHORIZATION_CANDIDATE_MISMATCH');error.status=403;throw error;}

  const candidateName =
    String(candidate.name || '').trim();

  const candidateType =
    String(candidate.type || 'unverified').trim();

  const channel =
    String(body.channel || '').trim();

  const allowedChannels = new Set([
    'email',
    'yandex_services',
    'avito',
    'phone',
    'messenger',
    'manual'
  ]);

  if (
    !candidateId ||
    !candidateName ||
    !allowedChannels.has(channel)
  ) {
    const error = new Error('INVALID_OUTREACH_REQUEST');
    error.status = 400;
    throw error;
  }

  const subject =
    String(body.subject || '').trim();

  const message =
    String(body.message || '').trim();

  if (!subject || !message) {
    const error = new Error('MESSAGE_REQUIRED');
    error.status = 400;
    throw error;
  }

  const messageSha=crypto.createHash('sha256').update(message).digest('hex');
  if(messageSha!==String(auth.message_sha256||'')){const error=new Error('OUTREACH_AUTHORIZATION_MESSAGE_MISMATCH');error.status=403;throw error;}

  const recipient =
    channel === 'email'
      ? String(
          body.recipient ||
          candidate.email ||
          ''
        ).trim()
      : '';

  if (channel === 'email' && !recipient) {
    const error = new Error('EMAIL_REQUIRED');
    error.status = 400;
    throw error;
  }

  const telegram = String(body.metadata?.telegram || '').trim();
  assertAuthorizedTarget(auth,{taskId:body.taskId,candidateId,channel,recipient,telegram,message});
  const existing=db.prepare(`SELECT * FROM outreach_attempts WHERE authorization_id=? AND candidate_id=? AND channel=? ORDER BY prepared_at DESC LIMIT 1`).get(authorizationId,candidateId,channel);
  if(existing)return existing;

  const requestId = newId('req');
  const replyToken = newReplyToken();

  const replyTo =
    process.env.EMAIL_REPLY_TO ||
    'requests@onsdelaet.ru';

  const preparedAt = now();

  db.prepare(`
    INSERT INTO outreach_attempts
      (
        request_id,
        reply_token,

        task_id,
        search_run_id,
        authorization_id,

        candidate_id,
        candidate_name,
        candidate_type,

        channel,
        recipient,

        sent_by,

        from_email,
        reply_to,

        subject,
        body_text,

        status,
        prepared_at,

        metadata_json
      )
    VALUES (
      ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?,
      ?, ?,
      ?, ?,
      ?, ?,
      ?
    )
  `).run(
    requestId,
    replyToken,

    String(body.taskId || ''),
    String(body.searchRunId || ''),
    authorizationId,

    candidateId,
    candidateName,
    candidateType,

    channel,
    recipient,

    '',

    process.env.EMAIL_FROM ||
      'Сделает <requests@onsdelaet.ru>',

    replyTo,

    subject,
    message,

    'prepared',
    preparedAt,

    JSON.stringify(body.metadata || {})
  );

  addEvent(
    requestId,
    'prepared',
    'user',
    { channel }
  );

  return getAttempt(requestId);
}

async function sendEmail(requestId) {
  const row = getAttempt(requestId);

  if (!row) {
    const error =
      new Error('REQUEST_NOT_FOUND');

    error.status = 404;
    throw error;
  }

  if (row.channel !== 'email') {
    const error =
      new Error('EMAIL_CHANNEL_REQUIRED');

    error.status = 400;
    throw error;
  }

  if (
    row.status === 'sent' &&
    row.external_message_id
  ) {
    return row;
  }

  if (!validEmail(row.recipient)) {
    const error =
      new Error('INVALID_RECIPIENT_EMAIL');

    error.status = 400;
    throw error;
  }

  const envelopeFrom =
    process.env.EMAIL_ENVELOPE_FROM ||
    'requests@onsdelaet.ru';

  if (!validEmail(envelopeFrom)) {
    throw new Error(
      'INVALID_EMAIL_ENVELOPE_FROM'
    );
  }

  const fromHeader =
    encodeMailbox(
      row.from_email ||
      process.env.EMAIL_FROM ||
      'Сделает <requests@onsdelaet.ru>'
    );

  const replyTo =
    cleanHeader(
      row.reply_to ||
      'requests@onsdelaet.ru'
    );

  if (!validEmail(replyTo)) {
    throw new Error(
      'INVALID_EMAIL_REPLY_TO'
    );
  }

  const token =
    String(row.reply_token || '')
      .replace(
        /[^a-zA-Z0-9_-]/g,
        ''
      );

  if (!token) {
    throw new Error(
      'INVALID_REPLY_TOKEN'
    );
  }

  const messageId =
    `<sdelaet-${token}@onsdelaet.ru>`;

  const subject =
    encodeHeader(row.subject);

  const body =
    String(row.body_text || '')
      .replace(/\r?\n/g, '\r\n');

  const message = [
    `From: ${fromHeader}`,
    `To: ${cleanHeader(row.recipient)}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `X-Sdelaet-Request-ID: ${cleanHeader(requestId)}`,
    `X-Sdelaet-Reply-Token: ${token}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
    ''
  ].join('\r\n');

  try {
    await sendViaLocalExim({
      envelopeFrom,
      recipient: row.recipient,
      message
    });

    const sentAt = now();

    db.prepare(`
      UPDATE outreach_attempts
      SET
        status = 'sent',
        sent_by = 'sdelaet',
        sent_at = COALESCE(sent_at, ?),
        external_message_id = ?,
        last_error = NULL
      WHERE request_id = ?
    `).run(
      sentAt,
      messageId,
      requestId
    );

    addEvent(
      requestId,
      'sent',
      'sdelaet',
      {
        channel: 'email',
        provider: 'local_exim',
        messageId
      }
    );

    return getAttempt(requestId);
  } catch (error) {
    db.prepare(`
      UPDATE outreach_attempts
      SET
        status = 'failed',
        failed_at = ?,
        last_error = ?
      WHERE request_id = ?
    `).run(
      now(),
      String(error.message || error),
      requestId
    );

    addEvent(
      requestId,
      'failed',
      'sdelaet',
      {
        channel: 'email',
        provider: 'local_exim',
        error:
          String(error.message || error)
      }
    );

    throw error;
  }
}

export async function handleOutreach(
  req,
  res,
  { sendJson, origin }
) {
  const url = new URL(
    req.url,
    'http://127.0.0.1'
  );


  if (
    !url.pathname.startsWith(
      '/v1/outreach/'
    )
  ) {
    return false;
  }

  try {
    if (
      req.method === 'POST' &&
      url.pathname ===
        '/v1/outreach/prepare'
    ) {
      const body = await readJsonBody(req);
      const row = await prepare(body);

      sendJson(
        res,
        200,
        {
          ok: true,
          outreach: safeAttempt(row)
        },
        origin
      );

      return true;
    }

    if (
      req.method === 'POST' &&
      url.pathname ===
        '/v1/outreach/email/send'
    ) {
      const body = await readJsonBody(req);
      const requestId=String(body.requestId||''),authorizationId=String(body.authorizationId||'');
      if(!authorizationId){const error=new Error('OUTREACH_AUTHORIZATION_REQUIRED');error.status=403;throw error;}
      const attempt=getAttempt(requestId);
      if(!attempt){const error=new Error('REQUEST_NOT_FOUND');error.status=404;throw error;}
      const auth=db.prepare('SELECT * FROM outreach_authorizations WHERE id=? AND status=? LIMIT 1').get(authorizationId,'authorized');
      if(!auth){const error=new Error('OUTREACH_AUTHORIZATION_INVALID');error.status=403;throw error;}
      if(String(auth.task_id||'')!==String(attempt.task_id||'')){const error=new Error('OUTREACH_AUTHORIZATION_TASK_MISMATCH');error.status=403;throw error;}
      const ids=new Set(JSON.parse(auth.candidate_ids_json||'[]').map(String));
      if(!ids.has(String(attempt.candidate_id||''))){const error=new Error('OUTREACH_AUTHORIZATION_CANDIDATE_MISMATCH');error.status=403;throw error;}
      const messageSha=crypto.createHash('sha256').update(String(attempt.body_text||'')).digest('hex');
      if(messageSha!==String(auth.message_sha256||'')){const error=new Error('OUTREACH_AUTHORIZATION_MESSAGE_MISMATCH');error.status=403;throw error;}
      if(String(attempt.authorization_id||'')!==authorizationId){const error=new Error('OUTREACH_AUTHORIZATION_ATTEMPT_MISMATCH');error.status=403;throw error;}
      let attemptMetadata={};try{attemptMetadata=JSON.parse(attempt.metadata_json||'{}')}catch{}
      assertAuthorizedTarget(auth,{taskId:attempt.task_id,candidateId:attempt.candidate_id,channel:attempt.channel,recipient:attempt.recipient,telegram:String(attemptMetadata.telegram||''),message:attempt.body_text});
      const row = await sendEmail(requestId);

      sendJson(
        res,
        200,
        {
          ok: true,
          outreach: safeAttempt(row)
        },
        origin
      );

      return true;
    }

    if (
      req.method === 'POST' &&
      url.pathname ===
        '/v1/outreach/manual-sent'
    ) {
      const body = await readJsonBody(req);

      const requestId =
        String(body.requestId || '');
      const authorizationId =
        String(body.authorizationId || '');

      if (!authorizationId) {
        const error = new Error('OUTREACH_AUTHORIZATION_REQUIRED');
        error.status = 403;
        throw error;
      }

      const row = getAttempt(requestId);

      if (!row) {
        const error = new Error('REQUEST_NOT_FOUND');
        error.status = 404;
        throw error;
      }

      if (row.channel === 'email') {
        const error = new Error('MANUAL_CHANNEL_REQUIRED');
        error.status = 400;
        throw error;
      }

      const auth = db.prepare(
        'SELECT * FROM outreach_authorizations WHERE id=? AND status=? LIMIT 1'
      ).get(authorizationId, 'authorized');
      if (!auth) {
        const error = new Error('OUTREACH_AUTHORIZATION_INVALID');
        error.status = 403;
        throw error;
      }
      if (String(auth.task_id || '') !== String(row.task_id || '')) {
        const error = new Error('OUTREACH_AUTHORIZATION_TASK_MISMATCH');
        error.status = 403;
        throw error;
      }
      const ids = new Set(JSON.parse(auth.candidate_ids_json || '[]').map(String));
      if (!ids.has(String(row.candidate_id || ''))) {
        const error = new Error('OUTREACH_AUTHORIZATION_CANDIDATE_MISMATCH');
        error.status = 403;
        throw error;
      }
      const messageSha = crypto.createHash('sha256')
        .update(String(row.body_text || '')).digest('hex');
      if (messageSha !== String(auth.message_sha256 || '')) {
        const error = new Error('OUTREACH_AUTHORIZATION_MESSAGE_MISMATCH');
        error.status = 403;
        throw error;
      }
      if (String(row.authorization_id || '') !== authorizationId) {
        const error = new Error('OUTREACH_AUTHORIZATION_ATTEMPT_MISMATCH');
        error.status = 403;
        throw error;
      }
      let rowMetadata = {};
      try { rowMetadata = JSON.parse(row.metadata_json || '{}'); } catch {}
      assertAuthorizedTarget(auth,{taskId:row.task_id,candidateId:row.candidate_id,channel:row.channel,recipient:row.recipient,telegram:String(rowMetadata.telegram||''),message:row.body_text});

      if (row.status === 'sent') {
        sendJson(res, 200, { ok: true, outreach: safeAttempt(row) }, origin);
        return true;
      }

      const sentAt = now();

      db.prepare(`
        UPDATE outreach_attempts
        SET
          status = 'sent',
          sent_by = 'user',
          sent_at = COALESCE(sent_at, ?)
        WHERE request_id = ?
      `).run(
        sentAt,
        requestId
      );

      addEvent(
        requestId,
        'sent',
        'user',
        {
          channel: row.channel
        }
      );

      sendJson(
        res,
        200,
        {
          ok: true,
          outreach:
            safeAttempt(
              getAttempt(requestId)
            )
        },
        origin
      );

      return true;
    }

    if (
      req.method === 'GET' &&
      url.pathname ===
        '/v1/outreach/status'
    ) {
      const requestId =
        url.searchParams.get(
          'requestId'
        ) || '';

      const row =
        getAttempt(requestId);

      if (!row) {
        sendJson(
          res,
          404,
          {
            ok: false,
            error:
              'REQUEST_NOT_FOUND'
          },
          origin
        );

        return true;
      }

      const replyRows = db.prepare(`
          SELECT
            id,
            from_email,
            subject,
            text_body,
            html_body,
            received_at,
            attachments_json
          FROM inbound_messages
          WHERE request_id = ?
          ORDER BY received_at ASC
        `).all(requestId);

        const replies = replyRows.map(row => {
          let attachments = [];

          try {
            attachments = JSON.parse(
              row.attachments_json || '[]'
            );
          } catch {}

          return {
            id: row.id,
            fromEmail: row.from_email,
            subject: row.subject,
            textBody: row.text_body,
            htmlBody: row.html_body,
            receivedAt: row.received_at,
            attachments
          };
        });

      sendJson(
        res,
        200,
        {
          ok: true,
          outreach:
            safeAttempt(row),
          replies
        },
        origin
      );

      return true;
    }

    sendJson(
      res,
      404,
      {
        ok: false,
        error: 'NOT_FOUND'
      },
      origin
    );

    return true;

  } catch (error) {
    const status =
      error.status ||
      (
        error.message ===
          'BAD_JSON'
          ? 400
          : error.message ===
              'PAYLOAD_TOO_LARGE'
            ? 413
            : error.message ===
                'EMAIL_NOT_CONFIGURED'
              ? 503
              : 500
      );

    sendJson(
      res,
      status,
      {
        ok: false,
        error:
          error.message ||
          'OUTREACH_FAILED'
      },
      origin
    );

    return true;
  }
}
