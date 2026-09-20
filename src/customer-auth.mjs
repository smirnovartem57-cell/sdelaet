import crypto from 'node:crypto';
import net from 'node:net';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validEmail(value) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(normalizeEmail(value));
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 64 * 1024) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('BAD_JSON'));
      }
    });
    req.on('error', reject);
  });
}

function encodeHeader(value) {
  return '=?UTF-8?B?' + Buffer.from(String(value), 'utf8').toString('base64') + '?=';
}

function cookieToken(req) {
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(';')) {
    const pair = part.trim();
    const pos = pair.indexOf('=');
    if (pos < 0) continue;
    if (pair.slice(0, pos) === 'sd_customer_session') {
      return decodeURIComponent(pair.slice(pos + 1) || '');
    }
  }
  return '';
}

function sessionCookie(token, maxAge) {
  return [
    'sd_customer_session=' + encodeURIComponent(token || ''),
    'Domain=.onsdelaet.ru',
    'Path=/',
    'Max-Age=' + String(maxAge),
    'HttpOnly',
    'Secure',
    'SameSite=Lax'
  ].join('; ');
}

function sendJson(res, status, data, origin, allowedOrigins, extraHeaders) {
  const headers = Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }, extraHeaders || {});
  if (origin && allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Vary'] = 'Origin';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(data));
}

function sendOtpMail(email, code) {
  const envelopeFrom = 'requests@onsdelaet.ru';
  const subject = encodeHeader('Код входа в «Сделает»');
  const from = encodeHeader('Сделает') + ' <requests@onsdelaet.ru>';
  const body = [
    'Ваш код входа: ' + code,
    '',
    'Код действует 10 минут и подходит только для одного входа.',
    'Если вы не запрашивали вход, просто проигнорируйте это письмо.'
  ].join('\r\n');
  const message = [
    'From: ' + from,
    'To: <' + email + '>',
    'Subject: ' + subject,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body
  ].join('\r\n');

  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port: 25 });
    socket.setTimeout(12000);
    const commands = [
      'EHLO onsdelaet.local\r\n',
      'MAIL FROM:<' + envelopeFrom + '>\r\n',
      'RCPT TO:<' + email + '>\r\n',
      'DATA\r\n',
      message.replace(/^\./gm, '..') + '\r\n.\r\n',
      'QUIT\r\n'
    ];
    const expected = [250, 250, 250, 354, 250, 221];
    let step = -1;
    let buffer = '';
    let settled = false;

    const fail = error => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch {}
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    socket.on('error', fail);
    socket.on('timeout', () => fail(new Error('AUTH_EMAIL_TIMEOUT')));
    socket.on('data', chunk => {
      if (settled) return;
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!/^\d{3}[ -]/.test(line) || /^\d{3}-/.test(line)) continue;
        const status = Number(line.slice(0, 3));
        if (step === -1) {
          if (status !== 220) return fail(new Error('AUTH_EMAIL_SMTP_GREETING_' + status));
          step = 0;
          socket.write(commands[step]);
          continue;
        }
        if (status !== expected[step]) return fail(new Error('AUTH_EMAIL_SMTP_' + status));
        step += 1;
        if (step >= commands.length) {
          settled = true;
          socket.end();
          resolve(true);
          return;
        }
        socket.write(commands[step]);
      }
    });
  });
}

