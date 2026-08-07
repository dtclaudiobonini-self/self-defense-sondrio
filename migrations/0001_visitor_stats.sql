CREATE TABLE IF NOT EXISTS daily_visitors (
  visit_date TEXT NOT NULL,
  hostname TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (visit_date, hostname, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_daily_visitors_date_host
  ON daily_visitors (visit_date, hostname);
