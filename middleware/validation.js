/**
 * Data Validation and Sanitization Middleware
 * Provides comprehensive input validation, sanitization, and security checks
 */

const validator = require('validator');

// Validation schemas for different entity types
const validationSchemas = {
  product: {
    product_id: { required: true, type: 'string', maxLength: 100, pattern: /^[a-zA-Z0-9_-]+$/ },
    name: { required: true, type: 'string', maxLength: 255 },
    code: { required: true, type: 'string', maxLength: 50, pattern: /^[A-Z0-9]+$/ },
    batch_code: { required: false, type: 'string', maxLength: 50 },
    ingredients_type: { required: false, type: 'string', enum: ['with-cocoa', 'without-cocoa'] },
    has_cream: { required: false, type: 'boolean' },
    standard_weight: { required: false, type: 'number', min: 0, max: 10000 },
    shelf_life: { required: false, type: 'integer', min: 1, max: 60 },
    cartons_per_pallet: { required: false, type: 'integer', min: 1, max: 200 },
    packs_per_box: { required: false, type: 'integer', min: 1, max: 50 },
    boxes_per_carton: { required: false, type: 'integer', min: 1, max: 100 },
    empty_box_weight: { required: false, type: 'number', min: 0, max: 1000 },
    empty_carton_weight: { required: false, type: 'number', min: 0, max: 5000 },
    aql_level: { required: false, type: 'string', enum: ['0.1', '0.15', '0.25', '0.4', '0.65', '1.0', '1.5', '2.5', '4.0', '6.5'] },
    day_format: { required: false, type: 'string', enum: ['D', 'DD', 'DDD'] },
    month_format: { required: false, type: 'string', enum: ['M', 'MM', 'MMM', 'letter', 'number'] },
    description: { required: false, type: 'string', maxLength: 1000 },
    notes: { required: false, type: 'string', maxLength: 2000 }
  },

  report: {
    product_id: { required: true, type: 'uuid' },
    batch_no: { required: true, type: 'string', maxLength: 100, pattern: /^[a-zA-Z0-9_-]+$/ },
    report_date: { required: true, type: 'date' },
    shift: { required: true, type: 'string', enum: ['morning', 'afternoon', 'night', 'day', 'evening'] },
    shift_duration: { required: false, type: 'string', enum: ['4_hours', '6_hours', '8_hours', '10_hours', '12_hours'] },
    production_line: { required: false, type: 'string', maxLength: 50 },
    operator_name: { required: false, type: 'string', maxLength: 255 },
    supervisor_name: { required: false, type: 'string', maxLength: 255 },
    qc_inspector: { required: false, type: 'string', maxLength: 255 },
    status: { required: false, type: 'string', enum: ['draft', 'submitted', 'approved', 'rejected'] },
    score: { required: false, type: 'number', min: 0, max: 100 },
    defects_count: { required: false, type: 'integer', min: 0 },
    total_inspected: { required: false, type: 'integer', min: 0 },
    pass_rate: { required: false, type: 'number', min: 0, max: 100 },
    notes: { required: false, type: 'string', maxLength: 2000 },
    rejection_reason: { required: false, type: 'string', maxLength: 1000 }
  },

  signature: {
    name: { required: true, type: 'string', maxLength: 255 },
    role: { required: true, type: 'string', maxLength: 100 },
    department: { required: false, type: 'string', maxLength: 100 },
    signature_data: { required: false, type: 'string', maxLength: 100000 }, // Base64 image data
    is_default: { required: false, type: 'boolean' }
  },

  notification: {
    notification_type: { required: true, type: 'string', enum: ['quality_alert', 'system_alert', 'reminder', 'maintenance', 'audit'] },
    title: { required: true, type: 'string', maxLength: 255 },
    message: { required: true, type: 'string', maxLength: 2000 },
    severity: { required: false, type: 'string', enum: ['info', 'warning', 'error', 'critical'] },
    target_users: { required: false, type: 'array' },
    related_entity: { required: false, type: 'string', maxLength: 50 },
    related_id: { required: false, type: 'uuid' },
    expires_hours: { required: false, type: 'integer', min: 1, max: 8760 } // Max 1 year
  }
};

/**
 * Sanitize string input - remove dangerous characters and trim
 */
