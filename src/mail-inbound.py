#!/usr/bin/env python3

import hashlib
import json
import re
import sqlite3
import time
import uuid
import urllib.request
import urllib.error
from datetime import datetime, timezone
from email import policy
from email.parser import BytesParser
from email.utils import getaddresses
from pathlib import Path

DB_PATH = Path('/var/lib/sdelaet/db/sdelaet.sqlite')

MAILDIR = Path(
    '/var/www/www-root/data/email/'
    'onsdelaet.ru/requests/.maildir'
)

RAW_DIR = Path('/var/lib/sdelaet/mail/raw')
ATTACH_DIR = Path('/var/lib/sdelaet/mail/attachments')

TOKEN_RE = re.compile(
    r'<sdelaet-([A-Za-z0-9_-]+)@onsdelaet\.ru>',
    re.I
)

MAX_RAW_SIZE = 30 * 1024 * 1024
MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024


def now():
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix):
    return f'{prefix}_{uuid.uuid4().hex}'


def safe_filename(name):
    name = Path(name or 'attachment').name
    name = re.sub(r'[^A-Za-zА-Яа-я0-9._ -]+', '_', name)
    name = name.strip(' ._')
    return name[:180] or 'attachment'


def decode_part(part):
    try:
        payload = part.get_payload(decode=True)
        if payload is None:
            return ''

        charset = part.get_content_charset() or 'utf-8'
        return payload.decode(charset, errors='replace')
    except Exception:
        return ''


def extract_bodies(msg):
    text_parts = []
    html_parts = []

    if msg.is_multipart():
        for part in msg.walk():
            if part.is_multipart():
                continue

            if part.get_content_disposition() == 'attachment':
                continue

            content_type = part.get_content_type()

            if content_type == 'text/plain':
                text_parts.append(decode_part(part))
            elif content_type == 'text/html':
                html_parts.append(decode_part(part))
    else:
        content_type = msg.get_content_type()

        if content_type == 'text/plain':
            text_parts.append(decode_part(msg))
        elif content_type == 'text/html':
            html_parts.append(decode_part(msg))

    return (
        '\n'.join(x for x in text_parts if x).strip(),
        '\n'.join(x for x in html_parts if x).strip()
    )


def find_reply_token(msg):
    values = [
        str(msg.get('In-Reply-To') or ''),
        str(msg.get('References') or '')
    ]

    for value in values:
        matches = TOKEN_RE.findall(value)

        if matches:
            return matches[-1].lower()

    return ''


def save_attachments(msg, inbound_id):
    target = ATTACH_DIR / inbound_id
    saved = []

    for part in msg.walk():
        filename = part.get_filename()

        if not filename:
            continue

        payload = part.get_payload(decode=True)

        if payload is None:
            continue

        if len(payload) > MAX_ATTACHMENT_SIZE:
            saved.append({
                'filename': filename,
                'stored': False,
                'reason': 'too_large',
                'size': len(payload)
            })
            continue

        target.mkdir(
            parents=True,
            exist_ok=True
        )

        clean = safe_filename(filename)
        destination = target / clean

        counter = 1

        while destination.exists():
            destination = target / (
                f'{destination.stem}_{counter}'
                f'{destination.suffix}'
            )
            counter += 1

        destination.write_bytes(payload)

        saved.append({
            'filename': filename,
            'stored': True,
            'path': str(destination),
            'size': len(payload),
            'contentType': part.get_content_type()
        })

    return saved


def ensure_schema(db):
    db.execute("""
        CREATE TABLE IF NOT EXISTS mail_inbound_seen (
            fingerprint TEXT PRIMARY KEY,
            source_path TEXT NOT NULL,
            status TEXT NOT NULL,
            request_id TEXT,
            processed_at TEXT NOT NULL,
            error TEXT
        )
    """)

    db.commit()


def already_seen(db, fingerprint):
    row = db.execute(
        """
        SELECT fingerprint
        FROM mail_inbound_seen
        WHERE fingerprint = ?
        """,
        (fingerprint,)
    ).fetchone()

    return row is not None


