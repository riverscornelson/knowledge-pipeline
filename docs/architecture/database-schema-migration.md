# Database Schema Migration Plan

## Overview

This document outlines the database schema changes required to support the new streamlined Notion integration architecture. The migration eliminates redundant storage, enforces quality constraints, and adds performance tracking capabilities.

## Current Schema Analysis

### Existing Schema Issues

```sql
-- Current problematic structure
CREATE TABLE notion_sources (
    id VARCHAR(255),
    title TEXT,
    status VARCHAR(50),                -- No enum constraint
    drive_url TEXT,
    article_url TEXT,
    raw_content LONGTEXT,             -- PROBLEM: Redundant storage
    content_hash VARCHAR(64),
    created_date TIMESTAMP,
    quality_score FLOAT,              -- PROBLEM: Not enforced, often ignored
    content_type VARCHAR(100),
    ai_primitives TEXT,               -- PROBLEM: Should be JSON
    vendor VARCHAR(100),
    topical_tags TEXT,                -- PROBLEM: Should be JSON
    domain_tags TEXT                  -- PROBLEM: Should be JSON
);
```

### Issues with Current Schema

1. **Redundant Storage**: `raw_content` field stores full document text alongside `drive_url`
2. **No Quality Enforcement**: `quality_score` exists but isn't used for constraints
3. **Poor Data Types**: Text fields for JSON data, no enums
4. **Missing Metrics**: No performance tracking fields
5. **Weak Constraints**: No business logic enforcement at database level

## New Schema Design

### Core Principles

1. **Links-First Strategy**: Eliminate redundant content storage
2. **Quality-First Design**: Enforce 8.5/10 minimum quality at database level
3. **Performance Tracking**: Built-in metrics collection
4. **Type Safety**: Proper data types and constraints
5. **Scalability**: Optimized indexes and partitioning

### New Schema Definition

```sql
-- New optimized schema with quality enforcement
CREATE TABLE notion_sources_v2 (
    -- Primary identification
    id VARCHAR(255) PRIMARY KEY,
    title TEXT NOT NULL,

    -- Status with strict enum
    status ENUM('Inbox', 'Processing', 'Enriched', 'Failed', 'Quality_Review') NOT NULL DEFAULT 'Inbox',

    -- Source links (no redundant content storage)
    drive_url TEXT NULL,
    article_url TEXT NULL,
    content_hash VARCHAR(64) NOT NULL,

    -- Quality-first fields (enforced constraints)
    quality_score DECIMAL(3,2) NOT NULL DEFAULT 0.00
        COMMENT 'Quality score 0.00-10.00, minimum 8.50 for Enriched status',
    quality_components JSON NULL
        COMMENT 'Breakdown: {conciseness: 0.9, actionability: 0.8, ...}',
    quality_gate_version VARCHAR(20) DEFAULT 'v2.0'
        COMMENT 'Version of quality gates used for assessment',

    -- Performance tracking
    processing_time_ms INTEGER NULL
        COMMENT 'Total processing time in milliseconds',
    block_count INTEGER NULL
        COMMENT 'Number of Notion blocks generated (target: ≤15)',
    retry_count INTEGER DEFAULT 0
        COMMENT 'Number of quality gate retries',
    token_usage JSON NULL
        COMMENT '{input_tokens: 1500, output_tokens: 800, total_cost: 0.0234}',

    -- Classification results
    content_type VARCHAR(100) NULL,
    content_type_confidence DECIMAL(3,2) NULL
        COMMENT 'Confidence in content type classification 0.00-1.00',
    ai_primitives JSON NULL
        COMMENT 'Array of AI capabilities: ["LLM/Chat", "Computer Vision"]',
    vendor VARCHAR(100) NULL,

    -- Tagging system
    topical_tags JSON NULL
        COMMENT 'Array of topic tags: ["machine-learning", "api-design"]',
    domain_tags JSON NULL
        COMMENT 'Array of domain tags: ["enterprise-ai", "fintech"]',
    tag_confidence JSON NULL
        COMMENT 'Confidence scores for generated tags',

    -- Timestamps
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processing_started_date TIMESTAMP NULL,
    enriched_date TIMESTAMP NULL,
    last_quality_check TIMESTAMP NULL,

    -- Audit fields
    created_by VARCHAR(100) DEFAULT 'system',
    processing_version VARCHAR(20) DEFAULT 'v2.0',
    pipeline_config JSON NULL
        COMMENT 'Configuration used for processing',

    -- Business logic constraints
    CONSTRAINT chk_quality_score
        CHECK (quality_score >= 0.00 AND quality_score <= 10.00),

    CONSTRAINT chk_enriched_quality
        CHECK (
            (status = 'Enriched' AND quality_score >= 8.50) OR
            (status != 'Enriched')
        ),

    CONSTRAINT chk_block_count_limit
        CHECK (block_count IS NULL OR block_count <= 20),

    CONSTRAINT chk_processing_time_limit
        CHECK (processing_time_ms IS NULL OR processing_time_ms <= 45000), -- 45 second limit

    CONSTRAINT chk_source_provided
        CHECK (drive_url IS NOT NULL OR article_url IS NOT NULL OR status = 'Inbox'),

    CONSTRAINT chk_content_type_confidence
        CHECK (content_type_confidence IS NULL OR
               (content_type_confidence >= 0.00 AND content_type_confidence <= 1.00)),

    CONSTRAINT chk_processing_completeness
        CHECK (
            (status = 'Enriched' AND processing_time_ms IS NOT NULL AND block_count IS NOT NULL) OR
            (status != 'Enriched')
        )
);

-- Performance indexes
CREATE INDEX idx_status_quality ON notion_sources_v2(status, quality_score DESC);
CREATE INDEX idx_quality_score ON notion_sources_v2(quality_score DESC);
CREATE INDEX idx_processing_performance ON notion_sources_v2(processing_time_ms, block_count);
CREATE INDEX idx_content_type ON notion_sources_v2(content_type, content_type_confidence DESC);
CREATE INDEX idx_enriched_date ON notion_sources_v2(enriched_date DESC);
CREATE INDEX idx_content_hash ON notion_sources_v2(content_hash);

-- Full-text search on title and content type
CREATE FULLTEXT INDEX idx_search ON notion_sources_v2(title, content_type);

-- Composite index for dashboard queries
CREATE INDEX idx_dashboard ON notion_sources_v2(status, quality_score DESC, enriched_date DESC);
```

