import { NextResponse, type NextRequest } from "next/server";

/**
 * Bare-code room links: `https://kvitt.eu/AB12CD` resolves to the same
 * page as `/room/AB12CD`. The shorter URL is what we hand to guests
 * (it's also what fits cleanly under a QR), and the matcher's negative
 * lookahead keeps all existing routes (api / room / split / history /
 * debug / _next / anything with a file extension) on their original
 * paths so we don't shadow them with a 6-char alphanumeric code.
 *
 * Room codes are generated from a 31-char ambiguous-free alphabet
 * (lib/api/room/route.ts: ABCDEFGHJKMNPQRSTUVWXYZ23456789), exactly
 * 6 characters. We accept upper/lower case in the URL and uppercase
 * before rewriting so the room page sees its canonical id.
 */
const CODE_PATTERN = /^\/([A-Za-z0-9]{6})$/;

export function middleware(req: NextRequest) {
  const match = req.nextUrl.pathname.match(CODE_PATTERN);
  if (!match) return NextResponse.next();
  const code = match[1].toUpperCase();
  const url = req.nextUrl.clone();
  url.pathname = `/room/${code}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip everything we already route or serve as a static asset. The
  // negative lookahead catches "anything with a dot in the last path
  // segment" too (sitemap.xml, favicon.ico, manifest.webmanifest, …)
  // so the middleware only ever sees naked top-level paths.
  matcher: ["/((?!api|room|split|history|debug|_next|.*\\..*).*)"],
};
