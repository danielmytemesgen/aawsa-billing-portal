# Production Environment Configuration Guide

This document outlines the necessary environment variables and configuration steps for deploying the AAWSA Billing Portal to a production environment.

## 1. Environment Variables (.env.production)

The following variables must be configured in your production environment (e.g., Vercel, Netlify, or Docker `.env` file).

### Database (PostgreSQL)
- `POSTGRES_HOST`: The hostname of your production PostgreSQL server.
- `POSTGRES_USER`: Database username.
- `POSTGRES_PASSWORD`: Database password.
- `POSTGRES_DB`: Database name (e.g., `aawsa_billing`).
- `POSTGRES_PORT`: Default is `5432`.
- `POSTGRES_SSL`: Set to `true` if your DB requires SSL (common for cloud providers).

### Supabase (Authentication & Storage)
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key.
- `SUPABASE_SERVICE_ROLE_KEY`: (Optional) Required for some administrative backend actions.

### AI Service (Genkit/Google AI)
- `GOOGLE_GENAI_API_KEY`: Required for the AI Support Chatbot and Report Assistant.

## 2. Security Recommendations

1. **SSL/TLS**: Ensure the application is served over HTTPS.
2. **Database Access**: Restrict database access to the application server's IP address if possible.
3. **Secrets Management**: Use a secure secrets manager (like Vercel Secrets or Docker Secrets) instead of committing `.env` files.
4. **Environment Check**: Run `npm run build` locally or in a staging environment before pushing to production to catch compilation errors.

## 3. Deployment Steps

### Using Vercel (Recommended)
1. Connect your GitHub repository to Vercel.
2. Add the environment variables listed above in the Vercel dashboard.
3. Vercel will automatically build and deploy the app on every push.

### Using Docker
1. Build the production image: `docker build -t aawsa-billing-portal .`
2. Run the container: `docker run -p 3000:3000 --env-file .env.production aawsa-billing-portal`

## 4. Post-Deployment Verification

1. Log in with an Admin account.
2. Verify that master data (Branches, Tariffs) loads correctly.
3. Run a test report export to ensure CSV generation works in the production environment.