### Quality Metrics Table

```sql
-- Separate table for detailed quality tracking
CREATE TABLE quality_metrics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    source_id VARCHAR(255) NOT NULL,

    -- Quality assessment details
    overall_score DECIMAL(3,2) NOT NULL,
    conciseness_score DECIMAL(3,2) NOT NULL,
    actionability_score DECIMAL(3,2) NOT NULL,
    decision_focus_score DECIMAL(3,2) NOT NULL,
    time_efficiency_score DECIMAL(3,2) NOT NULL,
    relevance_score DECIMAL(3,2) NOT NULL,

    -- Quality gate results
    gates_passed INTEGER NOT NULL,
    gates_total INTEGER NOT NULL,
    gate_failures JSON NULL COMMENT 'Array of failed gate details',

    -- Assessment context
    assessor_version VARCHAR(20) NOT NULL,
    assessment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    retry_number INTEGER DEFAULT 0,

    FOREIGN KEY (source_id) REFERENCES notion_sources_v2(id) ON DELETE CASCADE,

    CONSTRAINT chk_quality_scores
        CHECK (
            overall_score >= 0.00 AND overall_score <= 10.00 AND
            conciseness_score >= 0.00 AND conciseness_score <= 10.00 AND
            actionability_score >= 0.00 AND actionability_score <= 10.00 AND
            decision_focus_score >= 0.00 AND decision_focus_score <= 10.00 AND
            time_efficiency_score >= 0.00 AND time_efficiency_score <= 10.00 AND
            relevance_score >= 0.00 AND relevance_score <= 10.00
        ),

    CONSTRAINT chk_gates_passed
        CHECK (gates_passed >= 0 AND gates_passed <= gates_total)
);

CREATE INDEX idx_quality_metrics_source ON quality_metrics(source_id, assessment_date DESC);
CREATE INDEX idx_quality_metrics_score ON quality_metrics(overall_score DESC);
```

