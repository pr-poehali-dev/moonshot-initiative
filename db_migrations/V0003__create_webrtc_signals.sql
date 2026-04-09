CREATE TABLE IF NOT EXISTS webrtc_signals (
  id SERIAL PRIMARY KEY,
  room_id VARCHAR(100) NOT NULL,
  sender VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  payload TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webrtc_signals_room ON webrtc_signals(room_id, created_at);