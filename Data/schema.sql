CREATE DATABASE IF NOT EXISTS hypercorsa
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hypercorsa;

CREATE TABLE IF NOT EXISTS telemetry_sessions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    started_at DATETIME(6) NOT NULL,
    ended_at DATETIME(6) NULL,
    car VARCHAR(120) NULL,
    track VARCHAR(120) NULL,
    mode VARCHAR(60) NULL,
    metadata_json JSON NULL,
    INDEX idx_sessions_started_at (started_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS telemetry_samples (
    session_id CHAR(36) NOT NULL,
    sample_index BIGINT UNSIGNED NOT NULL,
    recorded_at DATETIME(6) NOT NULL,
    elapsed_ms BIGINT UNSIGNED NOT NULL,
    speed DOUBLE NULL, rpm DOUBLE NULL, gear INT NULL, gas DOUBLE NULL, brake DOUBLE NULL,
    clutch DOUBLE NULL, fuel DOUBLE NULL, steer DOUBLE NULL, drs DOUBLE NULL,
    tyre_fl_temp DOUBLE NULL, tyre_fr_temp DOUBLE NULL, tyre_rl_temp DOUBLE NULL, tyre_rr_temp DOUBLE NULL,
    brake_fl_temp DOUBLE NULL, brake_fr_temp DOUBLE NULL, brake_rl_temp DOUBLE NULL, brake_rr_temp DOUBLE NULL,
    ers_power DOUBLE NULL, tyre_fl_wear DOUBLE NULL, tyre_fr_wear DOUBLE NULL, tyre_rl_wear DOUBLE NULL, tyre_rr_wear DOUBLE NULL,
    damage_front DOUBLE NULL, damage_rear DOUBLE NULL, damage_left DOUBLE NULL, damage_right DOUBLE NULL, damage_general DOUBLE NULL,
    tyre_fl_pressure DOUBLE NULL, tyre_fr_pressure DOUBLE NULL, tyre_rl_pressure DOUBLE NULL, tyre_rr_pressure DOUBLE NULL,
    abs_value DOUBLE NULL, tc_value DOUBLE NULL,
    `current_time` VARCHAR(20) NULL, `last_time` VARCHAR(20) NULL, `best_time` VARCHAR(20) NULL, `split` VARCHAR(20) NULL,
    completed_laps INT NULL, position INT NULL, current_sector INT NULL, number_of_laps INT NULL,
    status INT NULL, session INT NULL,
    PRIMARY KEY (session_id, sample_index),
    INDEX idx_samples_recorded_at (session_id, recorded_at),
    CONSTRAINT fk_samples_session FOREIGN KEY (session_id) REFERENCES telemetry_sessions(id)
) ENGINE=InnoDB;
