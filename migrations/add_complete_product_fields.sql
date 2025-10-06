-- ================================================================
-- Migration: Add Complete Product Management Fields
-- Date: 2025-10-03
-- Description: Adds all missing product fields for comprehensive product management
-- ================================================================

-- First, let's add missing columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS doc_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS issue_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS review_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS issue_date DATE,
ADD COLUMN IF NOT EXISTS review_date DATE,
ADD COLUMN IF NOT EXISTS product_type VARCHAR(50) DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS production_line VARCHAR(100),
ADD COLUMN IF NOT EXISTS packaging_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS weight_tolerance_min DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS weight_tolerance_max DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS temperature_min DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS temperature_max DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS humidity_min DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS humidity_max DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS visual_standards JSONB,
ADD COLUMN IF NOT EXISTS quality_parameters JSONB,
ADD COLUMN IF NOT EXISTS packaging_materials JSONB,
ADD COLUMN IF NOT EXISTS allergen_info JSONB,
ADD COLUMN IF NOT EXISTS nutritional_info JSONB,
ADD COLUMN IF NOT EXISTS manufacturing_process JSONB,
ADD COLUMN IF NOT EXISTS storage_conditions TEXT,
ADD COLUMN IF NOT EXISTS distribution_requirements TEXT,
ADD COLUMN IF NOT EXISTS regulatory_compliance JSONB,
ADD COLUMN IF NOT EXISTS certifications JSONB,
ADD COLUMN IF NOT EXISTS supplier_info JSONB,
ADD COLUMN IF NOT EXISTS cost_info JSONB,
ADD COLUMN IF NOT EXISTS images JSONB,
ADD COLUMN IF NOT EXISTS documents JSONB,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create comprehensive product_specifications table for detailed specs
CREATE TABLE IF NOT EXISTS product_specifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    specification_category VARCHAR(100) NOT NULL, -- physical, chemical, microbiological, sensory
    specification_name VARCHAR(255) NOT NULL,
    specification_value TEXT,
    min_value DECIMAL(15,6),
    max_value DECIMAL(15,6),
    target_value DECIMAL(15,6),
    unit VARCHAR(50),
    test_method VARCHAR(255),
    frequency VARCHAR(100),
    critical_control_point BOOLEAN DEFAULT FALSE,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, specification_category, specification_name)
);

-- Create product_quality_attributes table for quality characteristics
CREATE TABLE IF NOT EXISTS product_quality_attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    attribute_category VARCHAR(100) NOT NULL, -- appearance, texture, flavor, odor
    attribute_name VARCHAR(255) NOT NULL,
    attribute_description TEXT,
    acceptable_range TEXT,
    rejection_criteria TEXT,
    inspection_method VARCHAR(255),
    sample_size VARCHAR(100),
    aql_level VARCHAR(20),
    severity VARCHAR(50), -- critical, major, minor
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, attribute_category, attribute_name)
);

-- Create product_packaging_details table
CREATE TABLE IF NOT EXISTS product_packaging_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    packaging_level VARCHAR(50) NOT NULL, -- primary, secondary, tertiary
    material_type VARCHAR(100),
    material_specification TEXT,
    dimensions JSONB, -- {length, width, height, unit}
    weight DECIMAL(10,3),
    weight_unit VARCHAR(20),
    color VARCHAR(100),
    printing_details TEXT,
    barcode_info JSONB,
    recycling_info JSONB,
    supplier VARCHAR(255),
    cost_per_unit DECIMAL(10,4),
    minimum_order_quantity INTEGER,
    lead_time_days INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, packaging_level)
);

-- Create product_production_details table
CREATE TABLE IF NOT EXISTS product_production_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    production_line_id VARCHAR(100),
    production_capacity INTEGER, -- units per hour
    setup_time_minutes INTEGER,
    changeover_time_minutes INTEGER,
    minimum_batch_size INTEGER,
    maximum_batch_size INTEGER,
    optimal_batch_size INTEGER,
    production_steps JSONB, -- array of production steps with timings
    equipment_required JSONB, -- array of equipment needed
    personnel_required JSONB, -- roles and number of people
    quality_checkpoints JSONB, -- array of QC points during production
    standard_operating_procedure TEXT,
    hazard_analysis JSONB, -- HACCP data
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, production_line_id)
);

