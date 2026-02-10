/**
 * MVMNT Demo Trigger - Serverless Function
 * Updated for ElevenLabs Twilio Outbound Call API
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
            error:
