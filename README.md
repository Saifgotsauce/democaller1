# MVMNT Demo Trigger

A production-ready web application for triggering live demo calls using the ElevenLabs AI Conversational API during cold calls. The caller stays on the phone with the prospect while the AI demo happens.

## Features

- 🔐 **Secure Authentication** - SHA-256 password hashing with localStorage persistence
- 📞 **Phone Number Formatting** - Real-time (XXX) XXX-XXXX formatting
- ⏱️ **Call Timer** - Track call duration with auto-complete after 5 minutes
- 📊 **Call Log** - Store and export up to 50 recent calls
- 🎉 **Success Feedback** - Confetti animation and toast notifications
- 🛡️ **Rate Limiting** - 10 requests per minute per IP
- 📱 **Responsive Design** - Works on mobile and desktop
- 📤 **CSV Export** - Download call history as CSV

## Tech Stack

- **Frontend**: Vanilla HTML5/CSS3/JavaScript + Tailwind CSS CDN
- **Backend**: Vercel Serverless Functions (Node.js)
- **API**: ElevenLabs Conversational API
- **Security**: SHA-256 hashing, CORS protection, rate limiting

## Quick Start

### 1. Clone or Download

```bash
git clone <your-repo-url>
cd mvmnt-demo-trigger
```

### 2. Deploy to Vercel

#### Option A: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel
```

#### Option B: Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your Git repository or drag-and-drop the project folder
4. Configure environment variables (see below)
5. Click "Deploy"

### 3. Configure Environment Variables

In your Vercel project dashboard, go to **Settings > Environment Variables** and add:

| Variable Name | Value |
|--------------|-------|
| `ELEVENLABS_API_KEY` | `sk_3985b1e5c6e6ae3b8da90af9378bc86308fa7a6e759dd0f9` |
| `ELEVENLABS_AGENT_ID` | `agent_4501kf5q61e9fh9vnmqjnn5jry8e` |
| `ACCESS_PASSWORD_HASH` | `f624559f9b5f9527e0e6be31d871833de5ac1a39221653550155ba5020af2800` |

**Note**: The `ACCESS_PASSWORD_HASH` is the SHA-256 hash of `MVMNT!2026`

### 4. Generate Your Own Password Hash (Optional)

To use a different access password, generate a new SHA-256 hash:

```bash
# Using Node.js
node -e "console.log(require('crypto').createHash('sha256').update('YOUR_PASSWORD').digest('hex'))"

# Using Python
python3 -c "import hashlib; print(hashlib.sha256('YOUR_PASSWORD'.encode()).hexdigest())"

