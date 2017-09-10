
-- 
CREATE TABLE evt_queue (
    id bigserial NOT NULL PRIMARY KEY,
    type VARCHAR(16) NOT NULL,
    data JSON NOT NULL,
    ts TIMESTAMP NOT NULL
);

COMMENT ON COLUMN evt_queue.type IS 'Convert to enum for efficiency';
COMMENT ON TABLE evt_queue IS 'Main high load table';


-- 
CREATE TABLE evt_consumers (
    id serial2 NOT NULL PRIMARY KEY,
    last_evt_id BIGINT NOT NULL DEFAULT 0,
    reg_time TIMESTAMP NOT NULL,
    last_time TIMESTAMP NOT NULL,
    ident VARCHAR(64) NOT NULL UNIQUE
);

COMMENT ON TABLE evt_consumers IS 'Event Consumers & last delivered event pointers';

CREATE INDEX evt_consumers_last_evt_id ON evt_consumers USING BTREE (last_evt_id);
    
