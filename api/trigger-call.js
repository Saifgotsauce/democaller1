/**
 * MVMNT Demo Trigger - Serverless Function
 */

const rateLimitStore = new Map();

function checkRateLimit(ip, maxRequests = 10, windowMs = 60000) {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    let entry = rateLimitStore.get(ip);
    if (!entry) {
        entry = { requests: [], count: 0 };
        rateLimitStore.set(ip, entry);
    }
    
    entry.requests = entry.requests.filter(time => time > windowStart);
    entry.count = entry.requests.length;
    
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
    
    entry.requests.push(now);
    entry.count++;
    
    return {
        allowed: true,
        remaining: maxRequests - entry.count,
        resetTime: now + windowMs
    };
}

module.exports = async (req, res) => {
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
    
    if (req.method !== 'POST') {
        res.setHeader('Content-Type', 'application/json');
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
    
    // Rate limiting
    const rateLimit = checkRateLimit(clientIp, 10, 60000);
    if (!rateLimit.allowed) {
        res.setHeader('Retry-After', rateLimit.retryAfter.toString());
        return res.status(429).json({
            success: false,
            error: `Too many requests. Try again in ${rateLimit.retryAfter}s.`
        });
    }
    
    try {
        const body = req.body || {};
        const { phone_number, business_name, owner_name, password_hash } = body;
        
        // Validate password
        const expectedHash = process.env.ACCESS_PASSWORD_HASH;
        if (!password_hash || password_hash.toLowerCase() !== expectedHash?.toLowerCase()) {
            return res.status(401).json({ success: false, error: 'Invalid password' });
        }
        
        // Validate phone
        const phoneRegex = /^\+1\d{10}$/;
        if (!phoneRegex.test(phone_number)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid phone format. Use +1XXXXXXXXXX' 
            });
        }
        
        if (!business_name || business_name.trim().length < 2) {
            return res.status(400).json({ 
                success: false, 
                error: 'Business name required' 
            });
        }
        
        // Call ElevenLabs API - CORRECT ENDPOINT
        const apiKey = process.env.ELEVENLABS_API_KEY;
        const agentId = process.env.ELEVENLABS_AGENT_ID;
        
        const response = await fetch('https://api.elevenlabs.io/v1/convai/phone-calls', {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                agent_id: agentId,
                phone_number: phone_number,
                conversation_initiation: {
                    custom_llm_extra_body: {
                        business_name: business_name,
                        owner_name: owner_name || ''
                    }
                }
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || `API error: ${response.status}`);
        }
        
        return res.status(200).json({
            success: true,
            conversation_id: data.conversation_id || data.call_id,
            status: 'initiated',
            message: `Call started to ${business_name}`
        });
        
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Server error'
        });
    }
};