def mark_seen(
    db,
    fingerprint,
    source_path,
    status,
    request_id='',
    error=''
):
    db.execute(
        """
        INSERT OR REPLACE INTO mail_inbound_seen (
            fingerprint,
            source_path,
            status,
            request_id,
            processed_at,
            error
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            fingerprint,
            source_path,
            status,
            request_id or None,
            now(),
            error or None
        )
    )

    db.commit()


def push_reply_to_pipeline(request_id, text_body, provider_email_id, received_at, inbound_id):
    text = (text_body or '').strip()
    if not text:
        return {'skipped': True, 'reason': 'EMPTY_TEXT'}
    payload = json.dumps({
        'raw_text': text,
        'channel': 'email',
        'external_message_id': provider_email_id,
        'received_at': received_at,
        'metadata': {'inboundId': inbound_id, 'provider': 'local_exim'}
    }, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        'http://127.0.0.1:3210/v1/outreach/' + request_id + '/replies',
        data=payload,
        headers={'Content-Type': 'application/json; charset=utf-8'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode('utf-8', errors='replace')
        raise RuntimeError('REPLY_PIPELINE_HTTP_' + str(exc.code) + ': ' + body)

def process_file(db, path):
    raw = path.read_bytes()

    if len(raw) > MAX_RAW_SIZE:
        fingerprint = hashlib.sha256(raw).hexdigest()

        if not already_seen(db, fingerprint):
            mark_seen(
                db,
                fingerprint,
                str(path),
                'too_large'
            )

        return

    fingerprint = hashlib.sha256(raw).hexdigest()

    if already_seen(db, fingerprint):
        return

    msg = BytesParser(
        policy=policy.default
    ).parsebytes(raw)

    token = find_reply_token(msg)

    if not token:
        mark_seen(
            db,
            fingerprint,
            str(path),
            'unmatched_no_token'
        )
        return

    attempt = db.execute(
        """
        SELECT *
        FROM outreach_attempts
        WHERE lower(reply_token) = ?
        """,
        (token,)
    ).fetchone()

    if not attempt:
        mark_seen(
            db,
            fingerprint,
            str(path),
            'unmatched_token'
        )
        return

    request_id = attempt['request_id']

    inbound_id = new_id('in')

    raw_path = RAW_DIR / f'{inbound_id}.eml'
    raw_path.write_bytes(raw)

    text_body, html_body = extract_bodies(msg)

    attachments = save_attachments(
        msg,
        inbound_id
    )

    from_addresses = getaddresses(
        msg.get_all('From', [])
    )
    to_addresses = getaddresses(
        msg.get_all('To', [])
    )

    from_email = (
        from_addresses[0][1]
        if from_addresses
        else ''
    )

    to_email = json.dumps(
        [x[1] for x in to_addresses if x[1]],
        ensure_ascii=False
    )

    provider_message_id = str(
        msg.get('Message-ID') or ''
    ).strip()

    provider_email_id = (
        provider_message_id or fingerprint
    )

    received_at = now()

    raw_meta = {
        'sourcePath': str(path),
        'rawPath': str(raw_path),
        'fingerprint': fingerprint,
        'messageId': provider_message_id,
        'inReplyTo': str(
            msg.get('In-Reply-To') or ''
        ),
        'references': str(
            msg.get('References') or ''
        ),
        'date': str(msg.get('Date') or '')
    }

    try:
        db.execute('BEGIN IMMEDIATE')

        db.execute(
            """
            INSERT OR IGNORE INTO inbound_messages (
                id,
                request_id,
                provider,
                provider_email_id,
                provider_message_id,
                from_email,
                to_email,
                subject,
                text_body,
                html_body,
                attachments_json,
                received_at,
                raw_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                inbound_id,
                request_id,
                'local_exim',
                provider_email_id,
                provider_message_id,
                from_email,
                to_email,
                str(msg.get('Subject') or ''),
                text_body,
                html_body,
                json.dumps(
                    attachments,
                    ensure_ascii=False
                ),
                received_at,
                json.dumps(
                    raw_meta,
                    ensure_ascii=False
                )
            )
        )

        db.execute(
            """
            UPDATE outreach_attempts
            SET
                status = 'replied',
                replied_at =
                    COALESCE(replied_at, ?)
            WHERE request_id = ?
            """,
            (
                received_at,
                request_id
            )
        )

        db.execute(
            """
            INSERT INTO outreach_events (
                id,
                request_id,
                event_type,
                actor,
                occurred_at,
                data_json
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                new_id('evt'),
                request_id,
                'replied',
                'contractor',
                received_at,
                json.dumps({
                    'provider': 'local_exim',
                    'inboundId': inbound_id,
                    'from': from_email
                }, ensure_ascii=False)
            )
        )

        db.execute(
            """
            INSERT OR REPLACE INTO mail_inbound_seen (
                fingerprint,
                source_path,
                status,
                request_id,
                processed_at,
                error
            )
            VALUES (?, ?, ?, ?, ?, NULL)
            """,
            (
                fingerprint,
                str(path),
                'matched',
                request_id,
                received_at
            )
        )

        db.commit()

        pipeline_result = push_reply_to_pipeline(
            request_id,
            text_body,
            provider_email_id,
            received_at,
            inbound_id
        )

        print(
            'PIPELINE',
            request_id,
            json.dumps(pipeline_result, ensure_ascii=False),
            flush=True
        )

        print(
            'MATCHED',
            request_id,
            from_email,
            provider_message_id,
            flush=True
        )

    except Exception:
        db.rollback()
        raise


def scan_once(db):
    for folder in (
        MAILDIR / 'new',
        MAILDIR / 'cur'
    ):
        if not folder.exists():
            continue

        for path in sorted(folder.iterdir()):
            if not path.is_file():
                continue

            try:
                process_file(db, path)
            except Exception as exc:
                print(
                    'ERROR',
                    str(path),
                    repr(exc),
                    flush=True
                )


def main():
    RAW_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    ATTACH_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    db = sqlite3.connect(
        DB_PATH,
        timeout=10
    )

    db.row_factory = sqlite3.Row

    ensure_schema(db)

    print(
        'Sdelaet inbound parser started',
        flush=True
    )

    while True:
        scan_once(db)
        time.sleep(15)


if __name__ == '__main__':
    main()
