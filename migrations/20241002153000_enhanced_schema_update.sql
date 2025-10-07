-- Migration: Enhanced Schema Update
-- Created: 2024-10-02T15:30:00.000Z
-- 
-- Description: Add enhanced features for better data storage and reporting
--
-- This migration adds new tables and features for improved analytics and data management

-- Add enhanced data aggregation table for faster reporting
CREATE TABLE IF NOT EXISTS report_aggregates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    aggregation_type VARCHAR(50) NOT NULL, -- daily, weekly, monthly, shift
    aggregation_key VARCHAR(100) NOT NULL, -- date/period identifier
    total_reports INTEGER DEFAULT 0,
    passed_reports INTEGER DEFAULT 0,
    failed_reports INTEGER DEFAULT 0,
    average_score DECIMAL(5,2),
    total_defects INTEGER DEFAULT 0,
    total_inspected INTEGER DEFAULT 0,
    pass_rate DECIMAL(5,2),
    data_snapshot JSONB, -- snapshot of key metrics
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, aggregation_type, aggregation_key)
);

-- Performance metrics table for tracking KPIs
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_category VARCHAR(50) NOT NULL, -- quality, production, efficiency
    metric_value DECIMAL(15,6) NOT NULL,
    target_value DECIMAL(15,6),
    unit VARCHAR(20),
    product_id UUID REFERENCES products(id),
    report_id UUID REFERENCES reports(id),
    measurement_date DATE NOT NULL,
    measurement_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Data export logs table for tracking exports
CREATE TABLE IF NOT EXISTS data_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    export_type VARCHAR(50) NOT NULL, -- reports, products, analytics
    export_format VARCHAR(20) NOT NULL, -- csv, xlsx, pdf, json
    export_parameters JSONB, -- filters and options used
    file_name VARCHAR(255),
    file_size BIGINT,
    record_count INTEGER,
    exported_by VARCHAR(255) NOT NULL,
    export_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    download_count INTEGER DEFAULT 0,
    last_downloaded TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'completed' -- pending, completed, failed, expired
);

-- Enhanced notification/alerts system
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_type VARCHAR(50) NOT NULL, -- quality_alert, system_alert, reminder
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'info', -- info, warning, error, critical
    target_users JSONB, -- array of user IDs/roles
    related_entity VARCHAR(50), -- reports, products, settings
    related_id UUID,
    metadata JSONB, -- additional notification data
    is_read BOOLEAN DEFAULT FALSE,
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(255),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Enhanced backup metadata table
CREATE TABLE IF NOT EXISTS backup_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    backup_type VARCHAR(50) NOT NULL, -- full, incremental, reports_only
    backup_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500),
    file_size BIGINT,
    compression_type VARCHAR(20),
    tables_included TEXT[],
    record_counts JSONB, -- count per table
    backup_started TIMESTAMP WITH TIME ZONE NOT NULL,
    backup_completed TIMESTAMP WITH TIME ZONE,
    backup_duration INTEGER, -- seconds
    status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
    error_message TEXT,
    created_by VARCHAR(255),
    retention_until TIMESTAMP WITH TIME ZONE
);

