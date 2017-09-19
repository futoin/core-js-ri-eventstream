
-- 
CREATE TABLE evt_queue (
    id INTEGER NOT NULL PRIMARY KEY autoincrement,
    type VARCHAR(16) NOT NULL
        /* Convert to enum for efficiency */,
    data TEXT NOT NULL,
    ts TIMESTAMP NOT NULL
)
    /* Main high load table */;


-- 
CREATE TABLE evt_consumers (
    id INTEGER NOT NULL PRIMARY KEY autoincrement,
    last_evt_id INTEGER NOT NULL DEFAULT 0,
    reg_time TIMESTAMP NOT NULL,
    last_time TIMESTAMP NOT NULL,
    ident VARCHAR(64) NOT NULL UNIQUE
)
    /* Event Consumers & last delivered event pointers */;
    
CREATE INDEX evt_consumers_last_evt_id ON evt_consumers(last_evt_id);
