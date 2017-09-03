
SET GLOBAL innodb_file_per_table=1;
-- SET GLOBAL innodb_file_format=Barracuda;

-- 
CREATE TABLE EvtHistory (
    id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    type VARCHAR(16) NOT NULL
        COMMENT "Convert to enum for efficiency",
    data JSON NOT NULL,
    ts TIMESTAMP NOT NULL
)
    ENGINE=InnoDB
    ROW_FORMAT=COMPRESSED
    CHARACTER SET 'utf8'
    COMMENT "Prototype for all time history table";
    
