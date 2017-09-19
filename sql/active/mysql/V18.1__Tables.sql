
SET GLOBAL innodb_file_per_table=1;
-- SET GLOBAL innodb_file_format=Barracuda;

-- 
CREATE TABLE evt_queue (
    id BIGINT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    type VARCHAR(16) NOT NULL
        COMMENT "Convert to enum for efficiency",
    -- data JSON NOT NULL,
    data TEXT NOT NULL,
    ts TIMESTAMP NOT NULL
)
    ENGINE=InnoDB
    CHARACTER SET 'utf8'
    COMMENT "Main high load table";


-- 
CREATE TABLE evt_consumers (
    id SMALLINT NOT NULL auto_increment PRIMARY KEY,
    last_evt_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
    reg_time TIMESTAMP NOT NULL,
    last_time TIMESTAMP NOT NULL,
    ident VARCHAR(64) NOT NULL UNIQUE,
    INDEX last_evt_id (last_evt_id) USING BTREE
)
    ENGINE=InnoDB
    CHARACTER SET 'utf8'
    COMMENT "Event Consumers & last delivered event pointers";
    
