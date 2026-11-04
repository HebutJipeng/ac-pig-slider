CREATE TABLE voters (voter_hash TEXT PRIMARY KEY NOT NULL, ip_hash TEXT NOT NULL, position INTEGER NOT NULL CHECK(position BETWEEN -15 AND 15), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL) STRICT;
CREATE INDEX voters_ip_created ON voters(ip_hash,created_at);
CREATE TABLE daily_snapshots (date TEXT PRIMARY KEY NOT NULL, score REAL NOT NULL CHECK(score BETWEEN -15 AND 15), voter_count INTEGER NOT NULL CHECK(voter_count >= 0), created_at INTEGER NOT NULL) STRICT;
