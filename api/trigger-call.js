/**
 * MVMNT Demo Trigger - Serverless Function
 * 
 * This Vercel serverless function handles demo call triggering via the ElevenLabs API.
 * Features:
 * - CORS handling for cross-origin requests
 * - Rate limiting (10 requests per minute per IP)
 * - Password hash validation
 * - ElevenLabs API integration
 * 
 * Environment Variables Required:
 * - ELEVENLABS_API_KEY: Your ElevenLabs API key
 * - ELEVENLABS_AGENT_ID: Your ElevenLabs agent ID
 * - ACCESS_PASSWORD_HASH: SHA-256 hash of the access password
 */

// ============================================
// RATE LIMITING STORAGE
// ============================================
// In-memory store for rate limiting (resets on function cold start)
const rateLimitStore = new Map();

/**
 * Check if IP has exceeded rate limit
 * @param {string} ip - Client IP address
 * @param {number} maxRequests - Maximum requests allowed per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {object} - { allowed: boolean, remaining: number, resetTime: number }
 */
function checkRateLimit(ip, maxRequests = 10, windowMs = 60000) {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get or create entry for this IP
    let entry = rateLimitStore.get(ip);
    if (!entry) {
        entry = { requests: [], count: 0 };
        rateLimitStore.set(ip, entry);
    }
    
    // Clean up old requests outside the window
    entry.requests = entry.requests.filter(time => time > windowStart);
    entry.count = entry.requests.length;
    
    // Check if limit exceeded
    if (entry.count >= maxRequests) {
        const oldestRequest = entry.requests[0];
        const resetTime = oldestRequest + windowMs;
        return {
            allowed: false,
            remaining: 0,
            resetTime: resetTime,
            retryAfter: Math.ceil((resetTime - now) / 1000)
        };
    }
    
    // Record this request
    entry.requests.push(now);
    entry.count++;
    
    return {
        allowed: true,
        remaining: maxRequests - entry.count,
        resetTime: now + windowMs
    };
}

/**
 * Clean up old rate limit entries periodically
 */
function cleanupRateLimitStore() {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    
    for (const [ip, entry] of rateLimitStore.entries()) {
        if (entry.requests.length === 0 || entry.requests[entry.requests.length - 1] < now - maxAge) {
            rateLimitStore.delete(ip);
        }
    }
}

// Run cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);

// ============================================
// CORS HEADERS
// ============================================
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

// ============================================
// RESPONSE HELPERS
// ============================================
function successResponse(data, statusCode = 200) {
    return {
        statusCode,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: true, ...data })
    };
}

function errorResponse(message, statusCode = 400, extra = {}) {
    return {
        statusCode,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: false, error: message, ...extra })
    };
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate phone number format (+1XXXXXXXXXX)
 */
function validatePhoneNumber(phone) {
    const phoneRegex = /^\+1\d{10}$/;
    return phoneRegex.test(phone);
}

/**
 * Validate business name
 */
function validateBusinessName(name) {
    return name && name.trim().length >= 2;
}

/**
 * Validate password hash
 */
function validatePasswordHash(hash) {
    // SHA-256 hash is 64 hexadecimal characters
    const hashRegex = /^[a-f0-9]{64}$/i;
    return hashRegex.test(hash);
}

// ============================================
// ELEVENLABS API INTEGRATION
// ============================================

/**
 * Trigger a call via ElevenLabs Conversational API
 */
