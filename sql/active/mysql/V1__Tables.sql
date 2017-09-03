
SET GLOBAL innodb_file_per_table=1;
-- SET GLOBAL innodb_file_format=Barracuda;

-- 
CREATE TABLE EvtQueue (
    id BIGINT UNSIGNED NOT NULL auto_increment PRIMARY KEY,
    type VARCHAR(16) NOT NULL
        COMMENT "Convert to enum for efficiency",
    data JSON NOT NULL,
    ts TIMESTAMP NOT NULL
)
    ENGINE=InnoDB
    CHARACTER SET 'utf8'
    COMMENT "Main high load table";


-- 
CREATE TABLE EvtConsumers (
    id SMALLINT NOT NULL auto_increment PRIMARY KEY,
    last_evt_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
    local_uid INT UNSIGNED NOT NULL
        COMMENT "Local User ID as defined in FTN8",
    component VARCHAR(16) NOT NULL,
    UNIQUE KEY uid_component (local_uid, component),
    INDEX last_evt_id (last_evt_id) USING BTREE
)
    ENGINE=InnoDB
    CHARACTER SET 'utf8'
    COMMENT "Event Consumers & last delivered event pointers";
    