-- Create product_raw_materials table
CREATE TABLE IF NOT EXISTS product_raw_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    material_name VARCHAR(255) NOT NULL,
    material_code VARCHAR(100),
    material_type VARCHAR(100), -- ingredient, packaging, other
    quantity_per_batch DECIMAL(15,6),
    unit VARCHAR(50),
    supplier_name VARCHAR(255),
    supplier_code VARCHAR(100),
    specification_reference VARCHAR(255),
    allergen_status VARCHAR(100),
    gmo_status VARCHAR(100),
    halal_status VARCHAR(100),
    kosher_status VARCHAR(100),
    organic_status VARCHAR(100),
    cost_per_unit DECIMAL(10,4),
    shelf_life_days INTEGER,
    storage_conditions TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create product_testing_protocols table
CREATE TABLE IF NOT EXISTS product_testing_protocols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    test_category VARCHAR(100) NOT NULL, -- raw_material, in_process, finished_product
    test_name VARCHAR(255) NOT NULL,
    test_description TEXT,
    test_method VARCHAR(255),
    test_equipment VARCHAR(255),
    sample_size VARCHAR(100),
    frequency VARCHAR(100),
    acceptance_criteria TEXT,
    reference_standard VARCHAR(255),
    responsible_department VARCHAR(100),
    documentation_required JSONB,
    is_mandatory BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, test_category, test_name)
);