-- Create indexes for the new tables
CREATE INDEX IF NOT EXISTS idx_report_aggregates_product_type ON report_aggregates(product_id, aggregation_type);
CREATE INDEX IF NOT EXISTS idx_report_aggregates_key ON report_aggregates(aggregation_key);
CREATE INDEX IF NOT EXISTS idx_report_aggregates_calculated ON report_aggregates(calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_composite ON performance_metrics(metric_name, product_id, measurement_date);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_category_date ON performance_metrics(metric_category, measurement_date DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_product_date ON performance_metrics(product_id, measurement_date DESC);

CREATE INDEX IF NOT EXISTS idx_data_exports_type_date ON data_exports(export_type, export_date DESC);
CREATE INDEX IF NOT EXISTS idx_data_exports_user ON data_exports(exported_by, export_date DESC);
CREATE INDEX IF NOT EXISTS idx_data_exports_status ON data_exports(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_notifications_type_created ON notifications(notification_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_severity ON notifications(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications USING gin(target_users);

CREATE INDEX IF NOT EXISTS idx_backup_metadata_type_date ON backup_metadata(backup_type, backup_started DESC);
CREATE INDEX IF NOT EXISTS idx_backup_metadata_status ON backup_metadata(status, backup_completed);
CREATE INDEX IF NOT EXISTS idx_backup_metadata_retention ON backup_metadata(retention_until) WHERE status = 'completed';

-- Add constraints for the new tables
ALTER TABLE performance_metrics ADD CONSTRAINT IF NOT EXISTS chk_metric_category 
    CHECK (metric_category IN ('quality', 'production', 'efficiency', 'safety', 'cost'));

ALTER TABLE notifications ADD CONSTRAINT IF NOT EXISTS chk_notification_severity 
    CHECK (severity IN ('info', 'warning', 'error', 'critical'));
ALTER TABLE notifications ADD CONSTRAINT IF NOT EXISTS chk_notification_type 
    CHECK (notification_type IN ('quality_alert', 'system_alert', 'reminder', 'maintenance', 'audit'));

ALTER TABLE data_exports ADD CONSTRAINT IF NOT EXISTS chk_export_format 
    CHECK (export_format IN ('csv', 'xlsx', 'pdf', 'json', 'xml'));
ALTER TABLE data_exports ADD CONSTRAINT IF NOT EXISTS chk_export_status 
    CHECK (status IN ('pending', 'completed', 'failed', 'expired'));

-- Function to calculate and update report aggregates
CREATE OR REPLACE FUNCTION update_report_aggregates(report_uuid UUID)
RETURNS VOID AS $$
DECLARE
    report_rec RECORD;
    daily_key TEXT;
    weekly_key TEXT;
    monthly_key TEXT;
BEGIN
    -- Get report details
    SELECT * INTO report_rec FROM reports WHERE id = report_uuid;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Calculate aggregation keys
    daily_key := report_rec.report_date::TEXT;
    weekly_key := date_trunc('week', report_rec.report_date)::TEXT;
    monthly_key := date_trunc('month', report_rec.report_date)::TEXT;
    
    -- Update daily aggregates
    INSERT INTO report_aggregates (
        product_id, aggregation_type, aggregation_key,
        total_reports, passed_reports, failed_reports, average_score,
        total_defects, total_inspected, pass_rate
    )
    SELECT 
        product_id,
        'daily',
        daily_key,
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'approved'),
        COUNT(*) FILTER (WHERE status = 'rejected'),
        AVG(score),
        SUM(defects_count),
        SUM(total_inspected),
        AVG(pass_rate)
    FROM reports 
    WHERE product_id = report_rec.product_id 
      AND report_date = report_rec.report_date
    GROUP BY product_id
    ON CONFLICT (product_id, aggregation_type, aggregation_key) 
    DO UPDATE SET
        total_reports = EXCLUDED.total_reports,
        passed_reports = EXCLUDED.passed_reports,
        failed_reports = EXCLUDED.failed_reports,
        average_score = EXCLUDED.average_score,
        total_defects = EXCLUDED.total_defects,
        total_inspected = EXCLUDED.total_inspected,
        pass_rate = EXCLUDED.pass_rate,
        calculated_at = CURRENT_TIMESTAMP;
        
END;
$$ LANGUAGE plpgsql;

-- Function to track performance metrics
CREATE OR REPLACE FUNCTION track_performance_metric(
    p_metric_name VARCHAR(100),
    p_metric_category VARCHAR(50),
    p_metric_value DECIMAL(15,6),
    p_target_value DECIMAL(15,6) DEFAULT NULL,
    p_unit VARCHAR(20) DEFAULT NULL,
    p_product_id UUID DEFAULT NULL,
    p_report_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    metric_id UUID;
BEGIN
    INSERT INTO performance_metrics (
        metric_name, metric_category, metric_value, target_value, 
        unit, product_id, report_id, measurement_date
    ) VALUES (
        p_metric_name, p_metric_category, p_metric_value, p_target_value,
        p_unit, p_product_id, p_report_id, CURRENT_DATE
    ) RETURNING id INTO metric_id;
    
    RETURN metric_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create system notifications
CREATE OR REPLACE FUNCTION create_notification(
    p_type VARCHAR(50),
    p_title VARCHAR(255),
    p_message TEXT,
    p_severity VARCHAR(20) DEFAULT 'info',
    p_target_users JSONB DEFAULT '[]',
    p_related_entity VARCHAR(50) DEFAULT NULL,
    p_related_id UUID DEFAULT NULL,
    p_expires_hours INTEGER DEFAULT 720 -- 30 days default
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
BEGIN
    INSERT INTO notifications (
        notification_type, title, message, severity, target_users,
        related_entity, related_id, expires_at
    ) VALUES (
        p_type, p_title, p_message, p_severity, p_target_users,
        p_related_entity, p_related_id, 
        CURRENT_TIMESTAMP + INTERVAL '1 hour' * p_expires_hours
    ) RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- Enhanced function to get comprehensive dashboard data
CREATE OR REPLACE FUNCTION get_dashboard_data(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_product_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    stats_data JSONB;
    recent_reports JSONB;
    alerts_data JSONB;
    metrics_data JSONB;
BEGIN
    -- Set default dates if not provided
    p_start_date := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
    p_end_date := COALESCE(p_end_date, CURRENT_DATE);
    
    -- Get basic statistics
    SELECT get_report_statistics(p_start_date, p_end_date, p_product_id) INTO stats_data;
    
    -- Get recent reports
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', r.id,
            'productName', r.product_name,
            'batchNo', r.batch_no,
            'reportDate', r.report_date,
            'shift', r.shift,
            'status', r.status,
            'score', r.score,
            'passRate', r.pass_rate
        )
    ) INTO recent_reports
    FROM (
        SELECT * FROM reports 
        WHERE (p_product_id IS NULL OR product_id = p_product_id)
          AND report_date BETWEEN p_start_date AND p_end_date
        ORDER BY created_at DESC 
        LIMIT 10
    ) r;
    
    -- Get active alerts/notifications
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', n.id,
            'type', n.notification_type,
            'title', n.title,
            'message', n.message,
            'severity', n.severity,
            'createdAt', n.created_at
        )
    ) INTO alerts_data
    FROM notifications n
    WHERE NOT n.is_read 
      AND n.expires_at > CURRENT_TIMESTAMP
    ORDER BY n.created_at DESC
    LIMIT 5;
    
    -- Get key performance metrics
    SELECT jsonb_agg(
        jsonb_build_object(
            'metricName', pm.metric_name,
            'category', pm.metric_category,
            'value', pm.metric_value,
            'targetValue', pm.target_value,
            'unit', pm.unit,
            'measurementDate', pm.measurement_date
        )
    ) INTO metrics_data
    FROM (
        SELECT DISTINCT ON (metric_name) 
            metric_name, metric_category, metric_value, target_value, unit, measurement_date
        FROM performance_metrics
        WHERE (p_product_id IS NULL OR product_id = p_product_id)
          AND measurement_date BETWEEN p_start_date AND p_end_date
        ORDER BY metric_name, measurement_date DESC
    ) pm;
    
    -- Build final result
    result := jsonb_build_object(
        'statistics', COALESCE(stats_data, '{}'::jsonb),
        'recentReports', COALESCE(recent_reports, '[]'::jsonb),
        'alerts', COALESCE(alerts_data, '[]'::jsonb),
        'keyMetrics', COALESCE(metrics_data, '[]'::jsonb),
        'generatedAt', CURRENT_TIMESTAMP
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to perform data backup
CREATE OR REPLACE FUNCTION create_data_backup(
    p_backup_type VARCHAR(50) DEFAULT 'full',
    p_backup_name VARCHAR(255) DEFAULT NULL,
    p_retention_days INTEGER DEFAULT 30
)
RETURNS UUID AS $$
DECLARE
    backup_id UUID;
    backup_name VARCHAR(255);
BEGIN
    -- Generate backup name if not provided
    backup_name := COALESCE(
        p_backup_name, 
        'backup_' || p_backup_type || '_' || to_char(CURRENT_TIMESTAMP, 'YYYY-MM-DD_HH24-MI-SS')
    );
    
    -- Insert backup metadata
    INSERT INTO backup_metadata (
        backup_type, backup_name, backup_started, 
        retention_until, created_by, status
    ) VALUES (
        p_backup_type, backup_name, CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP + INTERVAL '1 day' * p_retention_days,
        current_setting('app.current_user_id', true), 'pending'
    ) RETURNING id INTO backup_id;
    
    RETURN backup_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update aggregates when reports change
CREATE OR REPLACE FUNCTION auto_update_aggregates()
RETURNS TRIGGER AS $$
BEGIN
    -- Update aggregates for the affected report
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM update_report_aggregates(NEW.id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM update_report_aggregates(OLD.id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_auto_update_aggregates'
    ) THEN
        CREATE TRIGGER trigger_auto_update_aggregates
            AFTER INSERT OR UPDATE OR DELETE ON reports
            FOR EACH ROW EXECUTE FUNCTION auto_update_aggregates();
    END IF;
END
$$;

-- Trigger to automatically track metrics when reports are created/updated
CREATE OR REPLACE FUNCTION auto_track_report_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Track report creation metric
    IF TG_OP = 'INSERT' THEN
        PERFORM track_performance_metric(
            'reports_created',
            'quality',
            1,
            NULL,
            'count',
            NEW.product_id,
            NEW.id
        );
    END IF;
    
    -- Track quality score metric when report is approved
    IF TG_OP = 'UPDATE' AND OLD.status != 'approved' AND NEW.status = 'approved' THEN
        PERFORM track_performance_metric(
            'quality_score',
            'quality',
            NEW.score,
            90, -- target score
            'percentage',
            NEW.product_id,
            NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_auto_track_report_metrics'
    ) THEN
        CREATE TRIGGER trigger_auto_track_report_metrics
            AFTER INSERT OR UPDATE ON reports
            FOR EACH ROW EXECUTE FUNCTION auto_track_report_metrics();
    END IF;
END
$$;