### Performance Analytics Table

```sql
-- Performance tracking and analytics
CREATE TABLE processing_analytics (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    source_id VARCHAR(255) NOT NULL,

    -- Timing breakdown
    total_time_ms INTEGER NOT NULL,
    content_extraction_ms INTEGER NULL,
    ai_processing_ms INTEGER NULL,
    quality_assessment_ms INTEGER NULL,
    formatting_ms INTEGER NULL,

    -- Resource utilization
    tokens_input INTEGER NULL,
    tokens_output INTEGER NULL,
    api_calls_count INTEGER NULL,

    -- Cost tracking
    estimated_cost_usd DECIMAL(10,6) NULL,
    model_used VARCHAR(50) NULL,

    -- Efficiency metrics
    content_length_chars INTEGER NULL,
    blocks_generated INTEGER NULL,
    compression_ratio DECIMAL(4,3) NULL COMMENT 'Output size / Input size',

    -- Quality and performance correlation
    quality_score DECIMAL(3,2) NULL,
    retry_needed BOOLEAN DEFAULT FALSE,

    -- Context
    processing_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pipeline_version VARCHAR(20) NOT NULL,

    FOREIGN KEY (source_id) REFERENCES notion_sources_v2(id) ON DELETE CASCADE,

    CONSTRAINT chk_timing_consistency
        CHECK (
            total_time_ms > 0 AND
            (content_extraction_ms IS NULL OR content_extraction_ms >= 0) AND
            (ai_processing_ms IS NULL OR ai_processing_ms >= 0) AND
            (quality_assessment_ms IS NULL OR quality_assessment_ms >= 0) AND
            (formatting_ms IS NULL OR formatting_ms >= 0)
        ),

    CONSTRAINT chk_compression_ratio
        CHECK (compression_ratio IS NULL OR
               (compression_ratio >= 0.001 AND compression_ratio <= 1.000))
);

CREATE INDEX idx_analytics_performance ON processing_analytics(total_time_ms, quality_score DESC);
CREATE INDEX idx_analytics_cost ON processing_analytics(estimated_cost_usd DESC, processing_date DESC);
CREATE INDEX idx_analytics_efficiency ON processing_analytics(compression_ratio, blocks_generated);
```

## Migration Plan

### Phase 1: Schema Creation (Days 1-2)

```sql
-- Step 1: Create new tables alongside existing
-- (Schema definitions above)

-- Step 2: Create migration tracking table
CREATE TABLE schema_migration_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    migration_step VARCHAR(50) NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    records_affected INTEGER NULL,
    success BOOLEAN NULL,
    error_message TEXT NULL,
    rollback_data JSON NULL COMMENT 'Data needed for rollback'
);
```

### Phase 2: Data Migration (Days 3-5)