-- Create product_certifications table
CREATE TABLE IF NOT EXISTS product_certifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    certification_name VARCHAR(255) NOT NULL,
    certification_body VARCHAR(255),
    certification_number VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    scope TEXT,
    requirements TEXT,
    audit_frequency VARCHAR(100),
    last_audit_date DATE,
    next_audit_date DATE,
    documents JSONB, -- array of document references
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create product_cost_breakdown table
CREATE TABLE IF NOT EXISTS product_cost_breakdown (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    cost_category VARCHAR(100) NOT NULL, -- materials, labor, overhead, packaging
    cost_subcategory VARCHAR(100),
    description TEXT,
    cost_per_unit DECIMAL(15,6),
    currency VARCHAR(10) DEFAULT 'USD',
    calculation_method VARCHAR(100),
    last_updated DATE,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_product_specifications_product_id ON product_specifications(product_id);
CREATE INDEX IF NOT EXISTS idx_product_specifications_category ON product_specifications(specification_category);
CREATE INDEX IF NOT EXISTS idx_product_quality_attributes_product_id ON product_quality_attributes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_packaging_details_product_id ON product_packaging_details(product_id);
CREATE INDEX IF NOT EXISTS idx_product_production_details_product_id ON product_production_details(product_id);
CREATE INDEX IF NOT EXISTS idx_product_raw_materials_product_id ON product_raw_materials(product_id);
CREATE INDEX IF NOT EXISTS idx_product_testing_protocols_product_id ON product_testing_protocols(product_id);
CREATE INDEX IF NOT EXISTS idx_product_certifications_product_id ON product_certifications(product_id);
CREATE INDEX IF NOT EXISTS idx_product_cost_breakdown_product_id ON product_cost_breakdown(product_id);

-- Create a comprehensive view for product details
CREATE OR REPLACE VIEW product_complete_details AS
SELECT 
    p.*,
    COUNT(DISTINCT ps.id) as specification_count,
    COUNT(DISTINCT pqa.id) as quality_attribute_count,
    COUNT(DISTINCT ppd.id) as packaging_detail_count,
    COUNT(DISTINCT ppr.id) as production_detail_count,
    COUNT(DISTINCT prm.id) as raw_material_count,
    COUNT(DISTINCT ptp.id) as testing_protocol_count,
    COUNT(DISTINCT pc.id) as certification_count,
    COUNT(DISTINCT pcb.id) as cost_breakdown_count,
    COUNT(DISTINCT r.id) as report_count,
    MAX(r.report_date) as last_report_date
FROM products p
LEFT JOIN product_specifications ps ON p.id = ps.product_id
LEFT JOIN product_quality_attributes pqa ON p.id = pqa.product_id
LEFT JOIN product_packaging_details ppd ON p.id = ppd.product_id
LEFT JOIN product_production_details ppr ON p.id = ppr.product_id
LEFT JOIN product_raw_materials prm ON p.id = prm.product_id
LEFT JOIN product_testing_protocols ptp ON p.id = ptp.product_id
LEFT JOIN product_certifications pc ON p.id = pc.product_id
LEFT JOIN product_cost_breakdown pcb ON p.id = pcb.product_id
LEFT JOIN reports r ON p.id = r.product_id
GROUP BY p.id;

-- Create function to get complete product data
CREATE OR REPLACE FUNCTION get_complete_product_data(p_product_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'product', row_to_json(p.*),
        'specifications', COALESCE(json_agg(DISTINCT ps.*) FILTER (WHERE ps.id IS NOT NULL), '[]'::json),
        'quality_attributes', COALESCE(json_agg(DISTINCT pqa.*) FILTER (WHERE pqa.id IS NOT NULL), '[]'::json),
        'packaging_details', COALESCE(json_agg(DISTINCT ppd.*) FILTER (WHERE ppd.id IS NOT NULL), '[]'::json),
        'production_details', COALESCE(json_agg(DISTINCT ppr.*) FILTER (WHERE ppr.id IS NOT NULL), '[]'::json),
        'raw_materials', COALESCE(json_agg(DISTINCT prm.*) FILTER (WHERE prm.id IS NOT NULL), '[]'::json),
        'testing_protocols', COALESCE(json_agg(DISTINCT ptp.*) FILTER (WHERE ptp.id IS NOT NULL), '[]'::json),
        'certifications', COALESCE(json_agg(DISTINCT pc.*) FILTER (WHERE pc.id IS NOT NULL), '[]'::json),
        'cost_breakdown', COALESCE(json_agg(DISTINCT pcb.*) FILTER (WHERE pcb.id IS NOT NULL), '[]'::json),
        'custom_variables', COALESCE(json_agg(DISTINCT pcv.*) FILTER (WHERE pcv.id IS NOT NULL), '[]'::json),
        'sections', COALESCE(json_agg(DISTINCT jsonb_build_object(
            'section', ps_sec.*,
            'parameters', (
                SELECT json_agg(pp.*)
                FROM product_parameters pp
                WHERE pp.section_id = ps_sec.id
            )
        )) FILTER (WHERE ps_sec.id IS NOT NULL), '[]'::json)
    ) INTO result
    FROM products p
    LEFT JOIN product_specifications ps ON p.id = ps.product_id
    LEFT JOIN product_quality_attributes pqa ON p.id = pqa.product_id
    LEFT JOIN product_packaging_details ppd ON p.id = ppd.product_id
    LEFT JOIN product_production_details ppr ON p.id = ppr.product_id
    LEFT JOIN product_raw_materials prm ON p.id = prm.product_id
    LEFT JOIN product_testing_protocols ptp ON p.id = ptp.product_id
    LEFT JOIN product_certifications pc ON p.id = pc.product_id
    LEFT JOIN product_cost_breakdown pcb ON p.id = pcb.product_id
    LEFT JOIN product_custom_variables pcv ON p.id = pcv.product_id
    LEFT JOIN product_sections ps_sec ON p.id = ps_sec.product_id
    WHERE p.id = p_product_id
    GROUP BY p.id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all new tables
CREATE TRIGGER update_product_specifications_updated_at BEFORE UPDATE ON product_specifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_product_quality_attributes_updated_at BEFORE UPDATE ON product_quality_attributes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_product_packaging_details_updated_at BEFORE UPDATE ON product_packaging_details
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_product_production_details_updated_at BEFORE UPDATE ON product_production_details
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_product_raw_materials_updated_at BEFORE UPDATE ON product_raw_materials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_product_testing_protocols_updated_at BEFORE UPDATE ON product_testing_protocols
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_product_certifications_updated_at BEFORE UPDATE ON product_certifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_product_cost_breakdown_updated_at BEFORE UPDATE ON product_cost_breakdown
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();