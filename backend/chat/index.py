"""Чат: отправка и получение сообщений между пользователями и командой."""
import json
import os
import psycopg2


CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    method = event.get('httpMethod', 'GET')

    if method == 'GET':
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT id, sender_name, message, created_at FROM chat_messages ORDER BY created_at ASC LIMIT 200")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        messages = [
            {'id': r[0], 'sender_name': r[1], 'message': r[2], 'created_at': r[3].isoformat()}
            for r in rows
        ]
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'messages': messages})}

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        sender_name = (body.get('sender_name') or '').strip()
        message = (body.get('message') or '').strip()
        if not sender_name or not message:
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Заполните имя и сообщение'})}
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO chat_messages (sender_name, message) VALUES (%s, %s) RETURNING id, created_at",
            (sender_name[:100], message[:2000])
        )
        row = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'id': row[0], 'sender_name': sender_name, 'message': message, 'created_at': row[1].isoformat()})
        }

    return {'statusCode': 405, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Method not allowed'})}
