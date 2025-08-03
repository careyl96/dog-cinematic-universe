DROP TABLE IF EXISTS guilds CASCADE;

CREATE TABLE guilds (
  id VARCHAR PRIMARY KEY,
  name VARCHAR,
  music_bot_channel VARCHAR
);

DROP TABLE IF EXISTS cached_tracks CASCADE;

CREATE TABLE cached_tracks (
  id VARCHAR PRIMARY KEY,
  cached_at TIMESTAMPTZ,
  last_pulled_at TIMESTAMPTZ,
  data BYTEA NOT NULL,
  CONSTRAINT fk_cached_tracks_id FOREIGN KEY (id) REFERENCES tracks(id) ON DELETE CASCADE
);

DROP TABLE IF EXISTS playlist_tracks CASCADE;

CREATE TABLE playlist_tracks (
  playlist_id INTEGER NOT NULL,
  track_id VARCHAR NOT NULL,
  position INTEGER,
  added_at TIMESTAMPTZ,
  PRIMARY KEY (playlist_id, track_id),
  FOREIGN KEY (playlist_id) REFERENCES playlists(id),
  FOREIGN KEY (track_id) REFERENCES tracks(id),
  UNIQUE (playlist_id, position)
);

DROP TABLE IF EXISTS playlists CASCADE;

CREATE TABLE playlists (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  name VARCHAR,
  public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deletable BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

DROP TABLE IF EXISTS user_history CASCADE;

CREATE TABLE user_history (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id VARCHAR NOT NULL,
  track_id VARCHAR NOT NULL,
  guild_id VARCHAR NOT NULL,
  played_at TIMESTAMPTZ,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (track_id) REFERENCES tracks(id),
  FOREIGN KEY (guild_id) REFERENCES guilds(id)
);

DROP TABLE IF EXISTS tracks CASCADE;

CREATE TABLE tracks (
  id VARCHAR PRIMARY KEY,
  title VARCHAR,
  duration VARCHAR,
  live_broadcast_content VARCHAR
);

DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id VARCHAR PRIMARY KEY,
  username VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE guild_track_profiles (
  guild_id VARCHAR NOT NULL,
  track_id VARCHAR NOT NULL,
  blacklisted BOOLEAN DEFAULT FALSE,
  volume INTEGER CHECK (volume >= 0 AND volume <= 100),
  user_play_count INTEGER DEFAULT 0,
  first_played_by VARCHAR NULL,
  last_played_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (guild_id, track_id),
  FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  FOREIGN KEY (first_played_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id);

CREATE INDEX idx_playlist_tracks_track_id ON playlist_tracks(track_id);

CREATE INDEX idx_playlists_user_id ON playlists(user_id);

CREATE INDEX idx_user_history_user_id ON user_history(user_id);

CREATE INDEX idx_user_history_track_id ON user_history(track_id);

CREATE INDEX idx_guild_track_profiles_guild_id ON guild_track_profiles(guild_id);

CREATE INDEX idx_guild_track_profiles_track_id ON guild_track_profiles(track_id);