# Online tool
# https://emn178.github.io/online-tools/sha256.html
```

Then update the `ACCESS_PASSWORD_HASH` environment variable in Vercel.

## File Structure

```
project-root/
├── index.html              # Frontend - Vanilla JS + Tailwind CDN
├── api/
│   └── trigger-call.js     # Vercel serverless function
├── vercel.json             # Routing configuration
├── .gitignore              # Standard Node/Vercel ignore
└── README.md               # This file
```

## Usage Guide

### First Time Setup

1. Open the deployed application URL
2. Create an access password (minimum 6 characters)
3. You'll be redirected to the dashboard

### Making a Demo Call

1. **Enter Business Details**:
   - Business Name (required)
   - Phone Number (required) - formats automatically as you type
   - Owner Name (optional)

2. **Click "Start Live Demo Call"**
   - Status will show "Initiating..." then "In Progress"
   - Timer starts counting

3. **During the Call**:
   - The AI agent calls the prospect
   - You stay on the line
   - Timer shows call duration

4. **End the Call**:
   - Click "Mark Complete" or wait for auto-complete (5 min)
   - Call appears in the Recent Calls log

### Managing Call History

- **Export CSV**: Download all call history as a CSV file
- **Clear History**: Remove all call records (cannot be undone)
- **Call Again**: Click "Call Again" on any log entry to refill the form

### Settings

Click the gear icon in the header to:
- Change your access password
- Reset all data and logout

## Testing Checklist

### Functionality Tests

- [ ] First load shows Setup screen
- [ ] Can create password and enter dashboard
- [ ] Logout and login works with correct password
- [ ] Wrong password shows error
- [ ] Phone number formats correctly: (480) 555-1234
- [ ] Submit call triggers serverless function
- [ ] Success shows confetti and toast
- [ ] Call appears in Recent Calls log
- [ ] Timer counts up during "In Progress"
- [ ] "Mark Complete" stops timer
- [ ] Export CSV downloads file with correct data
- [ ] "Call Again" fills form correctly
- [ ] Settings modal opens/closes
- [ ] Change password works
- [ ] Reset All Data clears everything and returns to setup
- [ ] Rate limiting blocks after 10 calls/minute

### Visual Tests

- [ ] Colors match brand (#FF6B35, #004E89, #F7931E)
- [ ] Responsive on mobile (iPhone SE width)
- [ ] Responsive on desktop (1440px width)
- [ ] Buttons have hover states
- [ ] Loading states show spinners
- [ ] Status indicators animate correctly

### Security Tests

- [ ] API key not visible in browser source
- [ ] Network tab shows calls to `/api/trigger-call` only
- [ ] localStorage contains hashed password only

## API Reference

### POST /api/trigger-call

Triggers a demo call via the ElevenLabs API.

**Request Body:**

```json
{
  "phone_number": "+14805551234",
  "business_name": "ABC HVAC",
  "owner_name": "John Smith",
  "password_hash": "sha256_hash_string"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "conversation_id": "conv_abc123xyz",
  "status": "initiated",
  "message": "Demo call initiated to ABC HVAC"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Invalid phone number format | Phone must be +1XXXXXXXXXX |
| 401 | Invalid password | Password hash doesn't match |
| 429 | Too many requests | Rate limit exceeded (10/min) |
| 402 | Insufficient credit | ElevenLabs account balance |
| 500 | Server error | Configuration or API error |

## Troubleshooting

### "Invalid API key" Error

1. Check that `ELEVENLABS_API_KEY` is set in Vercel environment variables
2. Verify the API key is valid at [elevenlabs.io](https://elevenlabs.io)
3. Redeploy after updating environment variables

### "Rate limit exceeded" Error

- Wait 60 seconds before trying again
- The limit is 10 calls per minute per IP address

### Calls Not Appearing in Log

- Check browser console for errors
- Verify localStorage is enabled in your browser
- Try clearing browser cache and reloading

### Password Not Working

- The default password is `MVMNT!2026`
- If you changed it, use the new password
- Use "Reset All Data" to start fresh

### CORS Errors

- Ensure `vercel.json` is properly configured
- Check that the API route is `/api/trigger-call`
- Verify headers are set correctly in Vercel dashboard

## Security Notes

1. **API Key Protection**: The ElevenLabs API key is only stored in Vercel environment variables and never exposed to the browser.

2. **Password Storage**: Passwords are hashed using SHA-256 before storage in localStorage. The plain text password is never stored.

3. **Rate Limiting**: The serverless function implements IP-based rate limiting to prevent abuse.

4. **No Server-Side Storage**: Call logs are stored only in the browser's localStorage. No data persists on the server.

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `ELEVENLABS_API_KEY` | Yes | Your ElevenLabs API key |
| `ELEVENLABS_AGENT_ID` | Yes | Your ElevenLabs agent ID |
| `ACCESS_PASSWORD_HASH` | Yes | SHA-256 hash of access password |

## Credits

- **ElevenLabs**: AI voice technology
- **Tailwind CSS**: Utility-first CSS framework
- **Canvas Confetti**: Celebration animations
- **Inter Font**: Google Fonts

## License

Private - For MVMNT internal use only.

## Support

For issues or questions, contact the development team.
