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
  const response = match
    ? (() => {
        const url = req.nextUrl.clone();
        url.pathname = `/room/${match[1].toUpperCase()}`;
        return NextResponse.rewrite(url);
      })()
    : NextResponse.next();

  // Cloudflare attaches CF-IPCountry to every incoming request. We
  // stash it as a cookie so the client (which is otherwise
  // statically rendered) can read the user's physical country
  // without a round-trip — used to default the payout rail (Swish
  // vs SEPA) for hosts whose device language is English but who
  // are physically in Sweden.
  const country = (req.headers.get("cf-ipcountry") ?? "").toUpperCase();
  if (/^[A-Z]{2}$/.test(country)) {
    response.cookies.set("kvitt-country", country, {
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      path: "/",
    });
  }
  return response;
}

export const config = {
  // Match every path EXCEPT api routes, the Next.js asset directory,
  // and anything that looks like a static file (has a dot in the last
  // path segment — sitemap.xml, favicon.ico, manifest.webmanifest, …).
  // That covers the bare-code rewrite paths AND every regular page
  // arrival, so the cookie is set whether the user hits "/", a room
  // link, or a history/split page directly.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
