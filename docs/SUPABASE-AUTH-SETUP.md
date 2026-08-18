# KINOSIS 0.4.1 — Supabase/Auth setup

## Already configured in this project

- Production Site URL: `https://kinosis.netlify.app/`
- Production redirect allow-list is expected to include the KINOSIS Netlify URL.
- Frontend Project URL + Publishable Key are in `assets/js/config.js`.

## 1. Create the database surface

Open Supabase Dashboard -> SQL Editor and run:

`supabase/001_kinosis_041.sql`

Without this step sign-in may work, but Library/MY cloud loading will fail because `user_state` does not exist.

## 2. Google provider

Supabase -> Authentication -> Sign In / Providers -> Google.

In Google Cloud / Google Auth Platform:

1. Create a **Web application** OAuth client.
2. Add the KINOSIS site origin.
3. Add the exact callback URL shown on the Supabase Google provider page as an Authorized redirect URI.
4. Put the Client ID + Client Secret into Supabase and enable Google.
5. Configure the Audience for the people who should be able to sign in. Development/testing settings can restrict access; use an External/public configuration when the service is actually opened to general users.

KINOSIS only needs the basic identity scopes used by Supabase Auth.

## 3. Kakao provider

Supabase -> Authentication -> Sign In / Providers -> Kakao.

In Kakao Developers:

1. Create the KINOSIS app.
2. Get the REST API key (client ID).
3. Register the exact Supabase callback URL in Kakao Login Redirect URI.
4. Create/activate the Kakao Login Client Secret.
5. Enable Kakao Login.
6. Configure nickname/profile image consent; email is optional. If email is not requested, configure Supabase Kakao to allow users without email.
7. Add the REST API key + client secret to Supabase and enable Kakao.

## 4. Email

KINOSIS 0.4.1 uses Supabase email magic links as a fallback. For small development use the built-in mail service may be enough; a real public service should configure SMTP and review email rate limits/deliverability.

## 5. What users experience

Guest:
- Discover
- global TMDB Search
- ART MODE
- cannot use Library/MY or Save/Log

Signed in:
- all personal functions
- account state synced through `user_state`
- local device cache retained for temporary network failures
