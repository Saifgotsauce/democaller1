const https = require('https');

module.exports = async (req, res) => {
    // CORS
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    try {
        const { phone_number, business_name, owner_name, password_hash } = req.body || {};
        
        // Debug env vars
        const envStatus = {
            API_KEY: !!process.env.ELEVENLABS_API_KEY,
            AGENT_ID: !!process.env.ELEVENLABS_AGENT_ID,
            PHONE_ID: !!process.env.ELEVENLABS_PHONE_NUMBER_ID,
            PASSWORD_HASH: !!process.env.ACCESS_PASSWORD_HASH
        };
        
        console.log('Env vars check:', envStatus);
        
        if (!envStatus.PASSWORD_HASH) {
            return res.status(500).json({ error: 'PASSWORD_HASH not set' });
        }
        
        if (password_hash?.toLowerCase() !== process.env.ACCESS_PASSWORD_HASH.toLowerCase()) {
            return res.status(401).json({ error: 'Wrong password' });
        }
        
        if (!envStatus.API_KEY || !envStatus.AGENT_ID || !envStatus.PHONE_ID) {
            return res.status(500).json({ 
                error: 'Missing env vars', 
                missing: Object.keys(envStatus).filter(k => !envStatus[k])
            });
        }

        const payload = JSON.stringify({
            agent_id: process.env.ELEVENLABS_AGENT_ID,
            agent_phone_number_id: process.env.ELEVENLABS_PHONE_NUMBER_ID,
            to_number: phone_number,
            conversation_initiation_client_data: {
                dynamic_variables: {
                    business_name: business_name,
                    owner_name: owner_name || ''
                }
            }
        });

        const options = {
            hostname: 'api.us.elevenlabs.io',
            path: '/v1/convai/twilio/outbound-call',
            method: 'POST',
            headers: {
                'xi-api-key': process.env.ELEVENLABS_API_KEY,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const response = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ status: res.statusCode, data }));
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
        });

        const data = JSON.parse(response.data);
        
        if (response.status !== 200) {
            return res.status(response.status).json({ 
                error: data.detail || `API error: ${response.status}` 
            });
        }

        return res.json({
            success: true,
            conversation_id: data.conversation_id,
            message: `Call started to ${business_name}`
        });

    } catch (err) {
        console.error('CRASH:', err);
        return res.status(500).json({ 
            error: err.message,
            stack: err.stack 
        });
    }
};
