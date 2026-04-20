# Cloudinary Setup Instructions

## 1. Create Cloudinary Account

1. Go to: https://cloudinary.com/users/register/free
2. Sign up with email or Google/GitHub
3. Choose **Free tier** (generous limits: 25GB storage, 25GB bandwidth/month)

## 2. Get Your Credentials

After logging in:
1. Go to: https://cloudinary.com/console
2. You'll see your **Account Details**:
   - **Cloud Name**: e.g., `dxxxxx123`
   - **API Key**: e.g., `123456789012345`
   - **API Secret**: e.g., `AbCdEfGhIjKlMnOp`

## 3. Add to .env File

Update these lines in `.env`:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

Example:
```env
CLOUDINARY_CLOUD_NAME=dxxxxx123
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=AbCdEfGhIjKlMnOp
CLOUDINARY_URL=cloudinary://123456789012345:AbCdEfGhIjKlMnOp@dxxxxx123
```

## 4. Add to Render Dashboard

After deploying:
1. Go to: https://dashboard.render.com/
2. Find your service (autopost-app)
3. Go to **Environment** tab
4. Add the same 4 variables

## 5. Free Tier Limits

- **Storage**: 25 GB
- **Bandwidth**: 25 GB/month
- **Transformations**: 25,000/month
- **Uploads**: Unlimited
- **Admin API**: 500 requests/hour

## 6. Features You'll Get

✅ Automatic image/video optimization
✅ CDN delivery (fast worldwide)
✅ Automatic format conversion (WebP, AVIF)
✅ On-the-fly transformations (resize, crop, filters)
✅ Secure uploads with validation
✅ Backup and versioning

## 7. Security Benefits

- Files stored on Cloudinary CDN (not your server)
- Automatic malware scanning
- File type validation
- Size limits enforced
- Signed URLs for private content

---

**Next Steps**:
1. Create Cloudinary account
2. Copy credentials
3. Send them to me or add to .env manually
4. I'll implement the upload endpoint
