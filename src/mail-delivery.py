#!/usr/bin/env python3

import json
import re
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

DB_PATH = Path('/var/lib/sdelaet/db/sdelaet.sqlite')
LOG_PATH = Path('/var/log/exim4/mainlog')
STATE_PATH = Path('/var/lib/sdelaet/mail/delivery.offset')

INBOUND_RE = re.compile(
    r'^(\S+\s+\S+)\s+'
    r'(\S+)\s+<=\s+.*?\s'
    r'id=(sdelaet-[A-Za-z0-9_-]+@onsdelaet\.ru)\b'
)

DELIVERED_RE = re.compile(
    r'^(\S+\s+\S+)\s+'
    r'(\S+)\s+=>\s+'
    r'(\S+).*?\sC="250\b'
)

FAILED_RE = re.compile(
    r'^(\S+\s+\S+)\s+'
    r'(\S+)\s+\*\*\s+'
    r'(\S+)'
)

def now():
    return datetime.now(timezone.utc).isoformat()


def exim_time(value):
    try:
        local = datetime.strptime(
            value,
            '%Y-%m-%d %H:%M:%S'
        ).replace(
            tzinfo=ZoneInfo('Europe/Moscow')
        )

        return local.astimezone(
            timezone.utc
        ).isoformat()
    except Exception:
        return now()


def read_offset():
    try:
        return int(STATE_PATH.read_text().strip())
    except Exception:
        return 0

def write_offset(value):
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(str(value))

def add_event(db, request_id, event_type, data):
    stamp = now()
    event_id = (
        'evt_delivery_' +
        request_id +
        '_' +
        str(int(time.time() * 1000))
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
            event_id,
            request_id,
            event_type,
            'provider',
            stamp,
            json.dumps(data, ensure_ascii=False)
        )
    )

def get_request_by_message_id(db, message_id):
    value = f'<{message_id}>'

    return db.execute(
        """
        SELECT request_id, status
        FROM outreach_attempts
        WHERE external_message_id = ?
        """,
        (value,)
    ).fetchone()

def mark_delivered(
    db,
    request_id,
    recipient,
    delivered_at
):
    stamp = delivered_at

    db.execute(
        """
        UPDATE outreach_attempts
        SET
            delivered_at = COALESCE(delivered_at, ?),
            status = CASE
                WHEN status = 'replied' THEN status
                ELSE 'delivered'
            END
        WHERE request_id = ?
        """,
        (
            stamp,
            request_id
        )
    )

    exists = db.execute(
        """
        SELECT 1
        FROM outreach_events
        WHERE request_id = ?
          AND event_type = 'delivered'
        LIMIT 1
        """,
        (request_id,)
    ).fetchone()

    if not exists:
        add_event(
            db,
            request_id,
            'delivered',
            {
                'provider': 'local_exim',
                'recipient': recipient
            }
        )

def mark_failed(
    db,
    request_id,
    recipient,
    failed_at
):
    row = db.execute(
        """
        SELECT status
        FROM outreach_attempts
        WHERE request_id = ?
        """,
        (request_id,)
    ).fetchone()

    if not row:
        return

    if row['status'] in ('delivered', 'replied'):
        return

    stamp = failed_at

    db.execute(
        """
        UPDATE outreach_attempts
        SET
            status = 'failed',
            failed_at = COALESCE(failed_at, ?),
            last_error = COALESCE(
                last_error,
                'Exim delivery failed'
            )
        WHERE request_id = ?
        """,
        (
            stamp,
            request_id
        )
    )

    add_event(
        db,
        request_id,
        'failed',
        {
            'provider': 'local_exim',
            'recipient': recipient
        }
    )

def main():
    db = sqlite3.connect(
        DB_PATH,
        timeout=10
    )
    db.row_factory = sqlite3.Row

    exim_to_message = {}

    offset = read_offset()

    if not LOG_PATH.exists():
        raise SystemExit('EXIM_LOG_NOT_FOUND')

    current_size = LOG_PATH.stat().st_size

    if offset <= 0 or offset > current_size:
        offset = max(0, current_size - 1024 * 1024)

    print(
        f'Sdelaet delivery watcher started offset={offset}',
        flush=True
    )

    while True:
        try:
            size = LOG_PATH.stat().st_size

            if size < offset:
                offset = 0
                exim_to_message.clear()

            with LOG_PATH.open(
                'r',
                encoding='utf-8',
                errors='replace'
            ) as fh:
                fh.seek(offset)

                while True:
                    line = fh.readline()

                    if not line:
                        break

                    offset = fh.tell()

                    m = INBOUND_RE.search(line)

                    if m:
                        exim_id = m.group(2)
                        message_id = m.group(3)
                        exim_to_message[exim_id] = message_id
                        continue

                    m = DELIVERED_RE.search(line)

                    if m:
                        exim_id = m.group(2)
                        recipient = m.group(3)

                        message_id = exim_to_message.get(
                            exim_id
                        )

                        if not message_id:
                            continue

                        row = get_request_by_message_id(
                            db,
                            message_id
                        )

                        if not row:
                            continue

                        delivered_at = exim_time(
                            m.group(1)
                        )

                        mark_delivered(
                            db,
                            row['request_id'],
                            recipient,
                            delivered_at
                        )

                        db.commit()

                        print(
                            'DELIVERED',
                            row['request_id'],
                            recipient,
                            flush=True
                        )

                        continue

                    m = FAILED_RE.search(line)

                    if m:
                        exim_id = m.group(2)
                        recipient = m.group(3)

                        message_id = exim_to_message.get(
                            exim_id
                        )

                        if not message_id:
                            continue

                        row = get_request_by_message_id(
                            db,
                            message_id
                        )

                        if not row:
                            continue

                        failed_at = exim_time(
                            m.group(1)
                        )

                        mark_failed(
                            db,
                            row['request_id'],
                            recipient,
                            failed_at
                        )

                        db.commit()

                        print(
                            'FAILED',
                            row['request_id'],
                            recipient,
                            flush=True
                        )

                write_offset(offset)

        except Exception as exc:
            print(
                'ERROR',
                repr(exc),
                flush=True
            )

        time.sleep(5)

if __name__ == '__main__':
    main()
