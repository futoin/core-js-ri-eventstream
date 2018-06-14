
--
-- Use true UTF-8 in MySQL
--

ALTER TABLE evt_queue
    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    MODIFY `data` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE evt_consumers
    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

