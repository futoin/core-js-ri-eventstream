
-- 
CREATE TABLE evt_history (
    id INTEGER NOT NULL PRIMARY KEY,
    type VARCHAR(16) NOT NULL
        /* Convert to enum for efficiency */,
    data TEXT NOT NULL,
    ts TIMESTAMP NOT NULL
)
    /* Prototype for all time history table */;
    