```sql
-- Migration script with data validation
DELIMITER $$

CREATE PROCEDURE MigrateNotionSources()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_id VARCHAR(255);
    DECLARE v_title TEXT;
    DECLARE v_status VARCHAR(50);
    DECLARE v_drive_url TEXT;
    DECLARE v_article_url TEXT;
    DECLARE v_content_hash VARCHAR(64);
    DECLARE v_created_date TIMESTAMP;
    DECLARE v_quality_score FLOAT;
    DECLARE v_content_type VARCHAR(100);
    DECLARE v_ai_primitives TEXT;
    DECLARE v_vendor VARCHAR(100);
    DECLARE v_topical_tags TEXT;
    DECLARE v_domain_tags TEXT;

    -- Cursor for iterating through old records
    DECLARE cur CURSOR FOR
        SELECT id, title, status, drive_url, article_url, content_hash,
               created_date, COALESCE(quality_score, 0), content_type,
               ai_primitives, vendor, topical_tags, domain_tags
        FROM notion_sources
        WHERE id NOT IN (SELECT id FROM notion_sources_v2);

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    -- Log migration start
    INSERT INTO schema_migration_log (migration_step)
    VALUES ('data_migration_start');

    OPEN cur;

    migration_loop: LOOP
        FETCH cur INTO v_id, v_title, v_status, v_drive_url, v_article_url,
                      v_content_hash, v_created_date, v_quality_score, v_content_type,
                      v_ai_primitives, v_vendor, v_topical_tags, v_domain_tags;

        IF done THEN
            LEAVE migration_loop;
        END IF;

        -- Migrate record with data transformation
        INSERT INTO notion_sources_v2 (
            id, title, status, drive_url, article_url, content_hash,
            created_date, quality_score, content_type, vendor,
            ai_primitives, topical_tags, domain_tags
        ) VALUES (
            v_id,
            v_title,
            CASE
                WHEN v_status = 'Inbox' THEN 'Inbox'
                WHEN v_status = 'Enriched' THEN
                    CASE WHEN v_quality_score >= 8.5 THEN 'Enriched'
                         ELSE 'Quality_Review' END
                WHEN v_status = 'Failed' THEN 'Failed'
                ELSE 'Quality_Review'
            END,
            v_drive_url,
            v_article_url,
            v_content_hash,
            v_created_date,
            GREATEST(v_quality_score, 0.0),  -- Ensure non-negative
            v_content_type,
            v_vendor,
            -- Convert text fields to JSON arrays
            CASE
                WHEN v_ai_primitives IS NOT NULL THEN
                    JSON_ARRAY(TRIM(REPLACE(v_ai_primitives, ',', '","')))
                ELSE NULL
            END,
            CASE
                WHEN v_topical_tags IS NOT NULL THEN
                    JSON_ARRAY(TRIM(REPLACE(v_topical_tags, ',', '","')))
                ELSE NULL
            END,
            CASE
                WHEN v_domain_tags IS NOT NULL THEN
                    JSON_ARRAY(TRIM(REPLACE(v_domain_tags, ',', '","')))
                ELSE NULL
            END
        );

    END LOOP;

    CLOSE cur;

    -- Log migration completion
    UPDATE schema_migration_log
    SET completed_at = CURRENT_TIMESTAMP,
        records_affected = (SELECT COUNT(*) FROM notion_sources_v2),
        success = TRUE
    WHERE migration_step = 'data_migration_start'
    AND completed_at IS NULL;

END$$

DELIMITER ;

-- Execute migration
CALL MigrateNotionSources();
```

### Phase 3: Application Migration (Days 6-8)

```python
# Database access layer migration
class NotionSourcesDAOV2:
    """New DAO with quality-first operations."""

    def create_source(self, source_data: SourceData) -> str:
        """Create new source with quality constraints."""
        query = """
        INSERT INTO notion_sources_v2 (
            id, title, status, drive_url, article_url, content_hash,
            created_by, processing_version
        ) VALUES (
            %(id)s, %(title)s, 'Inbox', %(drive_url)s, %(article_url)s,
            %(content_hash)s, %(created_by)s, 'v2.0'
        )
        """

        with self.db.cursor() as cursor:
            cursor.execute(query, source_data.to_dict())
            return source_data.id

    def update_enrichment_results(self, source_id: str, results: EnrichmentResult) -> bool:
        """Update with quality enforcement."""
        if results.quality_score < 8.5:
            status = 'Quality_Review'
        else:
            status = 'Enriched'

        query = """
        UPDATE notion_sources_v2 SET
            status = %(status)s,
            quality_score = %(quality_score)s,
            quality_components = %(quality_components)s,
            processing_time_ms = %(processing_time_ms)s,
            block_count = %(block_count)s,
            retry_count = %(retry_count)s,
            token_usage = %(token_usage)s,
            content_type = %(content_type)s,
            content_type_confidence = %(content_type_confidence)s,
            ai_primitives = %(ai_primitives)s,
            vendor = %(vendor)s,
            topical_tags = %(topical_tags)s,
            domain_tags = %(domain_tags)s,
            enriched_date = CURRENT_TIMESTAMP,
            last_quality_check = CURRENT_TIMESTAMP
        WHERE id = %(source_id)s
        """

        with self.db.cursor() as cursor:
            cursor.execute(query, {
                'source_id': source_id,
                'status': status,
                'quality_score': results.quality_score,
                'quality_components': json.dumps(results.quality_components),
                'processing_time_ms': int(results.processing_time * 1000),
                'block_count': results.block_count,
                'retry_count': results.retry_count,
                'token_usage': json.dumps(results.token_usage),
                'content_type': results.content_type,
                'content_type_confidence': results.content_type_confidence,
                'ai_primitives': json.dumps(results.ai_primitives),
                'vendor': results.vendor,
                'topical_tags': json.dumps(results.topical_tags),
                'domain_tags': json.dumps(results.domain_tags)
            })

            return cursor.rowcount > 0

    def get_quality_dashboard_data(self) -> Dict[str, Any]:
        """Get dashboard data with new quality metrics."""
        query = """
        SELECT
            status,
            COUNT(*) as count,
            AVG(quality_score) as avg_quality,
            AVG(processing_time_ms) as avg_processing_time,
            AVG(block_count) as avg_block_count,
            SUM(JSON_EXTRACT(token_usage, '$.total_cost')) as total_cost
        FROM notion_sources_v2
        WHERE created_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY status
        """

        with self.db.cursor(dictionary=True) as cursor:
            cursor.execute(query)
            return cursor.fetchall()
```