export function createCustomerAuth({ db, allowedOrigins }) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS customer_auth_codes (' +
    'challenge_id TEXT PRIMARY KEY,' +
    'email TEXT NOT NULL,' +
    'code_hash TEXT NOT NULL,' +
    'requested_at INTEGER NOT NULL,' +
    'expires_at INTEGER NOT NULL,' +
    'attempts INTEGER NOT NULL DEFAULT 0,' +
    'consumed_at INTEGER' +
    ');' +
    'CREATE INDEX IF NOT EXISTS idx_customer_auth_codes_email ON customer_auth_codes(email, requested_at);' +
    'CREATE TABLE IF NOT EXISTS customer_sessions (' +
    'token_hash TEXT PRIMARY KEY,' +
    'email TEXT NOT NULL,' +
    'created_at INTEGER NOT NULL,' +
    'expires_at INTEGER NOT NULL' +
    ');' +
    'CREATE INDEX IF NOT EXISTS idx_customer_sessions_email ON customer_sessions(email, expires_at);'
  );

  function getSession(req) {
    const token = cookieToken(req);
    if (!token) return null;
    const now = Date.now();
    db.prepare('DELETE FROM customer_sessions WHERE expires_at <= ?').run(now);
    return db.prepare(
      'SELECT email,created_at,expires_at FROM customer_sessions WHERE token_hash=? AND expires_at>?'
    ).get(hash(token), now) || null;
  }

  async function requestCode(body) {
    const email = normalizeEmail(body && body.email);
    if (!validEmail(email)) {
      const error = new Error('INVALID_EMAIL');
      error.status = 400;
      throw error;
    }
    const now = Date.now();
    const recent = db.prepare(
      'SELECT requested_at FROM customer_auth_codes WHERE email=? ORDER BY requested_at DESC LIMIT 1'
    ).get(email);
    if (recent && now - Number(recent.requested_at || 0) < 60000) {
      const error = new Error('AUTH_CODE_RATE_LIMIT');
      error.status = 429;
      throw error;
    }

    db.prepare('DELETE FROM customer_auth_codes WHERE expires_at <= ? OR consumed_at IS NOT NULL').run(now);
    const challengeId = crypto.randomUUID();
    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = now + 10 * 60 * 1000;
    db.prepare(
      'INSERT INTO customer_auth_codes(challenge_id,email,code_hash,requested_at,expires_at,attempts,consumed_at) VALUES(?,?,?,?,?,0,NULL)'
    ).run(challengeId, email, hash(challengeId + ':' + code), now, expiresAt);

    try {
      await sendOtpMail(email, code);
    } catch (error) {
      db.prepare('DELETE FROM customer_auth_codes WHERE challenge_id=?').run(challengeId);
      error.status = 503;
      throw error;
    }
    return { challengeId, email, expiresIn: 600 };
  }

  function verifyCode(body) {
    const email = normalizeEmail(body && body.email);
    const challengeId = String((body && body.challengeId) || '').trim();
    const code = String((body && body.code) || '').replace(/\D/g, '');
    if (!validEmail(email) || !challengeId || !/^\d{6}$/.test(code)) {
      const error = new Error('INVALID_AUTH_CODE');
      error.status = 400;
      throw error;
    }
    const now = Date.now();
    const row = db.prepare(
      'SELECT * FROM customer_auth_codes WHERE challenge_id=? AND email=?'
    ).get(challengeId, email);
    if (!row || row.consumed_at || Number(row.expires_at) <= now) {
      const error = new Error('AUTH_CODE_EXPIRED');
      error.status = 400;
      throw error;
    }
    if (Number(row.attempts || 0) >= 5) {
      const error = new Error('AUTH_CODE_LOCKED');
      error.status = 429;
      throw error;
    }
    if (row.code_hash !== hash(challengeId + ':' + code)) {
      db.prepare('UPDATE customer_auth_codes SET attempts=attempts+1 WHERE challenge_id=?').run(challengeId);
      const error = new Error('INVALID_AUTH_CODE');
      error.status = 400;
      throw error;
    }

    db.prepare('UPDATE customer_auth_codes SET consumed_at=? WHERE challenge_id=?').run(now, challengeId);
    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
    db.prepare(
      'INSERT INTO customer_sessions(token_hash,email,created_at,expires_at) VALUES(?,?,?,?)'
    ).run(hash(token), email, now, expiresAt);
    return { token, email, expiresAt };
  }

  return {
    getSession,
    async handle(req, res, origin) {
      const pathname = new URL(req.url || '/', 'http://localhost').pathname;
      if (!pathname.startsWith('/v1/auth/')) return false;
      if (origin && !allowedOrigins.has(origin)) {
        sendJson(res, 403, { ok: false, error: 'ORIGIN_NOT_ALLOWED' }, '', allowedOrigins);
        return true;
      }
      try {
        if (req.method === 'POST' && pathname === '/v1/auth/request-code') {
          const result = await requestCode(await readBody(req));
          sendJson(res, 200, { ok: true, ...result }, origin, allowedOrigins);
          return true;
        }
        if (req.method === 'POST' && pathname === '/v1/auth/verify-code') {
          const result = verifyCode(await readBody(req));
          sendJson(
            res,
            200,
            { ok: true, authenticated: true, email: result.email },
            origin,
            allowedOrigins,
            { 'Set-Cookie': sessionCookie(result.token, 2592000) }
          );
          return true;
        }
        if (req.method === 'GET' && pathname === '/v1/auth/session') {
          const session = getSession(req);
          sendJson(
            res,
            200,
            { ok: true, authenticated: Boolean(session), user: session ? { email: session.email } : null },
            origin,
            allowedOrigins
          );
          return true;
        }
        if (req.method === 'POST' && pathname === '/v1/auth/logout') {
          const token = cookieToken(req);
          if (token) db.prepare('DELETE FROM customer_sessions WHERE token_hash=?').run(hash(token));
          sendJson(
            res,
            200,
            { ok: true, authenticated: false },
            origin,
            allowedOrigins,
            { 'Set-Cookie': sessionCookie('', 0) }
          );
          return true;
        }
        sendJson(res, 404, { ok: false, error: 'AUTH_ROUTE_NOT_FOUND' }, origin, allowedOrigins);
        return true;
      } catch (error) {
        const status = Number(error && error.status || (error && error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 500));
        sendJson(res, status, {
          ok: false,
          authenticated: false,
          error: String(error && error.message || 'AUTH_FAILED')
        }, origin, allowedOrigins);
        return true;
      }
    }
  };
}
