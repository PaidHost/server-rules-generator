
(function() {
  var $ = function(id){ return document.getElementById(id); };
  var HRG_TITLE = '.htaccess, Nginx & Caddy Rule Generator';
  var HRG_URL = 'https://www.paidhosting.com/htaccess-nginx-generator/';

  /* ---------------- Controls ---------------- */
  var CHECKS = ['https','www','trail','redir','headers','preload','csp','ai','ai-train','ai-search','bots','bots-seo','bots-scan','protect','dirlist','wp','wp-xmlrpc','wp-config','wp-uploads','wp-author','gzip','cache','webp','bots-lib','hotlink','errors','ipblock','move','noext','auth'];  // new keys go at the END so older share links still load
  var SELECTS = ['www-mode','trail-mode','redir-type','noext-mode'];
  var el = {};
  CHECKS.concat(SELECTS).forEach(function(k){ el[k] = $('hrg-'+k); });
  el.domain = $('hrg-domain'); el.redirText = $('hrg-redir-text'); el.redirStatus = $('hrg-redir-status');
  el.ipText = $('hrg-ip-text'); el.ipStatus = $('hrg-ip-status');
  el.moveFrom = $('hrg-move-from'); el.authFolder = $('hrg-auth-folder'); el.authUser = $('hrg-auth-user');
  el.authPass = $('hrg-auth-pass'); el.authFile = $('hrg-auth-file'); el.authStatus = $('hrg-auth-status');
  var ERR_CODES = ['404','403','500'];
  ERR_CODES.forEach(function(c){ el['err' + c] = $('hrg-err-' + c); });
  el.code = $('hrg-code'); el.filename = $('hrg-filename'); el.note = $('hrg-output-note'); el.citebox = $('hrg-citebox');

  var SUBS = { www:'hrg-www-opts', trail:'hrg-trail-opts', redir:'hrg-redir-opts', headers:'hrg-headers-opts', ai:'hrg-ai-opts', bots:'hrg-bots-opts', wp:'hrg-wp-opts', errors:'hrg-errors-opts', ipblock:'hrg-ipblock-opts', move:'hrg-move-opts', noext:'hrg-noext-opts', auth:'hrg-auth-opts' };

  var PRESETS = {
    wp:      { https:1, www:1, 'www-mode':'strip', headers:1, bots:1, 'bots-seo':0, 'bots-scan':1, protect:1, dirlist:1, wp:1, 'wp-config':1, 'wp-uploads':1, gzip:1, cache:1 },
    wphard:  { https:1, www:1, 'www-mode':'strip', headers:1, csp:1, ai:1, 'ai-train':1, bots:1, 'bots-seo':1, 'bots-scan':1, protect:1, dirlist:1, wp:1, 'wp-xmlrpc':1, 'wp-config':1, 'wp-uploads':1, 'wp-author':1, gzip:1, cache:1 },
    laravel: { https:1, www:1, 'www-mode':'strip', headers:1, bots:1, 'bots-seo':0, 'bots-scan':1, protect:1, dirlist:1, gzip:1, cache:1 },
    'static':{ https:1, www:1, 'www-mode':'strip', headers:1, protect:1, dirlist:1, gzip:1, cache:1 }
  };
  var PRESET_DEFAULTS = { 'www-mode':'strip', 'trail-mode':'remove', 'redir-type':'301', 'noext-mode':'php' };

  /* ---------------- Bot lists (checked Oct 2026) ---------------- */
  var SEO_BOTS  = 'AhrefsBot|SemrushBot|MJ12bot|DotBot|BLEXBot|PetalBot|DataForSeoBot|SeekportBot|serpstatbot|MauiBot';
  var SCAN_BOTS = 'nikto|sqlmap|nmap|masscan|zgrab';
  var LIB_BOTS  = 'libwww-perl|python-requests|Go-http-client';  // generic HTTP libraries: also used by monitors and integrations
  // [User-Agent token, company, purpose, robots.txt-only token]
  // purpose: train = collects pages for AI training; search = indexes pages for AI search;
  //          user = fetches a page live because a person asked the assistant about it
  var AI_BOTS = [
    ['GPTBot','OpenAI','train'], ['ClaudeBot','Anthropic','train'], ['anthropic-ai','Anthropic','train'],
    ['CCBot','Common Crawl','train'], ['Bytespider','ByteDance','train'], ['meta-externalagent','Meta','train'],
    ['FacebookBot','Meta','train'], ['Amazonbot','Amazon','train'], ['cohere-training-data-crawler','Cohere','train'],
    ['Diffbot','Diffbot','train'], ['AI2Bot','Allen Institute for AI','train'], ['omgili','Webz.io','train'],
    ['DeepSeekBot','DeepSeek','train'], ['PanguBot','Huawei','train'], ['ImagesiftBot','ImageSift','train'],
    ['img2dataset','img2dataset (open source)','train'], ['MistralAI-Training','Mistral AI','train'],
    ['Google-Extended','Google','train',1], ['Applebot-Extended','Apple','train',1],
    ['OAI-SearchBot','OpenAI','search'], ['Claude-SearchBot','Anthropic','search'], ['PerplexityBot','Perplexity','search'],
    ['DuckAssistBot','DuckDuckGo','search'], ['MistralAI-Index','Mistral AI','search'], ['meta-webindexer','Meta','search'],
    ['Amzn-SearchBot','Amazon','search'], ['cohere-ai','Cohere','search'], ['Kimi-SearchBot','Moonshot AI','search'],
    ['ChatGPT-User','OpenAI','user'], ['Claude-User','Anthropic','user'], ['Perplexity-User','Perplexity','user'],
    ['MistralAI-User','Mistral AI','user'], ['meta-externalfetcher','Meta','user'], ['Amzn-User','Amazon','user']
  ];
  var excludedBots = {};   // bots the visitor has unticked in "Choose individual bots"
  var SEARCH_REF = 'google|bing|duckduckgo|yahoo|yandex|baidu|ecosia';   // image search keeps working with hotlink protection
  function aiNames(purposes, uaOnly){
    return AI_BOTS.filter(function(b){ return purposes.indexOf(b[2]) >= 0 && !excludedBots[b[0]] && !(uaOnly && b[3]); }).map(function(b){ return b[0]; });
  }

  var activeTab = 'apache';
  var outputs = {};
  var redirParsed = { list: [], skipped: 0 };

  /* ---------------- State ---------------- */
  function getState(){
    var s = {};
    CHECKS.forEach(function(k){ s[k] = !!el[k].checked; });
    s.wwwMode = s.www ? el['www-mode'].value : 'none';
    s.trailMode = s.trail ? el['trail-mode'].value : 'none';
    s.botsSeo = s.bots && s['bots-seo'];
    s.botsScan = s.bots && s['bots-scan'];
    s.botsLib = s.bots && s['bots-lib'];
    s.aiTrainNames = s.ai && s['ai-train'] ? aiNames(['train']) : [];
    s.aiSearchNames = s.ai && s['ai-search'] ? aiNames(['search','user']) : [];
    s.aiTrain = s.aiTrainNames.length > 0;
    s.aiSearch = s.aiSearchNames.length > 0;
    s.aiTrainUA = s.aiTrain ? aiNames(['train'], true).join('|') : '';
    s.aiSearchUA = s.aiSearch ? aiNames(['search','user'], true).join('|') : '';
    s.anyBots = !!(s.botsSeo || s.botsScan || s.botsLib || s.aiTrainUA || s.aiSearchUA);
    // HSTS only makes sense once the site forces HTTPS; preload depends on it
    s.hsts = s.headers && s.https;
    s.preload = s.hsts && s.preload;
    s.csp = s.headers && s.csp;
    s.wpX = s.wp && s['wp-xmlrpc']; s.wpC = s.wp && s['wp-config']; s.wpU = s.wp && s['wp-uploads']; s.wpA = s.wp && s['wp-author'];
    s.anyWp = s.wpX || s.wpC || s.wpU || s.wpA;
    s.domain = cleanDomain();
    s.domainSet = s.domain !== 'example.com';
    s.domainRe = s.domain.replace(/\./g, '\\.');
    s.rcode = s.redir && el['redir-type'].value === '302' ? '302' : '301';
    s.ips = s.ipblock ? ipParsed.list : [];
    // Move from an old domain
    s.moveFrom = s.move ? cleanHost(el.moveFrom.value) : '';
    if (s.moveFrom === s.domain) s.moveFrom = '';
    s.moveRe = s.moveFrom.replace(/\./g, '\\.');
    // Extension-free URLs
    s.exts = !s.noext ? [] : (el['noext-mode'].value === 'both' ? ['php', 'html'] : [el['noext-mode'].value === 'html' ? 'html' : 'php']);
    s.extRe = s.exts.join('|');
    // Password protection
    var folder = (el.authFolder.value || '/').trim().replace(/\\/g, '/');
    if (folder.charAt(0) !== '/') folder = '/' + folder;
    folder = folder.replace(/\/{2,}/g, '/').replace(/\/+$/, '') + '/';
    s.authFolder = /^[\/A-Za-z0-9._~%-]+$/.test(folder) ? folder : '/';
    s.authWhole = s.authFolder === '/';
    s.authPath = s.authFolder.replace(/\/$/, '');
    s.authFile = (el.authFile.value || '').trim().replace(/["\s]/g, '') || '/home/youruser/.htpasswd';
    s.authUser = (el.authUser.value || '').trim();
    if (s.auth) computeAuth();
    s.authOn = !!(s.auth && authHash.bcrypt && authHash.key === s.authUser + '\n' + (el.authPass.value || ''));
    s.errPages = [];
    if (s.errors) ERR_CODES.forEach(function(c){ var v = (el['err' + c].value || '').trim(); if (/^\/[^\s"'<>{};]*$/.test(v)) s.errPages.push([c, v]); });
    s.host = s.wwwMode === 'force' ? 'www.'+s.domain : s.domain;
    s.newBase = (s.https ? 'https://' : 'http://') + s.host;
    s.redirects = s.redir ? redirParsed.list.map(function(r){
      // Match the trailing-slash rule so a redirect never needs a second hop
      if (/^https?:\/\//i.test(r.to)) return r;
      var p = r.to.split('?')[0], q = r.to.slice(p.length);
      if (s.trailMode === 'add' && !/\/$/.test(p) && !/\.[a-z0-9]{1,5}$/i.test(p)) return { from: r.from, to: p + '/' + q };
      if (s.trailMode === 'remove' && p.length > 1 && /\/$/.test(p)) return { from: r.from, to: p.replace(/\/+$/, '') + q };
      return r;
    }) : [];
    return s;
  }

  /* ---------------- Password hashing (runs only in the visitor's browser) ---------------- */
  var BF_INIT = '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';
  function utf8(str){ return unescape(encodeURIComponent(str)).split('').map(function(c){ return c.charCodeAt(0); }); }
  function randomBytes(n){
    var a = new Uint8Array(n);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a);
    else for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.prototype.slice.call(a);
  }
  // MD5 (for Apache's $apr1$ format, which Nginx reads natively)
  function md5(bytes){
    var K = [], s = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
    for (var i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
    var m = bytes.slice(), bitLen = bytes.length * 8;
    m.push(0x80); while (m.length % 64 !== 56) m.push(0);
    for (i = 0; i < 8; i++) m.push(i < 4 ? (bitLen >>> (8 * i)) & 255 : (i === 4 ? Math.floor(bitLen / 4294967296) & 255 : 0));
    var a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
    for (var o = 0; o < m.length; o += 64) {
      var M = []; for (i = 0; i < 16; i++) M[i] = m[o+4*i] | (m[o+4*i+1] << 8) | (m[o+4*i+2] << 16) | (m[o+4*i+3] << 24);
      var A = a0, B = b0, C = c0, D = d0;
      for (i = 0; i < 64; i++) {
        var F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + M[g]) | 0; A = D; D = C; C = B;
        B = (B + ((F << s[i]) | (F >>> (32 - s[i])))) | 0;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    var out = []; [a0, b0, c0, d0].forEach(function(w){ for (var j = 0; j < 4; j++) out.push((w >>> (8 * j)) & 255); });
    return out;
  }
  function apr1(password, saltStr){
    var A64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    var pw = utf8(password), salt = utf8(saltStr), magic = utf8('$apr1$');
    var ctx = pw.concat(magic, salt), fin = md5(pw.concat(salt, pw)), i;
    for (var pl = pw.length; pl > 0; pl -= 16) ctx = ctx.concat(fin.slice(0, Math.min(pl, 16)));
    for (i = pw.length; i; i >>= 1) ctx.push((i & 1) ? 0 : pw[0]);
    fin = md5(ctx);
    for (i = 0; i < 1000; i++) {
      var c = (i & 1) ? pw.slice() : fin.slice();
      if (i % 3) c = c.concat(salt);
      if (i % 7) c = c.concat(pw);
      c = c.concat((i & 1) ? fin : pw);
      fin = md5(c);
    }
    var out = '';
    function to64(v, n){ while (n--) { out += A64.charAt(v & 63); v >>= 6; } }
    [[0,6,12],[1,7,13],[2,8,14],[3,9,15],[4,10,5]].forEach(function(t){ to64((fin[t[0]] << 16) | (fin[t[1]] << 8) | fin[t[2]], 4); });
    to64(fin[11], 2);
    return '$apr1$' + saltStr + '$' + out;
  }
  // bcrypt (for Apache and Caddy)
  function bcrypt(password, prefix, cost){
    var BC64 = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var init = atob(BF_INIT), words = new Int32Array(1042);
    for (var i = 0; i < 1042; i++) words[i] = (init.charCodeAt(4*i) << 24) | (init.charCodeAt(4*i+1) << 16) | (init.charCodeAt(4*i+2) << 8) | init.charCodeAt(4*i+3);
    var P = words.slice(0, 18), S = words.slice(18);
    var key = utf8(password).concat([0]).slice(0, 72), salt = randomBytes(16);
    var LR = new Int32Array(2);
    function enc(){
      var l = LR[0], r = LR[1];
      l ^= P[0];
      for (var k = 1; k <= 16; k += 2) {
        r ^= (((S[l >>> 24] + S[256 | ((l >>> 16) & 255)]) ^ S[512 | ((l >>> 8) & 255)]) + S[768 | (l & 255)]) ^ P[k];
        l ^= (((S[r >>> 24] + S[256 | ((r >>> 16) & 255)]) ^ S[512 | ((r >>> 8) & 255)]) + S[768 | (r & 255)]) ^ P[k + 1];
      }
      LR[0] = r ^ P[17]; LR[1] = l;
    }
    function word(data, pos){ var w = 0; for (var j = 0; j < 4; j++) { w = (w << 8) | data[pos.p]; pos.p = (pos.p + 1) % data.length; } return w; }
    function expand(data, saltData){
      var pos = { p: 0 }, sp = { p: 0 }, j;
      for (j = 0; j < 18; j++) P[j] ^= word(data, pos);
      LR[0] = 0; LR[1] = 0;
      for (j = 0; j < 18; j += 2) { if (saltData) { LR[0] ^= word(saltData, sp); LR[1] ^= word(saltData, sp); } enc(); P[j] = LR[0]; P[j + 1] = LR[1]; }
      for (j = 0; j < 1024; j += 2) { if (saltData) { LR[0] ^= word(saltData, sp); LR[1] ^= word(saltData, sp); } enc(); S[j] = LR[0]; S[j + 1] = LR[1]; }
    }
    expand(key, salt);
    for (i = 0; i < (1 << cost); i++) { expand(key, null); expand(salt, null); }
    var ct = utf8('OrpheanBeholderScryDoubt'), cw = [];
    for (i = 0; i < 6; i++) cw[i] = (ct[4*i] << 24) | (ct[4*i+1] << 16) | (ct[4*i+2] << 8) | ct[4*i+3];
    for (i = 0; i < 64; i++) for (var b = 0; b < 6; b += 2) { LR[0] = cw[b]; LR[1] = cw[b + 1]; enc(); cw[b] = LR[0]; cw[b + 1] = LR[1]; }
    var hash = []; for (i = 0; i < 6; i++) hash.push((cw[i] >>> 24) & 255, (cw[i] >>> 16) & 255, (cw[i] >>> 8) & 255, cw[i] & 255);
    function b64(bytes, len){
      var out = '', k = 0;
      while (k < len) {
        var c1 = bytes[k++]; out += BC64.charAt(c1 >> 2); c1 = (c1 & 3) << 4;
        if (k >= len) { out += BC64.charAt(c1); break; }
        var c2 = bytes[k++]; out += BC64.charAt(c1 | (c2 >> 4)); c1 = (c2 & 15) << 2;
        if (k >= len) { out += BC64.charAt(c1); break; }
        c2 = bytes[k++]; out += BC64.charAt(c1 | (c2 >> 6)) + BC64.charAt(c2 & 63);
      }
      return out;
    }
    return '$' + prefix + '$' + (cost < 10 ? '0' : '') + cost + '$' + b64(salt, 16) + b64(hash, 23);
  }
  function randomSalt(n){
    var A = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    return randomBytes(n).map(function(b){ return A.charAt(b & 63); }).join('');
  }

  function cleanHost(v){
    v = (v || '').trim().replace(/^https?:\/\//i, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/^www\./i, '').toLowerCase();
    return /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]{2,}$/.test(v) ? v : '';
  }
  // Hashes are only recomputed when the username or password changes (bcrypt is deliberately slow)
  var authHash = { key: null };
  function computeAuth(){
    var u = (el.authUser.value || '').trim(), p = el.authPass.value || '';
    var key = u + '\n' + p;
    if (authHash.key === key) return;
    authHash = { key: key };
    if (!u || !p || /[:\s]/.test(u)) return;
    authHash.apr1 = apr1(p, randomSalt(8));
    authHash.bcrypt = bcrypt(p, '2y', 10);
  }
  // Turns a blocked IP or range into a regular expression for SetEnvIf (LiteSpeed ignores "Require not ip" next to "Require env")
  function numRangeRe(lo, hi){
    // regex for the whole numbers lo..hi (0..255), written without leading zeros
    var blocks = [], a = lo;
    while (a <= hi) {
      var k = 0;
      while (a % Math.pow(10, k + 1) === 0 && a + Math.pow(10, k + 1) - 1 <= hi && String(a).length === String(a + Math.pow(10, k + 1) - 1).length) k++;
      var sa = String(a), pre = sa.slice(0, sa.length - k), last = blocks[blocks.length - 1];
      // join neighbours such as 1\d|2\d|3\d into [1-3]\d
      if (last && last.k === k && last.pre.length === pre.length && last.pre.slice(0, -1) === pre.slice(0, -1) && +last.hi + 1 === +pre.slice(-1) && pre.length) last.hi = pre.slice(-1);
      else blocks.push({ pre: pre, k: k, lo: pre.slice(-1), hi: pre.slice(-1) });
      a += Math.pow(10, k);
    }
    var parts = blocks.map(function(b){
      var d = b.lo === b.hi ? b.pre : b.pre.slice(0, -1) + '[' + b.lo + '-' + b.hi + ']';
      return d + Array(b.k + 1).join('\\d');
    });
    return parts.length === 1 ? parts[0] : '(' + parts.join('|') + ')';
  }
  function ipToRe(ip){
    var m = ip.split('/'), addr = m[0], bits = m.length > 1 ? +m[1] : -1;
    if (addr.indexOf(':') < 0) {
      var o = addr.split('.').map(Number), n = bits < 0 ? 32 : bits, out = [];
      for (var k = 0; k < 4; k++) {
        var keep = Math.max(0, Math.min(8, n - 8 * k)), size = 1 << (8 - keep), lo = o[k] & (256 - size);
        out.push(keep === 8 ? String(o[k]) : keep === 0 ? '\\d+' : numRangeRe(lo, lo + size - 1));
      }
      return '^' + out.join('\\.') + '$';
    }
    // IPv6: written the way servers print it (lowercase, no leading zeros, longest zero run as ::)
    var h = addr.split('::'), head = h[0] ? h[0].split(':') : [], tail = h.length > 1 && h[1] ? h[1].split(':') : [];
    if (h.length === 1 && head.length !== 8) return '';
    var fill = 8 - head.length - tail.length; if (fill < 0 || head.concat(tail).some(function(x){ return !/^[0-9a-f]{1,4}$/.test(x); })) return '';
    var hx = head.concat(Array(h.length > 1 ? fill : 0).fill('0'), tail).map(function(x){ return parseInt(x, 16); });
    if (bits < 0 || bits === 128) {
      var best = -1, bl = 0;
      for (var i = 0; i < 8; i++) if (!hx[i]) { var j = i; while (j < 8 && !hx[j]) j++; if (j - i > bl) { best = i; bl = j - i; } i = j; }
      var t = hx.map(function(x){ return x.toString(16); });
      var s = bl >= 2 ? t.slice(0, best).join(':') + '::' + t.slice(best + bl).join(':') : t.join(':');
      return '^' + s + '$';
    }
    // Ranges: only on whole groups whose fixed part has no zero group (otherwise the :: shortening could hide it)
    if (bits % 16 || bits === 0) return '';
    var fixed = hx.slice(0, bits / 16);
    if (fixed.some(function(x){ return !x; })) return '';
    return '^' + fixed.map(function(x){ return x.toString(16); }).join(':') + ':';
  }
  function reEscStr(t){ return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function cleanDomain(){
    return (el.domain.value || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./i, '').toLowerCase() || 'example.com';
  }

  /* ---------------- IP list parsing ---------------- */
  var ipParsed = { list: [], bad: 0 };
  function parseIps(){
    var list = [], bad = 0, seen = {};
    (el.ipText.value || '').split(/[\s,;]+/).filter(Boolean).slice(0, 500).forEach(function(t){
      var v4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}(\/([12]?\d|3[0-2]))?$/.test(t);
      var v6 = /^[0-9a-f:]+(\/(\d{1,2}|1[01]\d|12[0-8]))?$/i.test(t) && t.indexOf(':') >= 0 && t.split('::').length <= 2;
      if (!(v4 || v6)) { bad++; return; }
      t = t.toLowerCase();
      if (!seen[t]) { seen[t] = 1; list.push(t); }
    });
    ipParsed = { list: list, bad: bad };
    var msg = list.length ? list.length + ' address' + (list.length === 1 ? '' : 'es') + ' ready' : 'One IP address or range (CIDR) per line, IPv4 or IPv6.';
    if (bad) msg += ' · ' + bad + ' entr' + (bad === 1 ? 'y' : 'ies') + ' skipped (not a valid IP or range)';
    el.ipStatus.textContent = msg;
    el.ipStatus.classList.toggle('hrg-warn', bad > 0);
  }

  /* ---------------- Bulk redirect parsing ---------------- */
  function parseRedirects(){
    var raw = el.redirText.value || '';
    var list = [], skipped = 0, seen = {}, withQuery = 0;
    raw.split(/\r?\n/).slice(0, 2000).forEach(function(line){
      line = line.trim();
      if (!line || line.charAt(0) === '#') return;
      var parts = line.split(/[\s,;]+/).filter(Boolean);
      if (!(parts.length >= 2)) { skipped++; return; }
      var from = parts[0], to = parts[1];
      from = from.replace(/^https?:\/\/[^\/]+/i, '');
      from = from.split('#')[0];
      if (/\?./.test(from)) withQuery++;
      from = from.split('?')[0];
      if (from.charAt(0) !== '/') from = '/' + from;
      if (from.length > 1) from = from.replace(/\/+$/, '');
      if (!/^https?:\/\//i.test(to) && to.charAt(0) !== '/') to = '/' + to;
      try { from = decodeURIComponent(from); } catch (e) {}
      // New URL: encode spaces and non-ASCII characters, keep any existing %XX escapes as they are
      to = to.replace(/[^\x21-\x7e]/g, function(ch){ return encodeURIComponent(ch); });
      if (/["'\\{}<>\x00-\x1f\x7f]/.test(from) || /["'\s\\{}<>]/.test(to)) { skipped++; return; }
      if (from === to || from === to.replace(/\/+$/, '') || seen[from]) { skipped++; return; }
      seen[from] = 1;
      list.push({ from: from, to: to });
    });
    // Follow chains (A -> B, B -> C) so every old URL goes straight to its final address,
    // and drop loops (A -> B, B -> A), which would otherwise redirect forever.
    var dom = cleanDomain();
    var ownPath = function(to){
      if (to.charAt(0) === '/') return to;
      var m = to.match(/^https?:\/\/([^\/?#]+)(.*)$/i);
      return m && m[1].toLowerCase().replace(/^www\./, '') === dom ? (m[2] || '/') : null;
    };
    var byFrom = {}; list.forEach(function(r){ byFrom[r.from] = r; });
    var final = [], chains = 0, loops = 0;
    list.forEach(function(r){
      var to = r.to, seenHop = {}, hops = 0, loop = false;
      seenHop[r.from] = 1;
      for (;;) {
        var p = ownPath(to);
        if (p === null || p.indexOf('?') >= 0) break;
        try { p = decodeURIComponent(p); } catch (e) {}
        var key = p.length > 1 ? p.replace(/\/+$/, '') : p;
        var next = byFrom[key];
        if (!next) break;
        if (seenHop[key]) { loop = true; break; }
        seenHop[key] = 1; to = next.to; hops++;
      }
      if (loop) { loops++; return; }
      if (hops) chains++;
      final.push({ from: r.from, to: to });
    });
    redirParsed = { list: final, skipped: skipped };
    var msg = final.length ? final.length + ' redirect' + (final.length === 1 ? '' : 's') + ' ready' : 'Separate old and new with a space, tab or comma. Full URLs work too.';
    if (chains) msg += ' · ' + chains + ' chain' + (chains === 1 ? '' : 's') + ' shortened to one hop';
    if (loops) msg += ' · ' + loops + ' line' + (loops === 1 ? '' : 's') + ' removed because they loop back on each other';
    if (skipped) msg += ' · ' + skipped + ' line' + (skipped === 1 ? '' : 's') + ' skipped (missing target, duplicate, or same as old URL)';
    if (withQuery) msg += ' · ' + withQuery + ' old URL' + (withQuery === 1 ? ' has' : 's have') + ' a ?query, which is ignored: every visit to that page will redirect';
    el.redirStatus.textContent = msg;
    el.redirStatus.classList.toggle('hrg-warn', skipped > 0 || loops > 0 || withQuery > 0);
  }
  function reEsc(str){ return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* ---------------- Shared header values ---------------- */
  var CSP_VALUE = "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; font-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'self'; upgrade-insecure-requests";
  function headerPairs(s){
    var h = [
      ['X-Content-Type-Options','nosniff'],
      ['X-Frame-Options','SAMEORIGIN'],
      ['Referrer-Policy','strict-origin-when-cross-origin'],
      ['Permissions-Policy','geolocation=(), microphone=(), camera=()']
    ];
    // includeSubDomains forces HTTPS on EVERY subdomain, so it is only added with preload (which requires it)
    if (s.hsts) h.push(['Strict-Transport-Security', s.preload ? 'max-age=63072000; includeSubDomains; preload' : 'max-age=31536000']);
    if (s.csp) h.push(['Content-Security-Policy-Report-Only', CSP_VALUE]);
    return h;
  }
  var GZIP_TYPES = 'text/plain text/css text/xml text/javascript application/javascript application/json application/ld+json application/manifest+json application/xml application/rss+xml application/atom+xml image/svg+xml image/x-icon font/ttf font/otf application/vnd.ms-fontobject';

  function banner(lines){
    var o = ['# ============================================================', '# Generated by the PaidHosting .htaccess, Nginx & Caddy Rule Generator'];
    lines.forEach(function(l){ o.push('# ' + l); });
    o.push('# Reopen or edit this config: ' + shareUrl(true));
    o.push('# ============================================================', '');
    return o;
  }

  /* ================================================================
     APACHE / LITESPEED
     ================================================================ */
  function apacheTarget(s){
    // Host capture + base so every redirect lands on the final canonical HTTPS URL in one hop.
    if (s.https && s.wwwMode === 'strip') return { cond: 'RewriteCond %{HTTP_HOST} ^(?:www\\.)?(.+)$ [NC]', base: 'https://%1' };
    if (s.https && s.wwwMode === 'force') return { cond: 'RewriteCond %{HTTP_HOST} ^(?:www\\.)?(.+)$ [NC]', base: 'https://www.%1' };
    if (s.https) return { cond: null, base: 'https://%{HTTP_HOST}' };
    return { cond: null, base: '' };
  }

  function buildApache(s){
    var out = banner(['Paste this at the TOP of your .htaccess file (WordPress: above the "# BEGIN WordPress" block;', 'Laravel: in public/.htaccess, above the existing rewrite rules).', 'Works on Apache 2.4+ and LiteSpeed. Back up your existing .htaccess first.']);
    var any = false;
    var t = apacheTarget(s);

    if (s.dirlist) {
      any = true;
      out.push('# --- Disable directory listing ---');
      out.push('# If this line causes a 500 error, your host disallows "Options" here: delete it.');
      out.push('Options -Indexes', '');
    }

    if (s.errPages.length) {
      any = true;
      out.push('# --- Custom error pages ---');
      s.errPages.forEach(function(e){ out.push('ErrorDocument ' + e[0] + ' ' + e[1]); });
      out.push('');
    }

    if (s.auth && !s.authOn) {
      out.push('# --- Password protection: enter a username and password above to generate it ---', '');
    }
    if (s.authOn) {
      any = true;
      out.push('# --- Password protection: ' + (s.authWhole ? 'whole site' : s.authFolder) + ' ---');
      out.push('# 1) Create a file at ' + s.authFile + ' containing exactly this line');
      out.push('#    (keep it OUTSIDE your public web folder):');
      out.push('#      ' + s.authUser + ':' + authHash.bcrypt);
      out.push('# 2) Change the AuthUserFile path below if your file is somewhere else.');
      out.push('# No password prompt on LiteSpeed? Use your host\'s "Directory Privacy" tool instead.');
      out.push('AuthType Basic', 'AuthName "Restricted"', 'AuthUserFile "' + s.authFile + '"');
      if (s.authWhole) out.push('# /.well-known/ stays open so SSL certificates can still renew', 'SetEnvIfNoCase Request_URI "^/\\.well-known/" HRG_OPEN');
      else out.push('# Everything outside ' + s.authFolder + ' stays open', 'SetEnvIfNoCase Request_URI "^(?!' + reEscStr(s.authPath) + '(/|$))" HRG_OPEN');
      out.push('');
    }
    if (s.ips.length || s.authOn) {
      any = true;
      out.push('# --- ' + (s.ips.length && s.authOn ? 'Access control: blocked IPs and password' : s.ips.length ? 'Block IP addresses' : 'Who may enter the protected area') + ' ---');
      if (s.ips.length) out.push('# Behind Cloudflare or another proxy? Apache sees the proxy\'s IP, so use the Cloudflare tab instead.');
      if (s.ips.length && s.authOn) {
        var ipRes = [], ipLeft = [];
        s.ips.forEach(function(ip){ var r = ipToRe(ip); if (r) ipRes.push(r); else ipLeft.push(ip); });
        if (ipRes.length) {
          out.push('# LiteSpeed: also keep blocked IPs out of the open part of the site');
          ipRes.forEach(function(r){ out.push('SetEnvIf Remote_Addr "' + r + '" !HRG_OPEN'); });
        }
        if (ipLeft.length) out.push('# LiteSpeed only blocks these IPv6 ranges inside the protected area: ' + ipLeft.join(' '));
      }
      out.push('<IfModule mod_authz_core.c>', '<RequireAll>', '    Require all granted');
      for (var ii = 0; ii < s.ips.length; ii += 20) out.push('    Require not ip ' + s.ips.slice(ii, ii + 20).join(' '));
      if (s.authOn) out.push('    <RequireAny>', '        Require env HRG_OPEN', '        Require valid-user', '    </RequireAny>');
      out.push('</RequireAll>', '</IfModule>', '');
    }

    if (s.protect) {
      any = true;
      out.push('# --- Protect sensitive files ---');
      out.push('# Deny every dotfile/dotfolder (.env, .git, .htpasswd...) except /.well-known/ (SSL validation)');
      out.push('<IfModule mod_rewrite.c>', 'RewriteEngine On', 'RewriteRule "(^|/)\\.(?!well-known/)" - [F]', '</IfModule>');
      out.push('# Deny backups, dumps, logs and package manifests');
      out.push('<IfModule mod_authz_core.c>');
      out.push('<FilesMatch "(^#.*#|\\.(bak|conf|config|dist|inc|ini|log|orig|psd|save|sh|sql|swo|swp)|~)$">', '    Require all denied', '</FilesMatch>');
      out.push('<FilesMatch "^(composer\\.(json|lock)|package(-lock)?\\.json|yarn\\.lock)$">', '    Require all denied', '</FilesMatch>');
      out.push('</IfModule>', '');
    }

    if (s.anyWp) {
      any = true;
      out.push('# --- WordPress hardening ---');
      if (s.wpX || s.wpC) {
        out.push('<IfModule mod_authz_core.c>');
        if (s.wpX) out.push('# Blocks XML-RPC (breaks Jetpack and apps that publish through it)', '<Files "xmlrpc.php">', '    Require all denied', '</Files>');
        if (s.wpC) out.push('<Files "wp-config.php">', '    Require all denied', '</Files>');
        out.push('</IfModule>');
      }
      if (s.wpU || s.wpA) {
        out.push('<IfModule mod_rewrite.c>', 'RewriteEngine On');
        if (s.wpU) out.push('# No PHP execution inside the uploads folder', 'RewriteRule ^wp-content/uploads/.*\\.(php\\d?|phtml|phar)$ - [F,L]');
        if (s.wpA) out.push('# Block ?author=N username scans on the front end (wp-admin unaffected)', 'RewriteCond %{REQUEST_URI} !^/wp-admin [NC]', 'RewriteCond %{QUERY_STRING} (^|&)author=\\d+ [NC]', 'RewriteRule ^ - [F,L]');
        out.push('</IfModule>');
      }
      out.push('');
    }

    if (s.anyBots) {
      any = true;
      out.push('# --- Block bots by User-Agent ---');
      out.push('<IfModule mod_rewrite.c>', 'RewriteEngine On');
      if (s.aiTrainUA) out.push('# AI training crawlers', 'RewriteCond %{HTTP_USER_AGENT} ('+s.aiTrainUA+') [NC]', 'RewriteRule ^ - [F,L]');
      if (s.aiSearchUA) out.push('# AI search & assistant fetchers (removes you from their answers)', 'RewriteCond %{HTTP_USER_AGENT} ('+s.aiSearchUA+') [NC]', 'RewriteRule ^ - [F,L]');
      if (s.botsSeo) out.push('# SEO / marketing crawlers', 'RewriteCond %{HTTP_USER_AGENT} ('+SEO_BOTS+') [NC]', 'RewriteRule ^ - [F,L]');
      if (s.botsScan) out.push('# Vulnerability scanners', 'RewriteCond %{HTTP_USER_AGENT} ('+SCAN_BOTS+') [NC]', 'RewriteRule ^ - [F,L]');
      if (s.botsLib) {
        out.push('# Scripting libraries + empty User-Agents (can also block uptime monitors and integrations)');
        out.push('RewriteCond %{HTTP_USER_AGENT} ^$ [OR]', 'RewriteCond %{HTTP_USER_AGENT} ('+LIB_BOTS+') [NC]', 'RewriteRule ^ - [F,L]');
      }
      out.push('</IfModule>');
      if (s.ai) out.push('# Google-Extended and Applebot-Extended are robots.txt tokens, not crawlers: see the robots.txt tab.');
      out.push('');
    }

    if (s.move && !s.moveFrom) out.push('# --- Move from an old domain: enter the old domain above (it must differ from your domain) ---', '');
    if (s.moveFrom) {
      any = true;
      out.push('# --- Move ' + s.moveFrom + ' to ' + s.host + ': every page goes to the same page on the new domain ---');
      out.push('# Works when both domains point at this site. If the old domain is on another server,');
      out.push('# put this block in the old site\'s .htaccess instead.');
      out.push('<IfModule mod_rewrite.c>', 'RewriteEngine On');
      var oldCond = 'RewriteCond %{HTTP_HOST} ^(?:www\\.)?' + s.moveRe + '\\.?$ [NC]';
      if (s.redirects.length) out.push('# Pages you renamed in Bulk redirects go straight to their new address');
      s.redirects.forEach(function(r){
        var pat = r.from === '/' ? '^$' : '^' + reEsc(r.from.slice(1)).replace(/ /g, '\\x20') + '/?$';
        var to = /^https?:\/\//i.test(r.to) ? r.to : s.newBase + r.to;
        out.push(oldCond, 'RewriteRule ' + pat + ' ' + to + (r.to.indexOf('?') < 0 ? ' [R=' + s.rcode + ',L,NE]' : ' [R=' + s.rcode + ',L,NE,QSA]'));
      });
      out.push('# Everything else keeps its path and query string', oldCond, 'RewriteRule ^(.*)$ ' + s.newBase + '/$1 [R=301,L]', '</IfModule>', '');
    }

    if (s.hotlink) {
      any = true;
      out.push('# --- Hotlink protection: other sites cannot embed your images ---');
      if (!s.domainSet) out.push('# Enter your domain above: this rule needs it.');
      out.push('<IfModule mod_rewrite.c>', 'RewriteEngine On', 'RewriteCond %{HTTP_REFERER} !^$');
      out.push('RewriteCond %{HTTP_REFERER} !^https?://([^/]+\\.)?' + s.domainRe + '(/|:|$) [NC]');
      out.push('# Search engines keep showing your images in image search');
      out.push('RewriteCond %{HTTP_REFERER} !^https?://([^/]+\\.)?(' + SEARCH_REF + ')\\. [NC]');
      out.push('RewriteRule \\.(jpe?g|png|gif|webp|avif|svg)$ - [F,NC,L]', '</IfModule>', '');
    }

    if (s.redirects.length) {
      any = true;
      out.push('# --- Bulk ' + s.rcode + ' redirects ('+s.redirects.length+') : each goes to its final URL in one hop ---');
      out.push('<IfModule mod_rewrite.c>', 'RewriteEngine On');
      s.redirects.forEach(function(r){
        var pat = r.from === '/' ? '^$' : '^' + reEsc(r.from.slice(1)).replace(/ /g, '\\x20') + '/?$';
        var abs = /^https?:\/\//i.test(r.to);
        if (!abs && t.cond) out.push(t.cond);
        // QSA keeps the visitor's query string when the new URL has its own (Apache drops it otherwise)
        out.push('RewriteRule ' + pat + ' ' + (abs ? r.to : t.base + r.to) + (r.to.indexOf('?') < 0 ? ' [R=' + s.rcode + ',L,NE]' : ' [R=' + s.rcode + ',L,NE,QSA]'));
      });
      out.push('</IfModule>', '');
    }

    if (s.exts.length) {
      any = true;
      var eb = t.base;
      out.push('# --- Remove .' + s.exts.join(' and .') + ' from URLs, part 1: send old addresses to the clean one ---');
      out.push('# Only GET requests are redirected, so forms that post to a file keep working.');
      out.push('<IfModule mod_rewrite.c>', 'RewriteEngine On');
      if (t.cond) {
        out.push(t.cond, 'RewriteRule ^ - [E=HRG_HOST:%1]');
        eb = t.base.replace('%1', '%{ENV:HRG_HOST}');
      }
      out.push('# /folder/index.' + s.exts[0] + ' -> /folder/');
      out.push('RewriteCond %{REQUEST_URI} !^/wp-', 'RewriteCond %{THE_REQUEST} ^(?:GET|HEAD)\\s/+((?:[^?\\s]*/)?)index\\.(?:' + s.extRe + ')[?\\s] [NC]', 'RewriteRule ^ ' + eb + '/%1 [R=301,L,NE]');
      out.push('# /page.' + s.exts[0] + ' -> /page' + (s.trailMode === 'add' ? '/' : ''));
      out.push('RewriteCond %{REQUEST_URI} !^/wp-', 'RewriteCond %{THE_REQUEST} ^(?:GET|HEAD)\\s/+([^?\\s]+?)\\.(?:' + s.extRe + ')[?\\s] [NC]', 'RewriteRule ^ ' + eb + '/%1' + (s.trailMode === 'add' ? '/' : '') + ' [R=301,L,NE]');
      out.push('</IfModule>', '');
    }

    if (s.trailMode !== 'none') {
      any = true;
      out.push('# --- Trailing slash: ' + (s.trailMode === 'remove' ? 'remove' : 'add') + ' (GET requests only; real folders and files untouched) ---');
      out.push('<IfModule mod_rewrite.c>', 'RewriteEngine On');
      out.push('RewriteCond %{REQUEST_METHOD} ^(GET|HEAD)$');
      if (s.trailMode === 'remove') {
        out.push('RewriteCond %{REQUEST_FILENAME} !-d');
        if (t.cond) out.push(t.cond);
        out.push('RewriteRule ^(.+)/$ ' + t.base + '/$1 [R=301,L]');
      } else {
        out.push('RewriteCond %{REQUEST_FILENAME} !-f');
        out.push('RewriteCond %{REQUEST_URI} !\\.[a-zA-Z0-9]{1,5}$');
        out.push('RewriteCond %{REQUEST_URI} !^/(wp-json|wp-admin)/');
        if (t.cond) out.push(t.cond);
        out.push('RewriteRule ^(.*[^/])$ ' + t.base + '/$1/ [R=301,L]');
      }
      out.push('</IfModule>', '');
    }

    if (s.https && s.wwwMode !== 'none') {
      any = true;
      out.push('# --- Force HTTPS + canonical domain (' + (s.wwwMode === 'strip' ? 'remove www' : 'force www') + '), combined into a single redirect ---');
      out.push('<IfModule mod_rewrite.c>', 'RewriteEngine On', 'RewriteCond %{HTTPS} off [OR]');
      out.push(s.wwwMode === 'strip' ? 'RewriteCond %{HTTP_HOST} ^www\\. [NC]' : 'RewriteCond %{HTTP_HOST} !^www\\. [NC]');
      out.push('RewriteCond %{HTTP_HOST} ^(?:www\\.)?(.+)$ [NC]');
      out.push(s.wwwMode === 'strip' ? 'RewriteRule ^ https://%1%{REQUEST_URI} [L,R=301]' : 'RewriteRule ^ https://www.%1%{REQUEST_URI} [L,R=301]');
      out.push('</IfModule>');
      out.push('# Behind Cloudflare or another proxy? %{HTTPS} can read "off" at the origin even');
      out.push('# when the visitor is on HTTPS. If so, replace the first RewriteCond above with:');
      out.push('# RewriteCond %{HTTP:X-Forwarded-Proto} !https [OR]', '');
    } else if (s.https) {
      any = true;
      out.push('# --- Force HTTPS ---');
      out.push('<IfModule mod_rewrite.c>', 'RewriteEngine On', 'RewriteCond %{HTTPS} off', 'RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]', '</IfModule>');
      out.push('# Behind Cloudflare or another proxy? %{HTTPS} can read "off" at the origin even');
      out.push('# when the visitor is on HTTPS. If so, replace the RewriteCond above with:');
      out.push('# RewriteCond %{HTTP:X-Forwarded-Proto} !https', '');
    } else if (s.wwwMode !== 'none') {
      any = true;
      out.push('# --- Canonical domain (' + (s.wwwMode === 'strip' ? 'remove www' : 'force www') + ') ---');
      out.push('<IfModule mod_rewrite.c>', 'RewriteEngine On');
      out.push('# Keep the current protocol (http or https)', 'RewriteCond %{HTTPS} =on', 'RewriteRule ^ - [E=HRG_PROTO:https]', 'RewriteCond %{HTTPS} !=on', 'RewriteRule ^ - [E=HRG_PROTO:http]');
      if (s.wwwMode === 'strip') out.push('RewriteCond %{HTTP_HOST} ^www\\.(.+)$ [NC]', 'RewriteRule ^ %{ENV:HRG_PROTO}://%1%{REQUEST_URI} [L,R=301]');
      else out.push('RewriteCond %{HTTP_HOST} !^www\\. [NC]', 'RewriteRule ^ %{ENV:HRG_PROTO}://www.%{HTTP_HOST}%{REQUEST_URI} [L,R=301]');
      out.push('</IfModule>', '');
    }

    if (s.exts.length) {
      any = true;
      out.push('# --- Remove .' + s.exts.join(' and .') + ' from URLs, part 2: serve /page from page.' + s.exts[0] + ' behind the scenes ---');
      out.push('<IfModule mod_rewrite.c>', 'RewriteEngine On');
      s.exts.forEach(function(x){
        if (s.trailMode === 'add') out.push('RewriteCond %{REQUEST_FILENAME} !-d', 'RewriteCond %{DOCUMENT_ROOT}/$1.' + x + ' -f', 'RewriteRule ^(.+?)/?$ $1.' + x + ' [L]');
        else out.push('RewriteCond %{REQUEST_FILENAME} !-d', 'RewriteCond %{REQUEST_FILENAME}.' + x + ' -f', 'RewriteRule ^(.+)$ $1.' + x + ' [L]');
      });
      out.push('</IfModule>', '');
    }

    if (s.headers) {
      any = true;
      out.push('# --- Security headers ---');
      if (s.preload) out.push('# HSTS preload: only if EVERY subdomain serves HTTPS. Then submit at hstspreload.org');
      if (s.csp) out.push('# CSP is report-only: watch the browser console, then rename to Content-Security-Policy to enforce');
      if (!s.hsts) out.push('# HSTS is left out until Force HTTPS is on');
      out.push('<IfModule mod_headers.c>');
      headerPairs(s).forEach(function(h){ out.push('Header always set ' + h[0] + ' "' + h[1] + '"'); });
      out.push('</IfModule>', '');
    }

    if (s.webp) {
      any = true;
      out.push('# --- WebP image redirects ---');
      out.push('# Requires a .webp file saved alongside each original (e.g. photo.jpg.webp)');
      out.push('<IfModule mod_rewrite.c>', 'RewriteEngine On', 'RewriteCond %{HTTP_ACCEPT} image/webp', 'RewriteCond %{REQUEST_FILENAME} \\.(jpe?g|png)$', 'RewriteCond %{REQUEST_FILENAME}.webp -f', 'RewriteRule ^(.+)\\.(jpe?g|png)$ $1.$2.webp [T=image/webp,L]', '</IfModule>');
      out.push('<IfModule mod_headers.c>', '<FilesMatch "\\.(jpe?g|png)(\\.webp)?$">', '    Header merge Vary Accept', '</FilesMatch>', '</IfModule>');
      out.push('<IfModule mod_mime.c>', 'AddType image/webp .webp', '<FilesMatch "\\.webp$">', '    ForceType image/webp', '</FilesMatch>', '</IfModule>', '');
    }

    if (s.gzip) {
      any = true;
      out.push('# --- Compression (LiteSpeed compresses automatically; these lines are harmless there) ---');
      out.push('<IfModule mod_deflate.c>', 'AddOutputFilterByType DEFLATE text/html ' + GZIP_TYPES, '</IfModule>', '');
    }

    if (s.cache) {
      any = true;
      out.push('# --- Browser caching (assumes versioned asset URLs, e.g. ?ver=; HTML is never cached) ---');
      out.push('<IfModule mod_expires.c>', 'ExpiresActive On');
      out.push('ExpiresByType text/html "access plus 0 seconds"', 'ExpiresByType application/json "access plus 0 seconds"', 'ExpiresByType application/xml "access plus 0 seconds"');
      out.push('ExpiresByType text/css "access plus 1 year"', 'ExpiresByType text/javascript "access plus 1 year"', 'ExpiresByType application/javascript "access plus 1 year"');
      ['image/jpeg','image/png','image/gif','image/webp','image/avif','image/svg+xml','image/x-icon','image/vnd.microsoft.icon','font/woff2','font/woff','font/ttf','font/otf'].forEach(function(m){ out.push('ExpiresByType ' + m + ' "access plus 1 year"'); });
      out.push('</IfModule>', '');
    }

    if (!any) out.push('# Flip a switch above to generate your .htaccess code.');
    return out.join('\n');
  }

  /* ================================================================
     NGINX
     ================================================================ */
  function buildNginx(s){
    var d = s.domain, host = s.host;
    var out = banner(['Nginx does NOT read .htaccess files. Put the map blocks ONCE inside http {},', 'the rest in your site config (e.g. /etc/nginx/sites-available/' + d + '), then test & reload:', '  sudo nginx -t && sudo systemctl reload nginx']);
    var any = false;
    var needBot = s.anyBots, needRedir = s.redirects.length > 0;
    var needQsMerge = s.redirects.some(function(r){ return r.to.indexOf('?') >= 0; });

    // ---- http {} level maps ----
    var maps = [];
    if (needBot) {
      maps.push('map $http_user_agent $hrg_blocked_ua {', '    default 0;');
      if (s.aiTrainUA) maps.push('    "~*(' + s.aiTrainUA + ')" 1;   # AI training crawlers');
      if (s.aiSearchUA) maps.push('    "~*(' + s.aiSearchUA + ')" 1;   # AI search & assistant fetchers');
      if (s.botsSeo) maps.push('    "~*(' + SEO_BOTS + ')" 1;');
      if (s.botsScan) maps.push('    "~*(' + SCAN_BOTS + ')" 1;   # vulnerability scanners');
      if (s.botsLib) maps.push('    "~*(' + LIB_BOTS + ')" 1;   # scripting libraries', '    "" 1;   # empty User-Agent');
      maps.push('}', '');
    }
    if (needRedir) {
      maps.push('# Bulk ' + s.rcode + ' redirects (' + s.redirects.length + ') : one hop to the final URL');
      maps.push('map $uri $hrg_redirect_to {', '    default "";');
      s.redirects.forEach(function(r){
        var to = /^https?:\/\//i.test(r.to) ? r.to : (s.https ? 'https://' + host + r.to : r.to);
        maps.push('    "' + r.from + '" "' + to + '";');
        if (r.from !== '/') maps.push('    "' + r.from + '/" "' + to + '";');
      });
      maps.push('}', '');
      if (needQsMerge) {
        maps.push('# Adds the visitor\'s query string to the target, using & when the target already has one');
        maps.push('map "$hrg_redirect_to|$args" $hrg_redirect_full {', '    default "";');
        maps.push('    "~^(?<hrg_t>[^|]+)\\|$" $hrg_t;');
        maps.push('    "~^(?<hrg_t>[^|?]+\\?[^|]*)\\|(?<hrg_a>.+)$" "$hrg_t&$hrg_a";');
        maps.push('    "~^(?<hrg_t>[^|]+)\\|(?<hrg_a>.+)$" "$hrg_t?$hrg_a";');
        maps.push('}', '');
      }
    }
    if (s.exts.length) {
      maps.push('# Remove .' + s.exts.join(' and .') + ' from URLs: old addresses redirect to the clean one (GET only)');
      maps.push('map "$request_method $request_uri" $hrg_noext {', '    default "";');
      maps.push('    "~^(?:GET|HEAD) /(?!wp-)(?<hrg_dir>(?:[^?]*/)?)index\\.(?:' + s.extRe + ')(?:\\?|$)" "/$hrg_dir";');
      maps.push('    "~^(?:GET|HEAD) /(?!wp-)(?<hrg_pg>[^?]+?)\\.(?:' + s.extRe + ')(?:\\?|$)" "/$hrg_pg' + (s.trailMode === 'add' ? '/' : '') + '";');
      maps.push('}', '');
    }
    if (s.authOn) {
      maps.push('# Password protection: ' + (s.authWhole ? 'whole site' : s.authFolder) + ' (/.well-known/ stays open for SSL renewals)');
      maps.push('map $uri $hrg_auth {', '    default ' + (s.authWhole ? '"Restricted"' : 'off') + ';', '    "~^/\\.well-known/" off;');
      if (!s.authWhole) maps.push('    "~^' + reEscStr(s.authPath) + '(/|$)" "Restricted";');
      maps.push('}', '');
    }
    if (s.wpA) maps.push('map $request_uri $hrg_author_scan {', '    default 0;', '    "~^/(?!wp-admin)[^?]*\\?(.*&)?author=[0-9]" 1;', '}', '');
    if (s.webp) maps.push('map $http_accept $hrg_webp_ext {', '    default   "";', '    "~*webp"  ".webp";', '}', '');
    if (maps.length) {
      any = true;
      out.push('# ---------- Add ONCE inside the http {} block of nginx.conf (not inside a server {} block) ----------');
      out = out.concat(maps);
    }

    var guard = [];
    if (needBot) guard.push('    if ($hrg_blocked_ua) { return 403; }');
    if (needRedir) guard.push(needQsMerge
      ? '    if ($hrg_redirect_to) { return ' + s.rcode + ' $hrg_redirect_full; }   # keeps the visitor\'s query string'
      : '    if ($hrg_redirect_to) { return ' + s.rcode + ' $hrg_redirect_to$is_args$args; }   # keeps the visitor\'s query string');
    if (s.exts.length) guard.push('    if ($hrg_noext) { return 301 ' + (s.https ? 'https://' + host : '') + '$hrg_noext$is_args$args; }');

    // ---- port 80 ----
    if (s.https) {
      any = true;
      var tgt = s.wwwMode === 'none' ? '$host' : host;
      out.push('# ---------- Redirect HTTP to HTTPS' + (s.wwwMode !== 'none' ? ' + canonical host, in one hop' : '') + ' ----------');
      out.push('server {', '    listen 80;', '    listen [::]:80;', '    server_name ' + d + ' www.' + d + ';');
      out = out.concat(guard);
      out.push('    return 301 https://' + tgt + '$request_uri;', '}', '');
    }

    // ---- www redirect on 443 ----
    if (s.wwwMode !== 'none') {
      any = true;
      var from = s.wwwMode === 'strip' ? 'www.' + d : d;
      if (s.https) {
        out.push('# ---------- Redirect ' + from + ' to ' + host + ' (visitors who land on https://' + from + ' directly) ----------');
        out.push('server {', '    listen 443 ssl http2;   # nginx 1.25.1+: use "listen 443 ssl;" plus "http2 on;"', '    listen [::]:443 ssl http2;', '    server_name ' + from + ';');
        out.push('    # REQUIRED -- nginx will not start without a certificate here:', '    # ssl_certificate     /path/to/fullchain.pem;', '    # ssl_certificate_key /path/to/privkey.pem;');
        out = out.concat(guard);
        out.push('    return 301 https://' + host + '$request_uri;', '}', '');
      } else {
        out.push('# ---------- Redirect ' + from + ' to ' + host + ' (keeps http or https) ----------');
        out.push('server {', '    listen 80;', '    listen [::]:80;', '    # Serving HTTPS too? Add your "listen 443 ssl" and ssl_certificate lines here.', '    server_name ' + from + ';');
        out = out.concat(guard);
        out.push('    return 301 $scheme://' + host + '$request_uri;', '}', '');
      }
    }

    // ---- old domain ----
    if (s.move && !s.moveFrom) out.push('# Move from an old domain: enter the old domain above (it must differ from your domain).', '');
    if (s.moveFrom) {
      any = true;
      out.push('# ---------- Move ' + s.moveFrom + ' to ' + s.host + ': every page goes to the same page on the new domain ----------');
      out.push('server {', '    listen 80;', '    listen [::]:80;');
      if (s.https) out.push('    listen 443 ssl http2;', '    listen [::]:443 ssl http2;');
      out.push('    server_name ' + s.moveFrom + ' www.' + s.moveFrom + ';');
      if (s.https) out.push('    # REQUIRED for https://' + s.moveFrom + ' -- nginx will not start without a certificate here:', '    # ssl_certificate     /path/to/fullchain.pem;', '    # ssl_certificate_key /path/to/privkey.pem;');
      out = out.concat(guard);
      out.push('    return 301 ' + s.newBase + '$request_uri;', '}', '');
    }

    // ---- main server ----
    var m = [];
    var hdr = function(ind){ return s.headers ? headerPairs(s).map(function(h){ return ind + 'add_header ' + h[0] + ' "' + h[1] + '" always;'; }) : []; };
    if (s.headers) {
      if (s.preload) m.push('    # HSTS preload: only if EVERY subdomain serves HTTPS. Then submit at hstspreload.org');
      if (s.csp) m.push('    # CSP is report-only: rename to Content-Security-Policy once the console is clean');
      m = m.concat(hdr('    '));
    }
    if (s.ips.length) {
      m.push('    # Block IP addresses (behind Cloudflare? use the Cloudflare tab, or set real_ip_header first)');
      s.ips.forEach(function(ip){ m.push('    deny ' + ip + ';'); });
    }
    if (s.authOn) {
      m.push('    # Password protection: create ' + s.authFile + ' containing exactly this line', '    # (keep it outside your web root):', '    #   ' + s.authUser + ':' + authHash.apr1);
      m.push('    auth_basic $hrg_auth;', '    auth_basic_user_file ' + s.authFile + ';');
    }
    m = m.concat(guard);
    if (s.hotlink) {
      m.push('    # Hotlink protection: other sites cannot embed your images' + (s.domainSet ? '' : ' (enter your domain above)'));
      m.push('    valid_referers none blocked ' + s.domain + ' *.' + s.domain + ' ~(' + SEARCH_REF + ')\\.;');
      m.push('    set $hrg_hotlink "";');
      m.push('    if ($invalid_referer) { set $hrg_hotlink "R"; }');
      m.push('    if ($uri ~* \\.(?:jpe?g|png|gif|webp|avif|svg)$) { set $hrg_hotlink "${hrg_hotlink}I"; }');
      m.push('    if ($hrg_hotlink = "RI") { return 403; }');
    }
    if (s.errPages.length) {
      m.push('    # Custom error pages');
      s.errPages.forEach(function(e){ m.push('    error_page ' + e[0] + ' ' + e[1] + ';'); });
    }
    if (s.wpA) m.push('    if ($hrg_author_scan) { return 403; }   # ?author=N username scans');
    if (s.dirlist) m.push('    autoindex off;   # directory listing (off by default; stated explicitly)');
    if (s.trailMode === 'remove') m.push('    # Trailing slash: remove (real folders untouched)', '    if (!-d $request_filename) { rewrite ^/(.+)/$ /$1 permanent; }');
    if (s.trailMode === 'add') m.push('    # Trailing slash: add (files with extensions untouched)', '    if (!-f $request_filename) { rewrite ^([^.]*[^/])$ $1/ permanent; }');
    if (s.gzip) {
      m.push('', '    # Compression', '    gzip on;', '    gzip_vary on;', '    gzip_comp_level 5;', '    gzip_min_length 256;', '    gzip_proxied any;');
      m.push('    gzip_types ' + GZIP_TYPES + ';', '    # Brotli needs the ngx_brotli module: brotli on; brotli_types <same list>;');
    }
    var locs = [];
    if (s.protect || s.wpX || s.wpC || s.wpU) {
      locs.push('', '    # ---- Deny rules: keep these ABOVE your "location ~ \\.php$" block ----');
      if (s.protect) {
        locs.push('    location ~ /\\.(?!well-known/) { deny all; }   # .env, .git, .htpasswd ...');
        locs.push('    location ~* (?:\\.(?:bak|conf|config|dist|inc|ini|log|orig|psd|save|sh|sql|swo|swp)|~)$ { deny all; }');
        locs.push('    location ~* /(?:composer\\.(?:json|lock)|package(?:-lock)?\\.json|yarn\\.lock)$ { deny all; }');
      }
      if (s.wpX) locs.push('    location = /xmlrpc.php { deny all; }   # breaks Jetpack / XML-RPC apps');
      if (s.wpC) locs.push('    location = /wp-config.php { deny all; }');
      if (s.wpU) locs.push('    location ~* ^/wp-content/uploads/.*\\.(?:php\\d?|phtml|phar)$ { deny all; }');
    }
    // Static assets. NOTE: add_header in a location replaces ALL parent add_header lines,
    // so the security headers are repeated inside each location that sets its own.
    var imgExt = 'png|jpe?g';
    if (s.webp) {
      locs.push('', '    # WebP: serve photo.jpg.webp when it exists and the browser accepts WebP');
      locs.push('    location ~* \\.(?:' + imgExt + ')$ {');
      if (s.headers) locs.push('        # add_header here replaces the parent ones, so security headers are repeated');
      locs = locs.concat(hdr('        '));
      locs.push('        add_header Vary Accept always;');
      if (s.cache) locs.push('        expires 1y;', '        access_log off;');
      locs.push('        try_files $uri$hrg_webp_ext $uri =404;', '    }');
    }
    if (s.cache) {
      var ext = 'css|js|mjs|gif|svg|ico|webp|avif|woff2?|ttf|otf|eot' + (s.webp ? '' : '|' + imgExt);
      locs.push('', '    # Browser caching for static assets (HTML is not matched, so it is never cached)');
      locs.push('    # If your config already has a static-asset location, merge these lines into it instead.');
      locs.push('    location ~* \\.(?:' + ext + ')$ {', '        expires 1y;', '        access_log off;', '        log_not_found off;');
      if (s.headers) locs.push('        # Security headers repeated here: any add_header inside a location replaces the parent ones');
      locs = locs.concat(hdr('        '));
      locs.push('    }');
    }
    if (s.exts.length) {
      locs.push('', '    # Serve /page from page.' + s.exts.join(' or page.') + ' behind the scenes.');
      locs.push('    # Already have a "location /" block? Put this try_files line in it instead.');
      locs.push('    location / {', '        try_files $uri $uri/ @hrg_noext;', '    }');
      locs.push('    location @hrg_noext {', '        set $hrg_page $uri;', '        if ($uri ~ ^(.+)/$) { set $hrg_page $1; }');
      s.exts.forEach(function(x){ locs.push('        if (-f $document_root$hrg_page.' + x + ') { rewrite ^ $hrg_page.' + x + ' last; }'); });
      locs.push('        return 404;', '    }');
    }
    m = m.concat(locs);
    if (m.length) {
      any = true;
      out.push('# ---------- Add inside your MAIN server {} block (the one serving ' + host + (s.https ? ' on 443' : '') + ') ----------');
      out.push('server {');
      if (s.https) out.push('    listen 443 ssl http2;', '    listen [::]:443 ssl http2;'); else out.push('    listen 80;', '    listen [::]:80;');
      out.push('    server_name ' + host + (s.wwwMode === 'none' ? ' www.' + d : '') + ';');
      out.push('    # ... your existing root, index and ssl_certificate lines ...', '    # Keep your existing PHP block (location ~ \\.php$) BELOW the deny rules further down,', '    # otherwise the uploads-folder PHP block will not work.', '');
      out = out.concat(m);
      out.push('}', '');
    }
    if (!any) out.push('# Flip a switch above to generate your Nginx config.');
    return out.join('\n');
  }

  /* ================================================================
     CADDY
     ================================================================ */
  function buildCaddy(s){
    var d = s.domain, host = s.host;
    var out = banner(['Caddy v2 Caddyfile. Caddy gets certificates and redirects HTTP to HTTPS', 'automatically. Merge these lines into your site block, then:', '  caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy']);
    if (!s.https) out.push('# Note: Caddy forces HTTPS by default. To serve plain HTTP only, prefix the', '# site address with http:// (e.g. http://' + host + ').', '');
    var I = '    ';
    var caddyCode = s.rcode === '302' ? 'temporary' : 'permanent';
    var cq = function(p){ return / /.test(p) ? '"' + p + '"' : p; };
    if (s.wwwMode !== 'none') {
      var from = s.wwwMode === 'strip' ? 'www.' + d : d;
      out.push('# Canonical host: ' + from + ' -> ' + host + ' (one hop, HTTP and HTTPS)');
      // Bulk redirects are repeated here so old URLs on the other host still reach their target in one hop
      var wr = [];
      s.redirects.forEach(function(r){
        var to = /^https?:\/\//i.test(r.to) ? r.to : 'https://' + host + r.to;
        var qs = to.indexOf('?') < 0 ? '{?query}' : '&{query}';
        wr.push(I + 'redir ' + cq(r.from) + ' ' + to + qs + ' ' + caddyCode);
        if (r.from !== '/') wr.push(I + 'redir ' + cq(r.from + '/') + ' ' + to + qs + ' ' + caddyCode);
      });
      out.push(from + ', http://' + from + ', http://' + host + ' {');
      out = out.concat(wr);
      out.push(I + 'redir https://' + host + '{uri} permanent', '}', '');
    }
    if (s.move && !s.moveFrom) out.push('# Move from an old domain: enter the old domain above (it must differ from your domain).', '');
    if (s.moveFrom) {
      out.push('# Move ' + s.moveFrom + ' to ' + s.host + ': every page goes to the same page on the new domain');
      out.push(s.moveFrom + ', www.' + s.moveFrom + ', http://' + s.moveFrom + ', http://www.' + s.moveFrom + ' {');
      s.redirects.forEach(function(r){
        var to = /^https?:\/\//i.test(r.to) ? r.to : 'https://' + host + r.to;
        var qs = to.indexOf('?') < 0 ? '{?query}' : '&{query}';
        out.push(I + 'redir ' + cq(r.from) + ' ' + to + qs + ' ' + caddyCode);
        if (r.from !== '/') out.push(I + 'redir ' + cq(r.from + '/') + ' ' + to + qs + ' ' + caddyCode);
      });
      out.push(I + 'redir https://' + host + '{uri} permanent', '}', '');
    }
    var b = [];
    b.push(I + '# root * /var/www/' + d + '   (keep your existing root)');
    if (s.gzip) b.push('', I + '# Compression', I + 'encode zstd gzip');
    if (s.headers) {
      b.push('', I + '# Security headers');
      if (s.preload) b.push(I + '# HSTS preload: only if EVERY subdomain serves HTTPS. Then submit at hstspreload.org');
      if (s.csp) b.push(I + '# CSP is report-only: rename to Content-Security-Policy once the console is clean');
      b.push(I + 'header {');
      headerPairs(s).forEach(function(h){ b.push(I + I + h[0] + ' "' + h[1] + '"'); });
      b.push(I + '}');
    }
    if (s.anyBots) {
      b.push('', I + '# Block bots by User-Agent');
      if (s.aiTrainUA) b.push(I + '@ai_train header_regexp User-Agent "(?i)(' + s.aiTrainUA + ')"', I + 'respond @ai_train 403');
      if (s.aiSearchUA) b.push(I + '@ai_search header_regexp User-Agent "(?i)(' + s.aiSearchUA + ')"', I + 'respond @ai_search 403');
      if (s.botsSeo) b.push(I + '@seo_bots header_regexp User-Agent "(?i)(' + SEO_BOTS + ')"', I + 'respond @seo_bots 403');
      if (s.botsScan) b.push(I + '@scanners header_regexp User-Agent "(?i)(' + SCAN_BOTS + ')"', I + 'respond @scanners 403');
      if (s.botsLib) {
        b.push(I + '# Scripting libraries + empty User-Agents (can also block uptime monitors and integrations)');
        b.push(I + '@scripts header_regexp User-Agent "(?i)(' + LIB_BOTS + ')"', I + 'respond @scripts 403');
        b.push(I + '@no_ua not header_regexp User-Agent .+', I + 'respond @no_ua 403');
      }
    }
    if (s.ips.length) {
      b.push('', I + '# Block IP addresses (behind a proxy? use client_ip with trusted_proxies instead)');
      b.push(I + '@blocked_ips remote_ip ' + s.ips.join(' '), I + 'respond @blocked_ips 403');
    }
    if (s.hotlink) {
      b.push('', I + '# Hotlink protection: other sites cannot embed your images' + (s.domainSet ? '' : ' (enter your domain above)'));
      b.push(I + '@hotlink {', I + I + 'path *.jpg *.jpeg *.png *.gif *.webp *.avif *.svg', I + I + 'header Referer *');
      b.push(I + I + 'not header_regexp own Referer ^https?://([^/]+\\.)?' + s.domainRe + '(/|:|$)');
      b.push(I + I + 'not header_regexp search Referer ^https?://([^/]+\\.)?(' + SEARCH_REF + ')\\.', I + '}', I + 'respond @hotlink 403');
    }
    if (s.protect) {
      b.push('', I + '# Protect sensitive files (.well-known stays open for SSL)');
      b.push(I + '@hidden {', I + I + 'path */.*', I + I + 'not path /.well-known/*', I + '}', I + 'respond @hidden 403');
      b.push(I + '@private path *.bak *.conf *.config *.dist *.inc *.ini *.log *.orig *.psd *.save *.sh *.sql *.swo *.swp *~ */composer.json */composer.lock */package.json */package-lock.json */yarn.lock');
      b.push(I + 'respond @private 403');
    }
    if (s.anyWp) {
      b.push('', I + '# WordPress hardening');
      var wpPaths = []; if (s.wpX) wpPaths.push('/xmlrpc.php'); if (s.wpC) wpPaths.push('/wp-config.php');
      if (wpPaths.length) b.push(I + '@wp_blocked path ' + wpPaths.join(' ') + (s.wpX ? '   # xmlrpc: breaks Jetpack / XML-RPC apps' : ''), I + 'respond @wp_blocked 403');
      if (s.wpU) b.push(I + '@uploads_php path_regexp ^/wp-content/uploads/.*\\.(php\\d?|phtml|phar)$', I + 'respond @uploads_php 403');
      if (s.wpA) b.push(I + '@author_scan {', I + I + 'not path /wp-admin/*', I + I + 'query author=*', I + '}', I + 'respond @author_scan 403');
    }
    if (s.redirects.length) {
      b.push('', I + '# Bulk ' + s.rcode + ' redirects (' + s.redirects.length + ')');
      s.redirects.forEach(function(r){
        var to = /^https?:\/\//i.test(r.to) ? r.to : 'https://' + host + r.to;
        var qs = to.indexOf('?') < 0 ? '{?query}' : '&{query}';   // keep the visitor's query string
        b.push(I + 'redir ' + cq(r.from) + ' ' + to + qs + ' ' + caddyCode);
        if (r.from !== '/') b.push(I + 'redir ' + cq(r.from + '/') + ' ' + to + qs + ' ' + caddyCode);
      });
    }
    if (s.trailMode === 'remove') b.push('', I + '# Trailing slash: remove (real folders untouched)', I + '@trailing {', I + I + 'path_regexp trailing ^(.+)/$', I + I + 'not file {', I + I + I + 'try_files {path}/', I + I + '}', I + '}', I + 'redir @trailing {re.trailing.1} permanent');
    if (s.trailMode === 'add') b.push('', I + '# Trailing slash: add (files with extensions untouched)', I + '@no_slash {', I + I + 'path_regexp ^[^.]*[^/]$', I + I + 'not file', I + '}', I + 'redir @no_slash {path}/ permanent');
    if (s.webp) {
      b.push('', I + '# WebP: serve photo.jpg.webp when it exists and the browser accepts WebP');
      b.push(I + '@webp {', I + I + 'header Accept *image/webp*', I + I + 'path *.jpg *.jpeg *.png', I + I + 'file {path}.webp', I + '}', I + 'rewrite @webp {path}.webp');
      b.push(I + '@images path *.jpg *.jpeg *.png', I + 'header @images Vary Accept');
    }
    if (s.cache) {
      b.push('', I + '# Browser caching for static assets (HTML is never cached)');
      b.push(I + '@static path *.css *.js *.mjs *.gif *.png *.jpg *.jpeg *.webp *.avif *.svg *.ico *.woff *.woff2 *.ttf *.otf');
      b.push(I + 'header @static Cache-Control "public, max-age=31536000, immutable"');
    }
    if (s.exts.length) {
      b.push('', I + '# Remove .' + s.exts.join(' and .') + ' from URLs: old addresses redirect to the clean one (GET only)');
      b.push(I + '@hrg_ext_index {', I + I + 'method GET HEAD', I + I + 'path_regexp hrg_ei ^(.*/)index\\.(' + s.extRe + ')$', I + I + 'not path /wp-*', I + '}');
      b.push(I + 'redir @hrg_ext_index {re.hrg_ei.1}{?query} permanent');
      b.push(I + '@hrg_ext {', I + I + 'method GET HEAD', I + I + 'path_regexp hrg_ext ^(/.+?)\\.(' + s.extRe + ')$', I + I + 'not path_regexp ^/(.*/)?index\\.(' + s.extRe + ')$', I + I + 'not path /wp-*', I + '}');
      b.push(I + 'redir @hrg_ext {re.hrg_ext.1}' + (s.trailMode === 'add' ? '/' : '') + '{?query} permanent');
      b.push(I + '# ...and serve /page from page.' + s.exts.join(' or page.') + ' behind the scenes');
      b.push(I + '@hrg_pages path_regexp hrg_ne ^(/.+?)/?$', I + 'route @hrg_pages {');
      b.push(I + I + '@hrg_noext file ' + s.exts.map(function(x){ return '{re.hrg_ne.1}.' + x; }).join(' '), I + I + 'rewrite @hrg_noext {file_match.relative}', I + '}');
    }
    if (s.authOn) {
      b.push('', I + '# Password protection: ' + (s.authWhole ? 'whole site' : s.authFolder) + ' (/.well-known/ stays open for SSL renewals)');
      b.push(I + '# Caddy before 2.8 spells it "basicauth"');
      b.push(I + '@hrg_protected {');
      if (!s.authWhole) b.push(I + I + 'path ' + s.authPath + ' ' + s.authPath + '/*');
      b.push(I + I + 'not path /.well-known/*', I + '}');
      b.push(I + 'basic_auth @hrg_protected {', I + I + s.authUser + ' ' + authHash.bcrypt, I + '}');
    }
    if (s.dirlist) b.push('', I + '# Directory listing: file_server never lists folders unless you add "browse"');
    if (s.errPages.length) {
      b.push('', I + '# Custom error pages');
      s.errPages.forEach(function(e){ b.push(I + 'handle_errors ' + e[0] + ' {', I + I + 'rewrite * ' + e[1], I + I + 'file_server', I + '}'); });
    }
    b.push('', I + '# php_fastcgi unix//run/php/php-fpm.sock   (keep your existing PHP handler)', I + '# file_server');
    out.push(host + (s.wwwMode === 'none' ? ', www.' + d : '') + ' {');
    out = out.concat(b);
    out.push('}');
    return out.join('\n');
  }

  /* ================================================================
     CLOUDFLARE
     ================================================================ */
  function cfUA(names){
    return names.map(function(n){ return '(lower(http.user_agent) contains "' + n.toLowerCase() + '")'; });
  }
  function buildCloudflare(s){
    var out = ['# ============================================================',
      '# Cloudflare rules from the PaidHosting .htaccess, Nginx & Caddy Rule Generator',
      '# These work whatever server runs behind Cloudflare. Each rule below is one WAF custom rule:',
      '# in your Cloudflare dashboard, open your site, go to Security > Security rules (older dashboards:',
      '# Security > WAF > Custom rules), click Create rule and choose "Edit expression".',
      '# Paste only the expression lines (not the # lines), choose the action shown, then Deploy.',
      '# The Free plan allows 5 custom rules; this tab never uses more than 4.',
      '# Reopen or edit this config: ' + shareUrl(true),
      '# ============================================================', ''];
    var rules = [];
    var ai = [];
    if (s.aiTrainUA) ai = ai.concat(cfUA(s.aiTrainUA.split('|')));
    if (s.aiSearchUA) ai = ai.concat(cfUA(s.aiSearchUA.split('|')));
    if (ai.length) rules.push(['Block AI crawlers', ai]);
    var bad = [];
    if (s.botsSeo) bad = bad.concat(cfUA(SEO_BOTS.split('|')));
    if (s.botsScan) bad = bad.concat(cfUA(SCAN_BOTS.split('|')));
    if (s.botsLib) bad = bad.concat(cfUA(LIB_BOTS.split('|')), ['(http.user_agent eq "")']);
    if (bad.length) rules.push(['Block bad bots', bad]);
    var files = [];
    if (s.protect) {
      files.push('(http.request.uri.path contains "/." and not starts_with(http.request.uri.path, "/.well-known/"))');
      files.push('(http.request.uri.path.extension in {"bak" "conf" "config" "dist" "inc" "ini" "log" "orig" "psd" "save" "sh" "sql" "swo" "swp"})');
      files.push('(ends_with(http.request.uri.path, "/composer.json") or ends_with(http.request.uri.path, "/composer.lock") or ends_with(http.request.uri.path, "/package.json") or ends_with(http.request.uri.path, "/package-lock.json") or ends_with(http.request.uri.path, "/yarn.lock"))');
    }
    if (s.wpX) files.push('(http.request.uri.path eq "/xmlrpc.php")');
    if (s.wpC) files.push('(http.request.uri.path eq "/wp-config.php")');
    if (s.wpU) files.push('(starts_with(http.request.uri.path, "/wp-content/uploads/") and http.request.uri.path.extension in {"php" "php5" "php7" "php8" "phtml" "phar"})');
    if (s.wpA) files.push('((starts_with(http.request.uri.query, "author=") or http.request.uri.query contains "&author=") and not starts_with(http.request.uri.path, "/wp-admin"))');
    if (files.length) rules.push([s.anyWp ? 'Protect sensitive files and WordPress' : 'Protect sensitive files', files]);
    if (s.ips.length) rules.push(['Block IP addresses', ['(ip.src in {' + s.ips.join(' ') + '})']]);
    rules.forEach(function(r, i){
      out.push('# ---------- Rule ' + (i + 1) + ' of ' + rules.length + ': ' + r[0] + '  (action: Block) ----------');
      out.push(r[1].join('\nor '), '');
    });
    if (s.redirects.length || s.moveFrom) {
      var q = function(v){ return v.indexOf(',') >= 0 ? '"' + v + '"' : v; };
      // Cloudflare drops a target's own query string when "preserve query string" is on,
      // so targets with their own ?query keep it and the visitor's query string is not added.
      var keepQs = function(to){ return to.indexOf('?') < 0 ? 'TRUE' : 'FALSE'; };
      var cfTo = function(r){ return /^https?:\/\//i.test(r.to) ? r.to : 'https://' + s.host + r.to; };
      out.push('# ---------- Bulk Redirects list ----------');
      out.push('# Find "Bulk Redirects" in your Cloudflare account: create a list, import these lines as a .csv file (no header row),');
      out.push('# then create a Bulk Redirect rule that uses the list. Covers www and keeps visitors\' query strings,');
      out.push('# except where the new URL has its own (Cloudflare can\'t combine the two).');
      s.redirects.forEach(function(r){
        var to = cfTo(r);
        out.push(q(s.domain + encodeURI(r.from)) + ',' + q(to) + ',' + s.rcode + ',' + keepQs(to) + ',TRUE');
        if (r.from !== '/') out.push(q(s.domain + encodeURI(r.from) + '/') + ',' + q(to) + ',' + s.rcode + ',' + keepQs(to) + ',TRUE');
      });
      if (s.moveFrom) {
        out.push('# Domain move: ' + s.moveFrom + ' must also be on your Cloudflare account, proxied (orange cloud).');
        s.redirects.forEach(function(r){
          if (r.from === '/') return;
          var to = cfTo(r);
          out.push(q(s.moveFrom + encodeURI(r.from)) + ',' + q(to) + ',' + s.rcode + ',' + keepQs(to) + ',TRUE,TRUE,FALSE');
        });
        out.push(s.moveFrom + '/,https://' + s.host + '/,301,TRUE,TRUE,TRUE,TRUE');
      }
      out.push('');
    }
    var set = [];
    if (s.https) set.push('# Force HTTPS: SSL/TLS > Edge Certificates > turn on "Always Use HTTPS"');
    if (s.wwwMode !== 'none') set.push('# Canonical www: Rules > Overview > create a Redirect Rule from the "' + (s.wwwMode === 'strip' ? 'Redirect from WWW to root' : 'Redirect from root to WWW') + '" template');
    if (s.hsts) set.push('# HSTS: SSL/TLS > Edge Certificates > turn on "HTTP Strict Transport Security (HSTS)"' + (s.preload ? ' with include subdomains and preload' : ''));
    if (s.hotlink) set.push('# Hotlink protection: Security > Settings > turn on "Hotlink Protection"');
    if (s.gzip) set.push('# Compression: Cloudflare compresses automatically, nothing to do');
    if (s.headers || s.cache || s.webp || s.errPages.length || s.dirlist || s.trailMode !== 'none' || s.exts.length || s.authOn) set.push('# Security headers, caching, WebP, error pages, trailing slashes, directory listing,', '#   extension-free URLs and password protection: keep the rules from your server\'s tab.', '#   Cloudflare passes them through.');
    if (set.length) out = out.concat(['# ---------- Cloudflare settings (no rule needed; open your site in the dashboard) ----------'], set);
    if (!rules.length && !s.redirects.length && !set.length) out.push('# Flip a switch above to generate Cloudflare rules.');
    return out.join('\n');
  }

  /* ================================================================
     robots.txt (AI opt-out)
     ================================================================ */
  function buildRobots(s){
    var out = ['# robots.txt: AI crawler opt-out', '# Generated by the PaidHosting .htaccess, Nginx & Caddy Rule Generator', '# Merge with your existing robots.txt at https://' + s.host + '/robots.txt', '# robots.txt is a request, not enforcement: the server rules in the other tabs', '# block crawlers that ignore it. Google-Extended and Applebot-Extended only work here.', ''];
    var names = [];
    names = s.aiTrainNames.concat(s.aiSearchNames);
    var seen = {};
    names.forEach(function(n){ if (!seen[n]) { seen[n] = 1; out.push('User-agent: ' + n); } });
    if (names.length) out.push('Disallow: /');
    else out.push('# Tick at least one AI crawler group to generate rules.');
    return out.join('\n');
  }

  /* ---------------- Share links ---------------- */
  function encodeState(noRedirects){
    var bits = CHECKS.map(function(k){ return el[k].checked ? '1' : '0'; }).join('');
    var p = ['c=' + parseInt('1' + bits, 2).toString(36), 'w=' + el['www-mode'].value, 't=' + el['trail-mode'].value, 'd=' + encodeURIComponent((el.domain.value || '').trim())];
    if (activeTab !== 'apache') p.push('tab=' + activeTab);
    if (el['redir-type'].value === '302') p.push('rt=302');
    var xb = Object.keys(excludedBots);
    if (xb.length) p.push('xb=' + encodeURIComponent(xb.join(',')));
    if (el.errors.checked) p.push('e=' + encodeURIComponent(ERR_CODES.map(function(c){ return (el['err' + c].value || '').trim(); }).join('|')));
    if (el.move.checked && el.moveFrom.value.trim()) p.push('mf=' + encodeURIComponent(el.moveFrom.value.trim()));
    if (el['noext-mode'].value !== 'php') p.push('ne=' + el['noext-mode'].value);
    if (el.auth.checked) p.push('af=' + encodeURIComponent((el.authFolder.value || '').trim()), 'ap=' + encodeURIComponent((el.authFile.value || '').trim()));
    var r = (el.redirText.value || '').trim();
    if (r && el.redir.checked && !noRedirects) {
      var enc = b64e(r); if (enc && !(enc.length > 6000)) p.push('r=' + enc);
    }
    var ips = (el.ipText.value || '').trim();
    if (ips && el.ipblock.checked && !noRedirects) {
      var ienc = b64e(ips); if (ienc && !(ienc.length > 3000)) p.push('ip=' + ienc);
    }
    return p.join('&');
  }
  function b64e(t){ try { return btoa(unescape(encodeURIComponent(t))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); } catch(e){ return ''; } }
  function b64d(t){ try { return decodeURIComponent(escape(atob(t.replace(/-/g,'+').replace(/_/g,'/')))); } catch(e){ return ''; } }
  function shareUrl(noRedirects){ return HRG_URL + '?' + encodeState(noRedirects); }
  function loadFromUrl(){
    var q = {}; (location.search || '').replace(/^\?/, '').split('&').forEach(function(kv){ if (!kv) return; var i = kv.indexOf('='); q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); });
    if (!q.c) return false;
    var bits = parseInt(q.c, 36).toString(2).slice(1);
    // Older links have fewer switches. Links from before "bots-lib" was split out of "bots-scan"
    // carry that setting over; switches added later start off.
    if (bits.length === 23) bits += bits.charAt(CHECKS.indexOf('bots-scan'));
    while (bits.length > 23 && bits.length < CHECKS.length) bits += '0';
    if (bits.length !== CHECKS.length) return false;
    CHECKS.forEach(function(k, i){ el[k].checked = bits.charAt(i) === '1'; });
    if (q.w === 'strip' || q.w === 'force') el['www-mode'].value = q.w;
    if (q.t === 'remove' || q.t === 'add') el['trail-mode'].value = q.t;
    if (q.d) el.domain.value = q.d.slice(0, 253);
    if (q.r) el.redirText.value = b64d(q.r);
    if (q.ip) el.ipText.value = b64d(q.ip);
    if (q.rt === '302') el['redir-type'].value = '302';
    if (q.xb) q.xb.split(',').forEach(function(n){ if (AI_BOTS.some(function(b){ return b[0] === n; })) excludedBots[n] = 1; });
    if (q.e) q.e.split('|').forEach(function(v, i){ if (ERR_CODES[i]) el['err' + ERR_CODES[i]].value = v.slice(0, 200); });
    if (q.mf) el.moveFrom.value = q.mf.slice(0, 253);
    if (q.ne === 'html' || q.ne === 'both') el['noext-mode'].value = q.ne;
    if (q.af) el.authFolder.value = q.af.slice(0, 200);
    if (q.ap) el.authFile.value = q.ap.slice(0, 300);
    if (q.tab && /^(apache|nginx|caddy|cloudflare|robots)$/.test(q.tab)) activeTab = q.tab;
    return true;
  }

  /* ---------------- Choose individual AI bots ---------------- */
  function buildBotList(){
    var box = $('hrg-ai-bots'); if (!box) return;
    var groups = [['train', 'Training crawlers'], ['search', 'AI search indexes'], ['user', 'Live fetches when a person asks an assistant']];
    var h = '<details class="hrg-botlist"><summary>Choose individual bots</summary>';
    groups.forEach(function(g){
      h += '<div class="hrg-botlist-head">' + g[1] + '</div><div class="hrg-botlist-grid">';
      AI_BOTS.forEach(function(b){
        if (b[2] !== g[0]) return;
        h += '<label class="hrg-bot"><input type="checkbox" data-bot="' + b[0] + '"><span class="hrg-bot-text"><span class="hrg-bot-name">' + b[0] + '</span> <span class="hrg-bot-meta">' + b[1] + (b[3] ? ' · robots.txt only' : '') + '</span></span></label>';
      });
      h += '</div>';
    });
    box.innerHTML = h + '</details>';
    box.querySelectorAll('input[data-bot]').forEach(function(c){
      c.addEventListener('change', function(){
        if (c.checked) delete excludedBots[c.getAttribute('data-bot')]; else excludedBots[c.getAttribute('data-bot')] = 1;
        render();
      });
    });
  }
  function syncBotList(s){
    var box = $('hrg-ai-bots'); if (!box) return;
    box.querySelectorAll('input[data-bot]').forEach(function(c){
      var name = c.getAttribute('data-bot');
      var bot = AI_BOTS.filter(function(b){ return b[0] === name; })[0];
      var groupOn = bot[2] === 'train' ? s['ai-train'] : s['ai-search'];
      c.checked = !excludedBots[name];
      c.disabled = !groupOn;
      c.parentNode.classList.toggle('hrg-bot-off', !groupOn);
    });
  }

  /* ---------------- Presets ---------------- */
  function applyPreset(name){
    var p = PRESETS[name]; if (!p) return;
    lastPreset = name;
    excludedBots = {};
    CHECKS.forEach(function(k){ el[k].checked = !!p[k]; });
    SELECTS.forEach(function(k){ el[k].value = p[k] || PRESET_DEFAULTS[k]; });
    render();
  }
  var lastPreset = '';
  function matchPreset(){
    var found = '';
    var order = Object.keys(PRESETS);
    if (lastPreset) order = [lastPreset].concat(order.filter(function(n){ return n !== lastPreset; }));
    order.forEach(function(name){
      if (found) return;
      var p = PRESETS[name];
      var ok = CHECKS.every(function(k){ return !!el[k].checked === !!p[k]; });
      if (ok && el.www.checked) ok = el['www-mode'].value === (p['www-mode'] || 'strip');
      if (ok && el.trail.checked) ok = el['trail-mode'].value === (p['trail-mode'] || 'remove');
      if (ok && Object.keys(excludedBots).length) ok = false;
      if (ok) found = name;
    });
    document.querySelectorAll('#ph-htaccessgen .hrg-preset').forEach(function(b){
      var on = b.getAttribute('data-preset') === found;
      b.classList.toggle('hrg-preset-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /* ---------------- Render ---------------- */
  function featureList(s){
    var f = [];
    if (s.https) f.push('HTTPS');
    if (s.wwwMode === 'strip') f.push('non-www');
    if (s.wwwMode === 'force') f.push('www');
    if (s.trailMode !== 'none') f.push('trailing-slash rules');
    if (s.redirects.length) f.push(s.redirects.length + ' bulk ' + s.rcode + ' redirect' + (s.redirects.length === 1 ? '' : 's'));
    if (s.headers) f.push('security headers');
    if (s.ai && (s.aiTrain || s.aiSearch)) f.push('AI crawler blocking');
    if (s.botsSeo || s.botsScan || s.botsLib) f.push('bad bot blocking');
    if (s.protect) f.push('sensitive-file protection');
    if (s.hotlink) f.push('hotlink protection');
    if (s.moveFrom) f.push('a domain move');
    if (s.exts.length) f.push('extension-free URLs');
    if (s.authOn) f.push('password protection');
    if (s.ips.length) f.push('IP blocking');
    if (s.errPages.length) f.push('custom error pages');
    if (s.anyWp) f.push('WordPress hardening');
    if (s.gzip) f.push('compression');
    if (s.cache) f.push('browser caching');
    if (s.webp) f.push('WebP delivery');
    return f;
  }
  function countOn(keys){ var n = 0; keys.forEach(function(k){ if (el[k].checked) n++; }); return n ? n + ' on' : 'off'; }

  var FILENAMES = { apache: '.htaccess', nginx: 'nginx site config', caddy: 'Caddyfile', cloudflare: 'Cloudflare rules', robots: 'robots.txt' };
  var NOTES = {
    apache: 'Paste at the top of your .htaccess (on WordPress, above # BEGIN WordPress). Works on Apache and LiteSpeed with no restart; OpenLiteSpeed needs a restart.',
    nginx: 'Maps go once in http {}; the rest in your server blocks. Run nginx -t before reloading.',
    caddy: 'Merge into your Caddyfile site block, then run caddy validate and reload.',
    cloudflare: 'Use alongside your server\'s tab, not instead of it. Each block is one WAF custom rule; paste only the expression lines.',
    robots: 'Add to the robots.txt at your site root. Works alongside the server rules in the other tabs.'
  };

  function render(){
    Object.keys(SUBS).forEach(function(k){ $(SUBS[k]).classList.toggle('hrg-show', el[k].checked); });
    parseRedirects();
    parseIps();
    var s = getState();
    if (el.authStatus) {
      var au = (el.authUser.value || '').trim();
      el.authStatus.textContent = !s.auth ? '' : /[:\s]/.test(au) ? 'Usernames can\'t contain spaces or colons.' : (!au || !el.authPass.value) ? 'Enter a username and password to generate the rules.' : 'Ready. Your password is scrambled (hashed) in your browser and never sent anywhere or added to share links.';
      el.authStatus.classList.toggle('hrg-warn', s.auth && !s.authOn);
    }
    syncBotList(s);
    var wo = el['www-mode'].options;
    wo[0].text = 'Redirect www.' + s.domain + ' \u2192 ' + s.domain + ' (remove www)';
    wo[1].text = 'Redirect ' + s.domain + ' \u2192 www.' + s.domain + ' (force www)';

    var robotsTab = $('hrg-tab-robots');
    robotsTab.hidden = !(s.aiTrain || s.aiSearch);
    if (robotsTab.hidden && activeTab === 'robots') activeTab = 'apache';

    outputs = { apache: buildApache(s), nginx: buildNginx(s), caddy: buildCaddy(s), cloudflare: buildCloudflare(s), robots: buildRobots(s) };
    el.code.textContent = outputs[activeTab];
    el.filename.textContent = FILENAMES[activeTab];
    el.note.textContent = NOTES[activeTab];
    document.querySelectorAll('#ph-htaccessgen .hrg-tab').forEach(function(t){
      var on = t.getAttribute('data-tab') === activeTab;
      t.classList.toggle('hrg-tab-active', on); t.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    $('hrg-count-redir').textContent = countOn(['https','www','trail','redir','errors','move','noext']);
    $('hrg-count-sec').textContent = countOn(['headers','ai','bots','protect','dirlist','wp','hotlink','ipblock','auth']);
    $('hrg-count-perf').textContent = countOn(['gzip','cache','webp']);
    matchPreset();

    var features = featureList(s);
    var linkbox = document.querySelector('#ph-htaccessgen .hrg-linkbox');
    if (features.length) {
      var ft = features.length === 1 ? features[0] : features.slice(0, -1).join(', ') + ' and ' + features[features.length - 1];
      var url = shareUrl(true);
      var escUrl = url.split('\x26').join('\x26amp;');
      var citeHTML = 'Generated with PaidHosting.com\'s <a href="' + escUrl + '" style="font-weight: 700 !important;">' + HRG_TITLE + '</a>, configured for ' + ft + '.';
      var citeCopyHTML = 'Generated with PaidHosting.com\'s <a href="' + escUrl + '">' + HRG_TITLE + '</a>, configured for ' + ft + '.';
      var citeMD = 'Generated with PaidHosting.com\'s [' + HRG_TITLE + '](' + url + '), configured for ' + ft + '.';
      el.citebox.hidden = false;
      el.citebox.innerHTML = '<div class="hrg-citebox-title">Cite This Configuration</div><p class="hrg-citebox-text">' + citeHTML + '</p><div class="hrg-citebox-row"><button class="hrg-citebox-btn" id="hrg-cite-html" type="button">Copy HTML</button><button class="hrg-citebox-btn" id="hrg-cite-md" type="button">Copy Markdown</button></div>';
      $('hrg-cite-html').addEventListener('click', function(){ copyText(citeCopyHTML, this); });
      $('hrg-cite-md').addEventListener('click', function(){ copyText(citeMD, this); });
      if (linkbox) linkbox.style.setProperty('display', 'none', 'important');
    } else {
      el.citebox.hidden = true; el.citebox.innerHTML = '';
      if (linkbox) linkbox.style.removeProperty('display');
    }
  }

  /* ---------------- Copy / download ---------------- */
  function copyText(text, btn, label){
    var original = label || btn.textContent;
    function done(){
      btn.textContent = 'Copied!'; btn.classList.add('hrg-copied'); btn.classList.add('hrg-copied2');
      setTimeout(function(){ btn.textContent = original; btn.classList.remove('hrg-copied'); btn.classList.remove('hrg-copied2'); }, 2000);
    }
    function fallback(){
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta); done();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  var DL_NAMES = { apache: 'htaccess.txt', nginx: 'nginx-site.conf', caddy: 'Caddyfile', cloudflare: 'cloudflare-rules.txt', robots: 'robots.txt' };

  /* ---------------- Events ---------------- */
  // Turning on a group switch with none of its options ticked would block nothing,
  // so tick the safe defaults (runs before render, which is registered below).
  var SUB_ALL = { ai: ['ai-train','ai-search'], bots: ['bots-seo','bots-scan','bots-lib'], wp: ['wp-xmlrpc','wp-config','wp-uploads','wp-author'] };
  var SUB_DEFAULTS = { ai: ['ai-train'], bots: ['bots-scan'], wp: ['wp-config','wp-uploads','wp-author'] };
  Object.keys(SUB_DEFAULTS).forEach(function(k){
    el[k].addEventListener('change', function(){
      if (el[k].checked && !SUB_ALL[k].some(function(x){ return el[x].checked; })) SUB_DEFAULTS[k].forEach(function(x){ el[x].checked = true; });
    });
  });
  CHECKS.concat(SELECTS).forEach(function(k){ el[k].addEventListener('change', render); });
  el.domain.addEventListener('input', render);
  el.redirText.addEventListener('input', render);
  el.ipText.addEventListener('input', render);
  [el.moveFrom, el.authFolder, el.authFile].forEach(function(x){ x.addEventListener('input', render); });
  // Hashing is deliberately slow, so wait until typing pauses before rebuilding
  var authTimer = null;
  [el.authUser, el.authPass].forEach(function(x){ x.addEventListener('input', function(){ clearTimeout(authTimer); authTimer = setTimeout(render, 300); }); });
  ERR_CODES.forEach(function(c){ el['err' + c].addEventListener('input', render); });
  document.querySelectorAll('#ph-htaccessgen .hrg-tab').forEach(function(t){
    t.addEventListener('click', function(){ activeTab = t.getAttribute('data-tab'); render(); });
  });
  document.querySelectorAll('#ph-htaccessgen .hrg-preset').forEach(function(b){
    b.addEventListener('click', function(){ applyPreset(b.getAttribute('data-preset')); });
  });
  $('hrg-copy').addEventListener('click', function(){ copyText(outputs[activeTab], this, 'Copy Code'); });
  $('hrg-share').addEventListener('click', function(){ copyText(shareUrl(), this, 'Copy share link'); });
  $('hrg-download').addEventListener('click', function(){
    var blob = new Blob([outputs[activeTab] + '\n'], { type: 'text/plain' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = DL_NAMES[activeTab];
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  });
  $('hrg-link-html').addEventListener('click', function(){ copyText('<a href="' + HRG_URL + '">' + HRG_TITLE + '</a>', this); });
  $('hrg-link-md').addEventListener('click', function(){ copyText('[' + HRG_TITLE + '](' + HRG_URL + ')', this); });

  /* ---------------- Init ---------------- */
  buildBotList();
  if (loadFromUrl()) {
    // A shared link opens every group that has something switched on.
    document.querySelectorAll('#ph-htaccessgen details.hrg-group').forEach(function(g){
      if (g.querySelector('.hrg-switch input:checked')) g.open = true;
    });
  } else {
    applyPreset('wp');
  }
  render();

  var faqItems = document.querySelectorAll('#ph-htaccessgen .hrg-faq-item');
  faqItems.forEach(function(item) {
    item.querySelector('.hrg-faq-q').addEventListener('click', function() {
      var isOpen = item.classList.contains('hrg-open');
      faqItems.forEach(function(i) { i.classList.remove('hrg-open'); });
      if (!isOpen) item.classList.add('hrg-open');
    });
  });
})();
