# AutoPost - Security & Data Storage Audit

## 1. PHOTO & VIDEO STORAGE

### Current Implementation:
**Storage Method**: URL references only (NO local file storage)

### How it works:
1. Media is stored as URLs in MongoDB (Post.media array)
2. When publishing, files are fetched from URLs on-the-fly
3. Data URIs (base64) are supported for direct uploads
4. NO multer or file upload endpoints exist

### Storage Flow:
```
User adds media URL → Saved to MongoDB → Published to platform
                                          ↓
                              Fetched from URL at publish time
                              (axios.get with vUrl validation)
```

### Media Types Supported:
- Images (JPEG, PNG, etc.)
- Videos (MP4, MOV, AVI, WMV)
- Base64 data URIs (inline images)

### Storage Location:
- ❌ NO local file system storage
- ❌ NO cloud storage (AWS S3, etc.)
- ✅ URLs stored in MongoDB (Post.media array)
- ✅ External platforms store actual files (VK, OK, Telegram, etc.)

### Security Implications:
⚠️ **No file validation** - URLs are validated only for private network access
⚠️ **No file size limits** on media downloads
⚠️ **Temporary memory storage** only (Buffer) during publish
✅ **SSRF protection** - vUrl() blocks private IPs (10.x, 192.168.x, 127.x)

---

## 2. TOKEN & PASSWORD STORAGE

### OAuth Tokens (VK, OK, Telegram, Twitter, TenChat):

**Storage**: MongoDB `Account.encryptedToken` field
**Encryption**: AES (CryptoJS.AES.encrypt)
**Key**: `process.env.ENCRYPTION_KEY` (from .env)

```javascript
// Encryption (line 215):
const enc = t => t ? CryptoJS.AES.encrypt(t, process.env.ENCRYPTION_KEY).toString() : '';

// Decryption (line 216):
const dec = e => e ? CryptoJS.AES.decrypt(e, process.env.ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8) : '';
```

### Current ENCRYPTION_KEY:
```
5cfe4ec49e2f95437a89b634eb418d54
```
⚠️ **Stored in .env file** - accessible if server is compromised

### OK.ru Secret Keys:
- `Account.okAppSecretKey` - encrypted with same AES key
- `Account.okAppKey` - stored in plain text (public key, OK)

### OAuth State Tokens:
- MongoDB `OAuthState` collection
- Auto-expire after 15 minutes (`expires: '15m'`)
- Used for CSRF protection in OAuth flows

### Application Password (APP_PASSWORD):
**Storage**: `.env` file (process.env.APP_PASSWORD)
**Usage**: Single shared password for login
**Session**: Signed cookie (`session_id = 'authenticated'`)

```javascript
// Cookie settings (lines 171-178):
res.cookie('session_id', 'authenticated', { 
  maxAge: 30 * 24 * 60 * 60 * 1000,  // 30 days
  httpOnly: true,                      // ✅ JS cannot access
  secure: process.env.NODE_ENV === 'production',  // ✅ HTTPS only in prod
  sameSite: 'Lax',                     // ✅ CSRF protection
  signed: true,                        // ✅ Cookie signature
  path: '/'
});
```

⚠️ **Cookie secret** - Uses default (needs process.env.COOKIE_SECRET)

---

## 3. SECURITY ASSESSMENT

### ✅ GOOD Security Practices:

1. **Signed Sessions (SEC-002/003)**:
   - httpOnly cookies (JS access blocked)
   - Signed cookies (tamper-proof)
   - Secure flag in production (HTTPS only)
   - SameSite Lax (CSRF protection)

2. **Token Encryption**:
   - All OAuth tokens encrypted at rest
   - AES encryption with custom key
   - Tokens decrypted only in memory

3. **SSRF Protection (SEC-004)**:
   - vUrl() function validates URLs
   - Blocks private networks (10.x, 172.16-31.x, 192.168.x, 127.x)
   - Only HTTP/HTTPS allowed

4. **Rate Limiting**:
   - General: 100 req / 15 min
   - Strict: 10 req / 15 min (login, sensitive)
   - AI: 30 req / hour

5. **Path Traversal Protection (SEC-008)**:
   - Asset paths normalized
   - Checks if file is within distPath
   - Returns 403 for forbidden paths

6. **Cryptographically Secure State (SEC-007)**:
   - `crypto.randomBytes(16)` for OAuth state
   - Prevents CSRF in OAuth flows

7. **Twitter PKCE**:
   - Code verifier + challenge (S256)
   - Secure OAuth 2.0 flow