async function triggerElevenLabsCall(phoneNumber, businessName, ownerName) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;
    
    if (!apiKey) {
        throw new Error('ELEVENLABS_API_KEY not configured');
    }
    
    if (!agentId) {
        throw new Error('ELEVENLABS_AGENT_ID not configured');
    }
    
    // Build request body
    const requestBody = {
        agent_id: agentId,
        phone_number: phoneNumber
    };
    
    // Add custom LLM extra body if owner name provided
    if (ownerName && ownerName.trim()) {
        requestBody.custom_llm_extra_body = {
            business_name: businessName,
            owner_name: ownerName.trim()
        };
    }
    
    const response = await fetch('https://api.elevenlabs.io/v1/convai/conversation/phone', {
        method: 'POST',
        headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        // Handle specific ElevenLabs error codes
        switch (response.status) {
            case 401:
                throw new Error('Invalid API key. Check configuration.');
            case 429:
                throw new Error('Rate limit exceeded. Please try again later.');
            case 402:
                throw new Error('Insufficient credit balance.');
            case 400:
                throw new Error(data.detail || 'Invalid request to ElevenLabs API');
            default:
                throw new Error(data.detail || `ElevenLabs API error: ${response.status}`);
        }
    }
    
    return data;
}

// ============================================
// MAIN HANDLER
// ============================================
module.exports = async (req, res) => {
    // Get client IP
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     req.headers['x-real-ip'] || 
                     req.socket?.remoteAddress || 
                     'unknown';
    
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }
    
    // Only allow POST requests
    if (req.method !== 'POST') {
        res.setHeader('Content-Type', 'application/json');
        return res.status(405).json({
            success: false,
            error: 'Method not allowed. Use POST.'
        });
    }
    
    // Check rate limit
    const rateLimit = checkRateLimit(clientIp, 10, 60000);
    if (!rateLimit.allowed) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Retry-After', rateLimit.retryAfter.toString());
        return res.status(429).json({
            success: false,
            error: `Too many requests. Please try again in ${rateLimit.retryAfter} seconds.`,
            retryAfter: rateLimit.retryAfter
        });
    }
    
    try {
        // Parse request body
        const body = req.body || {};
        const { phone_number, business_name, owner_name, password_hash } = body;
        
        // Validate password hash
        if (!password_hash) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required. Password hash missing.'
            });
        }
        
        if (!validatePasswordHash(password_hash)) {
            return res.status(401).json({
                success: false,
                error: 'Invalid password hash format.'
            });
        }
        
        // Compare with stored hash
        const expectedHash = process.env.ACCESS_PASSWORD_HASH;
        if (!expectedHash) {
            console.error('ACCESS_PASSWORD_HASH environment variable not set');
            return res.status(500).json({
                success: false,
                error: 'Server configuration error. Contact administrator.'
            });
        }
        
        if (password_hash.toLowerCase() !== expectedHash.toLowerCase()) {
            return res.status(401).json({
                success: false,
                error: 'Invalid password. Access denied.'
            });
        }
        
        // Validate phone number
        if (!phone_number) {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required.'
            });
        }
        
        if (!validatePhoneNumber(phone_number)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number format. Use +1XXXXXXXXXX (E.164 format).'
            });
        }
        
        // Validate business name
        if (!business_name) {
            return res.status(400).json({
                success: false,
                error: 'Business name is required.'
            });
        }
        
        if (!validateBusinessName(business_name)) {
            return res.status(400).json({
                success: false,
                error: 'Business name must be at least 2 characters.'
            });
        }
        
        // Call ElevenLabs API
        const elevenLabsResponse = await triggerElevenLabsCall(
            phone_number,
            business_name,
            owner_name
        );
        
        // Return success response
        return res.status(200).json({
            success: true,
            conversation_id: elevenLabsResponse.conversation_id || elevenLabsResponse.call_id,
            status: 'initiated',
            message: `Demo call initiated to ${business_name}`,
            rateLimit: {
                remaining: rateLimit.remaining,
                resetTime: new Date(rateLimit.resetTime).toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error in trigger-call:', error);
        
        // Determine appropriate status code
        let statusCode = 500;
        if (error.message.includes('Invalid API key')) statusCode = 401;
        else if (error.message.includes('Rate limit')) statusCode = 429;
        else if (error.message.includes('Insufficient credit')) statusCode = 402;
        else if (error.message.includes('Invalid request')) statusCode = 400;
        
        return res.status(statusCode).json({
            success: false,
            error: error.message || 'An unexpected error occurred. Please try again.'
        });
    }
};
