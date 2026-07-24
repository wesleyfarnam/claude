import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Supabase client for Route Handlers. Auth cookies are written onto the
 * provided response object (typically the redirect we're about to return),
 * so the session lands on whatever host the request was served from.
 *
 * Auth flows use route handlers instead of Server Actions specifically so a
 * plain form POST (a CORS "simple request") never triggers a preflight —
 * which is what broke login across the apex/www host redirect.
 */
export function createSupabaseRouteClient(
  request: NextRequest,
  response: NextResponse,
) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );
}
