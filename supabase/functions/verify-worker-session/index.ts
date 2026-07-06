// Validates a worker session token issued by verify-worker-pin.
// Used on client mount to confirm a stored token is still authentic and unexpired.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function b64urlDecode(s: string): Uint8Array {
  const pad = 4 - (s.length % 4 || 4);
  const norm = s.replace(/-/g, '+').replace(/_/g, '/') + (pad < 4 ? '='.repeat(pad) : '');
  const bin = atob(norm);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { token } = await req.json();
    const secret = Deno.env.get('WORKER_SESSION_SECRET');
    if (!secret || typeof token !== 'string') {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const parts = token.split('.');
    if (parts.length !== 3) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const [h, p, sig] = parts;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const expected = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, enc.encode(`${h}.${p}`)),
    );
    if (b64url(expected) !== sig) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
    const now = Math.floor(Date.now() / 1000);
    const valid = payload.role === 'worker' && typeof payload.exp === 'number' && payload.exp >= now;
    return new Response(JSON.stringify({ valid }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ valid: false }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