function sanitizeString(value, options = {}) {
  if (typeof value !== 'string') return value;
  
  let sanitized = value.trim();
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Escape HTML if not allowing HTML
  if (!options.allowHTML) {
    sanitized = validator.escape(sanitized);
  }
  
  // Remove or escape SQL injection patterns
  if (options.preventSQLInjection !== false) {
    sanitized = sanitized.replace(/(['";\\])/g, '\\$1');
  }
  
  return sanitized;
}

/**
 * Validate UUID format
 */
function isValidUUID(uuid) {
  return validator.isUUID(uuid);
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  return validator.isEmail(email);
}

/**
 * Validate date format and range
 */
function isValidDate(dateString, options = {}) {
  if (!dateString) return false;
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return false;
  
  // Check if date is in reasonable range
  const minYear = options.minYear || 2020;
  const maxYear = options.maxYear || 2030;
  const year = date.getFullYear();
  
  return year >= minYear && year <= maxYear;
}

/**
 * Validate and sanitize a single field
 */
function validateField(fieldName, value, schema) {
  const errors = [];
  const rules = schema[fieldName];
  
  if (!rules) return { valid: true, sanitizedValue: value, errors: [] };
  
  // Check required fields
  if (rules.required && (value === undefined || value === null || value === '')) {
    errors.push(`${fieldName} is required`);
    return { valid: false, sanitizedValue: value, errors };
  }
  
  // Skip validation if value is not provided and not required
  if (value === undefined || value === null || value === '') {
    return { valid: true, sanitizedValue: value, errors: [] };
  }
  
  let sanitizedValue = value;
  
  // Type validation and sanitization
  switch (rules.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push(`${fieldName} must be a string`);
        break;
      }
      
      sanitizedValue = sanitizeString(value);
      
      // Length validation
      if (rules.maxLength && sanitizedValue.length > rules.maxLength) {
        errors.push(`${fieldName} must be no more than ${rules.maxLength} characters`);
      }
      
      if (rules.minLength && sanitizedValue.length < rules.minLength) {
        errors.push(`${fieldName} must be at least ${rules.minLength} characters`);
      }
      
      // Pattern validation
      if (rules.pattern && !rules.pattern.test(sanitizedValue)) {
        errors.push(`${fieldName} format is invalid`);
      }
      
      // Enum validation
      if (rules.enum && !rules.enum.includes(sanitizedValue)) {
        errors.push(`${fieldName} must be one of: ${rules.enum.join(', ')}`);
      }
      
      break;
      
    case 'number':
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        errors.push(`${fieldName} must be a valid number`);
        break;
      }
      
      sanitizedValue = numValue;
      
      // Range validation
      if (rules.min !== undefined && numValue < rules.min) {
        errors.push(`${fieldName} must be at least ${rules.min}`);
      }
      
      if (rules.max !== undefined && numValue > rules.max) {
        errors.push(`${fieldName} must be no more than ${rules.max}`);
      }
      
      break;
      
    case 'integer':
      const intValue = parseInt(value, 10);
      if (isNaN(intValue) || intValue !== parseFloat(value)) {
        errors.push(`${fieldName} must be a valid integer`);
        break;
      }
      
      sanitizedValue = intValue;
      
      // Range validation
      if (rules.min !== undefined && intValue < rules.min) {
        errors.push(`${fieldName} must be at least ${rules.min}`);
      }
      
      if (rules.max !== undefined && intValue > rules.max) {
        errors.push(`${fieldName} must be no more than ${rules.max}`);
      }
      
      break;
      
    case 'boolean':
      if (typeof value === 'boolean') {
        sanitizedValue = value;
      } else if (typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(lowerValue)) {
          sanitizedValue = true;
        } else if (['false', '0', 'no', 'off'].includes(lowerValue)) {
          sanitizedValue = false;
        } else {
          errors.push(`${fieldName} must be a valid boolean value`);
        }
      } else {
        errors.push(`${fieldName} must be a boolean`);
      }
      
      break;
      
    case 'uuid':
      if (typeof value !== 'string' || !isValidUUID(value)) {
        errors.push(`${fieldName} must be a valid UUID`);
      } else {
        sanitizedValue = value.toLowerCase();
      }
      
      break;
      
    case 'email':
      if (typeof value !== 'string' || !isValidEmail(value)) {
        errors.push(`${fieldName} must be a valid email address`);
      } else {
        sanitizedValue = value.toLowerCase().trim();
      }
      
      break;
      
    case 'date':
      if (!isValidDate(value)) {
        errors.push(`${fieldName} must be a valid date`);
      } else {
        sanitizedValue = new Date(value).toISOString().split('T')[0]; // YYYY-MM-DD format
      }
      
      break;
      
    case 'array':
      if (!Array.isArray(value)) {
        errors.push(`${fieldName} must be an array`);
      } else {
        sanitizedValue = value.map(item => 
          typeof item === 'string' ? sanitizeString(item) : item
        );
      }
      
      break;
      
    default:
      // Unknown type, just sanitize if string
      if (typeof value === 'string') {
        sanitizedValue = sanitizeString(value);
      }
  }
  
  return {
    valid: errors.length === 0,
    sanitizedValue,
    errors
  };
}

