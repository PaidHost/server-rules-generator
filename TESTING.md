# How the generator was tested

Before launch (October 2026), the output was loaded into real servers and checked with real requests, not just read over.

## Apache 2.4.58 (with PHP-FPM)

- More than 250 different setups, most of them random combinations of every switch, all loaded without a configuration error.
- Live requests checked what each rule actually does: HTTPS and www in a single redirect, bulk redirects (chains, query strings, non-English and encoded URLs), trailing slashes, removing `.php`/`.html`, domain moves, password protection, IP blocking, bot blocking, sensitive files, WordPress hardening, headers, caching, compression, WebP and hotlink protection.
- Real PHP files confirmed that blocked PHP never runs (for example in `wp-content/uploads`) and that form posts to `.php` files still work after extensions are removed: 48 of 48 checks passed.

## Nginx 1.24

- The same setups passed `nginx -t`, then the same behaviour checks were run against a live Nginx.

## Caddy 2.10.2

- The same setups passed Caddy's config check, then the same behaviour checks were run against a live Caddy.

## LiteSpeed (a live shared hosting account)

- 52 checks on a real LiteSpeed server, covering every feature above, plus visits through Cloudflare in front of it, to confirm there's no redirect loop.
- This found two LiteSpeed-only problems, both fixed before launch:
  - With IP blocking and password protection both on, LiteSpeed let blocked IPs into the parts of the site that aren't password-protected.
  - The WebP rule sometimes sent the image labelled as JPEG and without a `Vary: Accept` header.
- LiteSpeed takes about 5 to 10 seconds to notice a changed `.htaccess`, so wait that long before testing a change.

## Cloudflare

- Every WAF rule expression was parsed and evaluated with wirefilter, the open-source engine Cloudflare's rules language comes from: 27 of 27 checks passed.
- In a real Cloudflare dashboard, all four WAF rules passed Cloudflare's own rule validation. A test line of nonsense was rejected first, to confirm the check was real.
- A generated Bulk Redirects CSV was imported into a real account: all 13 rows were read with the right options.

## Also checked

- Share links restore every switch, option, redirect, IP list and domain exactly, and never include usernames or passwords.
- The page works on a phone-sized screen with no sideways scrolling.

Found something that misbehaves on your server? Please open an issue with your server type and version and the share link from the generator.