### Phase 4: Data Validation and Cleanup (Days 9-10)

```sql
-- Validation queries to ensure migration success
SELECT 'Migration Validation Report' as report_section;

-- 1. Record count comparison
SELECT
    'Record Count' as metric,
    (SELECT COUNT(*) FROM notion_sources) as old_count,
    (SELECT COUNT(*) FROM notion_sources_v2) as new_count,
    CASE
        WHEN (SELECT COUNT(*) FROM notion_sources) = (SELECT COUNT(*) FROM notion_sources_v2)
        THEN 'PASS' ELSE 'FAIL'
    END as status;

-- 2. Quality constraint validation
SELECT
    'Quality Constraints' as metric,
    COUNT(*) as enriched_count,
    MIN(quality_score) as min_quality,
    CASE
        WHEN MIN(quality_score) >= 8.5 THEN 'PASS'
        ELSE 'FAIL'
    END as status
FROM notion_sources_v2
WHERE status = 'Enriched';

-- 3. Data type validation
SELECT
    'JSON Fields' as metric,
    COUNT(*) as total_records,
    SUM(CASE WHEN ai_primitives IS NULL OR JSON_VALID(ai_primitives) THEN 1 ELSE 0 END) as valid_ai_primitives,
    SUM(CASE WHEN topical_tags IS NULL OR JSON_VALID(topical_tags) THEN 1 ELSE 0 END) as valid_topical_tags,
    SUM(CASE WHEN domain_tags IS NULL OR JSON_VALID(domain_tags) THEN 1 ELSE 0 END) as valid_domain_tags,
    CASE
        WHEN COUNT(*) = SUM(CASE WHEN ai_primitives IS NULL OR JSON_VALID(ai_primitives) THEN 1 ELSE 0 END)
         AND COUNT(*) = SUM(CASE WHEN topical_tags IS NULL OR JSON_VALID(topical_tags) THEN 1 ELSE 0 END)
         AND COUNT(*) = SUM(CASE WHEN domain_tags IS NULL OR JSON_VALID(domain_tags) THEN 1 ELSE 0 END)
        THEN 'PASS' ELSE 'FAIL'
    END as status
FROM notion_sources_v2;

-- 4. Business logic validation
SELECT
    'Business Logic' as metric,
    COUNT(*) as total_enriched,
    SUM(CASE WHEN quality_score >= 8.5 THEN 1 ELSE 0 END) as valid_quality,
    SUM(CASE WHEN drive_url IS NOT NULL OR article_url IS NOT NULL THEN 1 ELSE 0 END) as has_source,
    CASE
        WHEN COUNT(*) = SUM(CASE WHEN quality_score >= 8.5 THEN 1 ELSE 0 END)
        THEN 'PASS' ELSE 'FAIL'
    END as quality_status
FROM notion_sources_v2
WHERE status = 'Enriched';
```

### Phase 5: Performance Optimization (Days 11-12)