/**
 * Validate entire object against schema
 */
function validateObject(data, schemaName) {
  const schema = validationSchemas[schemaName];
  if (!schema) {
    throw new Error(`Unknown validation schema: ${schemaName}`);
  }
  
  const errors = [];
  const sanitizedData = {};
  
  // Validate known fields
  for (const [fieldName, value] of Object.entries(data)) {
    const validation = validateField(fieldName, value, schema);
    
    if (!validation.valid) {
      errors.push(...validation.errors);
    } else {
      sanitizedData[fieldName] = validation.sanitizedValue;
    }
  }
  
  // Check for missing required fields
  for (const [fieldName, rules] of Object.entries(schema)) {
    if (rules.required && !(fieldName in data)) {
      errors.push(`${fieldName} is required`);
    }
  }
  
  return {
    valid: errors.length === 0,
    data: sanitizedData,
    errors
  };
}

/**
 * Express middleware factory for request validation
 */
function createValidationMiddleware(schemaName, options = {}) {
  return (req, res, next) => {
    try {
      const dataSource = options.source || 'body'; // 'body', 'query', 'params'
      const data = req[dataSource];
      
      if (!data) {
        return res.status(400).json({
          error: 'Validation failed',
          message: `No ${dataSource} data provided`,
          timestamp: new Date().toISOString()
        });
      }
      
      const validation = validateObject(data, schemaName);
      
      if (!validation.valid) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Invalid input data',
          details: validation.errors,
          timestamp: new Date().toISOString()
        });
      }
      
      // Replace the original data with sanitized version
      req[dataSource] = validation.data;
      
      next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      res.status(500).json({
        error: 'Validation error',
        message: 'An error occurred during validation',
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * General security middleware for request sanitization
 */
function securityMiddleware(req, res, next) {
  // Sanitize query parameters
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') {
      req.query[key] = sanitizeString(value);
    }
  }
  
  // Add security headers if not already present
  if (!res.get('X-Content-Type-Options')) {
    res.set('X-Content-Type-Options', 'nosniff');
  }
  
  if (!res.get('X-Frame-Options')) {
    res.set('X-Frame-Options', 'DENY');
  }
  
  if (!res.get('X-XSS-Protection')) {
    res.set('X-XSS-Protection', '1; mode=block');
  }
  
  next();
}

/**
 * Rate limiting middleware (basic implementation)
 */
const rateLimitMap = new Map();

function rateLimitMiddleware(options = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
  const maxRequests = options.maxRequests || 100;
  
  return (req, res, next) => {
    const clientId = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get or create client record
    let clientData = rateLimitMap.get(clientId) || { requests: [], blocked: false };
    
    // Remove old requests
    clientData.requests = clientData.requests.filter(timestamp => timestamp > windowStart);
    
    // Check if client is blocked
    if (clientData.blocked && clientData.blockedUntil > now) {
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((clientData.blockedUntil - now) / 1000),
        timestamp: new Date().toISOString()
      });
    }
    
    // Check request count
    if (clientData.requests.length >= maxRequests) {
      clientData.blocked = true;
      clientData.blockedUntil = now + windowMs;
      rateLimitMap.set(clientId, clientData);
      
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000),
        timestamp: new Date().toISOString()
      });
    }
    
    // Add current request
    clientData.requests.push(now);
    clientData.blocked = false;
    rateLimitMap.set(clientId, clientData);
    
    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': (maxRequests - clientData.requests.length).toString(),
      'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
    });
    
    next();
  };
}

// Cleanup rate limit data periodically
setInterval(() => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  
  for (const [clientId, clientData] of rateLimitMap.entries()) {
    // Remove expired entries
    clientData.requests = clientData.requests.filter(timestamp => timestamp > now - windowMs);
    
    if (clientData.requests.length === 0 && (!clientData.blocked || clientData.blockedUntil <= now)) {
      rateLimitMap.delete(clientId);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

module.exports = {
  validateField,
  validateObject,
  createValidationMiddleware,
  securityMiddleware,
  rateLimitMiddleware,
  sanitizeString,
  isValidUUID,
  isValidEmail,
  isValidDate,
  validationSchemas
};