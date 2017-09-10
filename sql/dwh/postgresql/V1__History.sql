
-- 
CREATE TABLE evt_history (
    id BIGINT NOT NULL PRIMARY KEY,
    type VARCHAR(16) NOT NULL,
    data JSON NOT NULL,
    ts TIMESTAMP NOT NULL
);

COMMENT ON COLUMN evt_history.type IS 'Convert to enum for efficiency';
COMMENT ON TABLE evt_history IS 'Prototype for all time history table';
    
