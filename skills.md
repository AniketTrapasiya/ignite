# AutoFlow AI - Skills & Prompts

## Authentication Skills

### Skill 1: Sign Up (with OTP Email Verification)

**Flow:**
1. User submits name, email, password
2. Server creates user with hashed password (bcrypt, 12 rounds)
3. Generates 6-digit OTP, stores in `otps` table (10 min expiry)
4. Sends OTP email via SMTP (nodemailer)
5. Redirects to `/verify-otp` page
6. User enters OTP → server verifies → marks `emailVerified = true`
7. Auto-signs in user with JWT cookie (7 days)

**API:** `POST /api/auth/signup`

**Prompt template:**
```
Input: { name, email, password }
Validation: name required, email unique, password >= 8 chars
Output: { message, userId }
Side effect: Send OTP email
```

---

### Skill 2: Sign In

**Flow:**
1. User submits email, password
2. Server finds user by email
3. Compares password with bcrypt
4. If email not verified → redirect to OTP verification
5. Issues JWT token, sets httpOnly cookie
6. Redirects to `/dashboard`

**API:** `POST /api/auth/signin`

**Prompt template:**
```
Input: { email, password }
Validation: email exists, password matches, email verified
Output: { message, user: { id, name, email } }
Side effect: Set auth cookie
```

---

### Skill 3: Forgot Password (Reset Link via Email)

**Flow:**
1. User enters email on forgot-password page
2. Server generates unique reset token (UUID-based)
3. Stores token in `password_resets` table (1 hour expiry)
4. Sends reset link email: `{APP_URL}/reset-password?token={token}`
5. Returns generic success message (prevents email enumeration)

**API:** `POST /api/auth/forgot-password`

**Prompt template:**
```
Input: { email }
Validation: none (always returns success to prevent enumeration)
Output: { message: "If an account exists, a reset link has been sent." }
Side effect: Send reset email if user exists
```

---

### Skill 4: Reset Password

**Flow:**
1. User clicks reset link in email → lands on `/reset-password?token=xxx`
2. Enters new password + confirmation
3. Server validates token (exists, not used, not expired)
4. Hashes new password, updates user, marks token as used
5. Redirects to sign in page

**API:** `POST /api/auth/reset-password`

**Prompt template:**
```
Input: { token, password }
Validation: token valid & not expired, password >= 8 chars
Output: { message: "Password reset successfully" }
Side effect: Update password hash, invalidate token
```

---

### Skill 5: Verify OTP

**Flow:**
1. User enters 6-digit OTP on verification page
2. Server checks OTP against `otps` table (correct code, correct type, not used, not expired)
3. Marks OTP as used
4. For EMAIL_VERIFICATION: marks user email as verified, auto-signs in
5. Redirects to dashboard

**API:** `POST /api/auth/verify-otp`

**Prompt template:**
```
Input: { userId, code, type }
Validation: OTP exists, matches, not expired, not used
Output: { message, user? }
Side effect: Mark email verified (for EMAIL_VERIFICATION type), set auth cookie
```

### Skill 5b: Resend OTP

**API:** `PUT /api/auth/verify-otp`

**Prompt template:**
```
Input: { userId, type }
Validation: user exists
Output: { message }
Side effect: Invalidate old OTPs, create new OTP, send email
```

---

## Architecture Overview

### Tech Stack
- **Framework:** Next.js 16 (App Router)
- **Database:** Supabase (PostgreSQL)
- **ORM:** Prisma
- **Auth:** Custom JWT (httpOnly cookies)
- **Email:** Nodemailer (SMTP)
- **Styling:** Tailwind CSS v4
- **Deployment:** Vercel

### Database Models (Prisma)
- `User` — id, email, name, passwordHash, emailVerified
- `Otp` — id, code, userId, type (EMAIL_VERIFICATION | FORGOT_PASSWORD), expiresAt, used
- `PasswordReset` — id, token, userId, expiresAt, used
- `Workflow` — id, name, description, steps (JSON), userId, status

### Security Measures
- Passwords hashed with bcrypt (12 salt rounds)
- JWT stored in httpOnly secure cookies
- OTP expires in 10 minutes
- Reset tokens expire in 1 hour
- Generic error messages to prevent email enumeration
- Middleware protects all routes except auth pages
- CSRF protection via SameSite cookie attribute

### File Structure
```
app/
├── (auth)/
│   ├── layout.tsx         # Centered auth layout
│   ├── signin/page.tsx    # Sign in form
│   ├── signup/page.tsx    # Sign up form
│   ├── forgot-password/page.tsx  # Email input for reset
│   ├── reset-password/page.tsx   # New password form
│   └── verify-otp/page.tsx       # 6-digit OTP input
├── api/auth/
│   ├── signin/route.ts
│   ├── signup/route.ts
│   ├── forgot-password/route.ts
│   ├── reset-password/route.ts
│   ├── verify-otp/route.ts
│   └── signout/route.ts
├── dashboard/page.tsx     # Protected page
├── generated/prisma/      # Prisma client (auto-generated)
├── globals.css
├── layout.tsx
└── page.tsx

lib/
├── auth.ts       # JWT sign/verify, cookie helpers, OTP generator
├── email.ts      # Nodemailer transporter, email templates
├── prisma.ts     # Prisma client singleton
└── supabase.ts   # Supabase browser client

prisma/
└── schema.prisma  # Database schema

middleware.ts      # Route protection
```

### Environment Variables
```
DATABASE_URL          # Supabase pooled connection
DIRECT_URL            # Supabase direct connection (for migrations)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
JWT_SECRET
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM
NEXT_PUBLIC_APP_URL
```

### Deployment (Vercel)
1. Push code to GitHub
2. Connect repo to Vercel
3. Add all env vars in Vercel project settings
4. Set `NEXT_PUBLIC_APP_URL` to production domain
5. Run `npx prisma migrate deploy` (or use Vercel build command)
6. Build command: `npx prisma generate && next build`