```sql
-- Analyze query performance and optimize indexes
EXPLAIN FORMAT=JSON
SELECT * FROM notion_sources_v2
WHERE status = 'Enriched'
  AND quality_score >= 9.0
  AND enriched_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY quality_score DESC, enriched_date DESC
LIMIT 20;

-- Add additional indexes based on usage patterns
CREATE INDEX idx_high_quality_recent ON notion_sources_v2(
    status, quality_score DESC, enriched_date DESC
) WHERE quality_score >= 8.5;

-- Partition table by date for better performance
ALTER TABLE notion_sources_v2
PARTITION BY RANGE (YEAR(created_date)) (
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

## Rollback Procedures

### Emergency Rollback Plan

```sql
-- Rollback procedure if issues arise
DELIMITER $$

CREATE PROCEDURE RollbackToV1()
BEGIN
    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- Log rollback start
    INSERT INTO schema_migration_log (migration_step)
    VALUES ('rollback_start');

    -- Rename tables for safety
    RENAME TABLE
        notion_sources TO notion_sources_backup,
        notion_sources_v2 TO notion_sources_v2_backup,
        notion_sources_original TO notion_sources;

    -- Update application configuration
    UPDATE system_config
    SET config_value = 'v1'
    WHERE config_key = 'notion_schema_version';

    -- Log rollback completion
    UPDATE schema_migration_log
    SET completed_at = CURRENT_TIMESTAMP, success = TRUE
    WHERE migration_step = 'rollback_start'
    AND completed_at IS NULL;

    COMMIT;

END$$

DELIMITER ;
```

### Data Recovery Procedures

```sql
-- Recover specific records if needed
CREATE PROCEDURE RecoverRecord(IN record_id VARCHAR(255))
BEGIN
    -- Copy record from backup to current table
    INSERT INTO notion_sources_v2
    SELECT * FROM notion_sources_backup
    WHERE id = record_id;

    -- Log recovery
    INSERT INTO schema_migration_log (migration_step, records_affected)
    VALUES ('record_recovery', 1);
END;
```

## Monitoring and Alerts

### Database Health Monitoring

```sql
-- Daily health check queries
CREATE VIEW v_schema_health AS
SELECT
    'Quality Constraint Violations' as check_name,
    COUNT(*) as violation_count,
    CASE WHEN COUNT(*) = 0 THEN 'HEALTHY' ELSE 'ALERT' END as status
FROM notion_sources_v2
WHERE status = 'Enriched' AND quality_score < 8.5

UNION ALL

SELECT
    'Processing Time SLA Violations' as check_name,
    COUNT(*) as violation_count,
    CASE WHEN COUNT(*) = 0 THEN 'HEALTHY' ELSE 'ALERT' END as status
FROM notion_sources_v2
WHERE processing_time_ms > 45000

UNION ALL

SELECT
    'Block Count Violations' as check_name,
    COUNT(*) as violation_count,
    CASE WHEN COUNT(*) = 0 THEN 'HEALTHY' ELSE 'ALERT' END as status
FROM notion_sources_v2
WHERE block_count > 20;

-- Performance monitoring view
CREATE VIEW v_performance_metrics AS
SELECT
    DATE(enriched_date) as date,
    COUNT(*) as processed_count,
    AVG(quality_score) as avg_quality,
    AVG(processing_time_ms) as avg_processing_time,
    AVG(block_count) as avg_block_count,
    MIN(quality_score) as min_quality,
    MAX(processing_time_ms) as max_processing_time
FROM notion_sources_v2
WHERE status = 'Enriched'
  AND enriched_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(enriched_date)
ORDER BY date DESC;
```

## Success Criteria

### Migration Success Metrics

```python
MIGRATION_SUCCESS_CRITERIA = {
    'data_integrity': {
        'record_count_match': '100%',
        'data_quality_preserved': '99.9%',
        'constraint_violations': '0'
    },
    'performance': {
        'query_performance_improvement': '>50%',
        'storage_reduction': '>60%',
        'index_efficiency': '>90%'
    },
    'application_compatibility': {
        'api_response_time': '<200ms',
        'error_rate': '<0.1%',
        'feature_parity': '100%'
    },
    'business_continuity': {
        'downtime': '<30 minutes',
        'data_loss': '0 records',
        'user_impact': 'minimal'
    }
}
```

This migration plan ensures a safe, validated transition to the new schema while maintaining data integrity and providing clear rollback procedures if issues arise. The new schema enforces quality at the database level and provides comprehensive tracking of performance metrics.