8. **Retry Logic with Backoff**:
   - Only retries network errors / 5xx / 429
   - Exponential backoff (1s, 2s, 4s)

### ⚠️ SECURITY CONCERNS:

1. **Single Shared Password**:
   - All users share same APP_PASSWORD
   - No user accounts / roles
   - Password in .env file

2. **Encryption Key Storage**:
   - ENCRYPTION_KEY in .env file
   - Same key encrypts all tokens
   - If .env leaked, all tokens can be decrypted

3. **Cookie Secret**:
   - Default secret may be used
   - Should use strong random secret

4. **No Input Validation**:
   - Post text not sanitized (stored as-is)
   - Media URLs not validated beyond SSRF check
   - No XSS protection on stored data

5. **No Audit Logging**:
   - No login attempt logging
   - No token access logging
   - No failed auth tracking

6. **No HTTPS Enforcement**:
   - `secure: NODE_ENV === 'production'`
   - Development allows HTTP cookies

7. **MongoDB Access**:
   - No MongoDB authentication logging
   - All-or-nothing access to database
   - No row-level security

8. **File Upload via URLs**:
   - No file type validation
   - No file size limits
   - Could download malicious files

9. **API Proxies**:
   - `/vk` and `/ok` proxy all requests
   - Could be abused if auth cookie stolen

### 🔴 CRITICAL VULNERABILITIES:

1. **No Password Hashing**:
   - APP_PASSWORD compared in plain text
   - Should use bcrypt/argon2

2. **Predictable Session ID**:
   - Session ID = 'authenticated' (constant)
   - Should be random token per session

3. **No Brute Force Protection**:
   - Rate limit: 10 req/15 min (better than nothing)
   - But no account lockout
   - No progressive delays

---

## 4. RECOMMENDATIONS

### HIGH PRIORITY:

1. **Use bcrypt for APP_PASSWORD**:
   ```javascript
   const hashedPassword = await bcrypt.hash(APP_PASSWORD, 12);
   // Compare: await bcrypt.compare(input, hashedPassword);
   ```

2. **Random Session Tokens**:
   ```javascript
   const sessionId = crypto.randomBytes(64).toString('hex');
   // Store in Redis/MongoDB with expiration
   ```

3. **Strong Cookie Secret**:
   ```env
   COOKIE_SECRET=<64-char-random-string>
   ```

4. **Rotate ENCRYPTION_KEY**:
   - Use stronger key (256-bit minimum)
   - Consider per-token encryption keys

### MEDIUM PRIORITY:

5. **Input Sanitization**:
   - Use DOMPurify on post text
   - Validate media URLs (content-type, size)

6. **Audit Logging**:
   - Log all login attempts
   - Log token decryption events
   - Log publish failures

7. **MongoDB Indexes**:
   - Add indexes on frequently queried fields
   - Enable MongoDB authentication logging

### LOW PRIORITY:

8. **HTTPS Everywhere**:
   - Force HTTPS in production
   - HSTS headers

9. **Content Security Policy**:
   - Add CSP headers
   - Prevent XSS attacks

10. **File Size Limits**:
    - Limit media download size (e.g., 10MB)
    - Add timeout to downloads

---

## 5. COMPLIANCE NOTES

### Data Privacy:
- OAuth tokens = personal data (GDPR)
- Should implement data deletion
- Should inform users about data storage

### Encryption Standards:
- AES (CryptoJS) = acceptable
- But key management needs improvement
- Consider using Node.js crypto module

### Session Management:
- 30-day session = too long for sensitive app
- Recommend 7-14 days with refresh tokens

---

## 6. STORAGE SUMMARY TABLE

| Data Type | Storage Method | Encrypted | Location |
|-----------|---------------|-----------|----------|
| OAuth Tokens | AES Encryption | ✅ Yes | MongoDB (Account) |
| OK Secret Keys | AES Encryption | ✅ Yes | MongoDB (Account) |
| App Password | .env file | ❌ No | Environment |
| Encryption Key | .env file | ❌ No | Environment |
| Media Files | URLs only | ❌ No | MongoDB (Post) |
| Session Cookie | Signed cookie | ✅ Signed | User browser |
| OAuth State | MongoDB | ❌ No | MongoDB (OAuthState) |
| Post Content | MongoDB | ❌ No | MongoDB (Post) |

---

**Last Updated**: Current session
**Risk Level**: MEDIUM (functional but needs hardening)
**Priority**: Fix HIGH items before production use
