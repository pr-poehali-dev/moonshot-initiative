"""WebRTC сигнализация: обмен offer/answer/ice между участниками звонка."""
import json
import os
import psycopg2

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}

    # GET /signal?room_id=xxx&after=0 — получить сигналы
    if method == 'GET':
        room_id = params.get('room_id', '')
        after = int(params.get('after', 0))
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "SELECT id, sender, type, payload FROM webrtc_signals WHERE room_id = %s AND id > %s ORDER BY id ASC LIMIT 50",
            (room_id, after)
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        signals = [{'id': r[0], 'sender': r[1], 'type': r[2], 'payload': json.loads(r[3])} for r in rows]
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'signals': signals})}

    # POST — отправить сигнал
    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        room_id = body.get('room_id', '')
        sender = body.get('sender', '')
        sig_type = body.get('type', '')
        payload = body.get('payload', {})
        if not room_id or not sender or not sig_type:
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'missing fields'})}
        conn = get_conn()
        cur = conn.cursor()
        # Очищаем старые сигналы комнаты (старше 10 минут)
        cur.execute("DELETE FROM webrtc_signals WHERE room_id = %s AND created_at < NOW() - INTERVAL '10 minutes'", (room_id,))
        cur.execute(
            "INSERT INTO webrtc_signals (room_id, sender, type, payload) VALUES (%s, %s, %s, %s) RETURNING id",
            (room_id, sender[:100], sig_type[:50], json.dumps(payload))
        )
        sig_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'id': sig_id})}

    # DELETE — завершить звонок (очистить комнату)
    if method == 'DELETE':
        body = json.loads(event.get('body') or '{}')
        room_id = body.get('room_id', '')
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("DELETE FROM webrtc_signals WHERE room_id = %s", (room_id,))
        conn.commit()
        cur.close()
        conn.close()
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'ok': True})}

    return {'statusCode': 405, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Method not allowed'})}
