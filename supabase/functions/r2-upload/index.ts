import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!;
const BUCKET = Deno.env.get('R2_BUCKET')!;
const ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID')!;
const SECRET_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!;
const PUBLIC_URL = (Deno.env.get('R2_PUBLIC_URL') || '').replace(/\/+$/, '');

const enc = new TextEncoder();

async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const buf = typeof data === 'string' ? enc.encode(data) : data;
  const hash = await crypto.subtle.digest('SHA-256', buf as BufferSource);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return await crypto.subtle.sign('HMAC', k, enc.encode(msg));
}

async function signRequest(method: string, key: string, body: Uint8Array | null, contentType?: string) {
  const host = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(body ?? new Uint8Array());
  const canonicalUri = `/${BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`;

  const headers: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  if (contentType) headers['content-type'] = contentType;

  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map((h) => `${h}:${headers[h]}\n`).join('');
  const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n');

  let k: ArrayBuffer | Uint8Array = enc.encode(`AWS4${SECRET_KEY}`);
  k = await hmac(k, dateStamp);
  k = await hmac(k, region);
  k = await hmac(k, service);
  k = await hmac(k, 'aws4_request');
  const sigBuf = await hmac(k, stringToSign);
  const signature = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, '0')).join('');

  headers['Authorization'] =
    `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { url: `https://${host}${canonicalUri}`, headers };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!ACCOUNT_ID || !BUCKET || !ACCESS_KEY || !SECRET_KEY) {
      return new Response(JSON.stringify({ error: 'R2 sozlanmagan' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Faqat admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: isAdmin } = await admin.rpc('has_role', {
      _user_id: claimsData.claims.sub as string,
      _role: 'admin',
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Faqat admin' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'upload';

    if (action === 'delete') {
      const { key } = await req.json();
      if (typeof key !== 'string' || !key || key.includes('..')) {
        return new Response(JSON.stringify({ error: "Noto'g'ri key" }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const signed = await signRequest('DELETE', key, null);
      const res = await fetch(signed.url, { method: 'DELETE', headers: signed.headers });
      if (!res.ok && res.status !== 404) {
        const text = await res.text();
        return new Response(JSON.stringify({ error: 'R2 delete failed', status: res.status, details: text }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await res.text().catch(() => '');
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // upload: multipart/form-data { file, key? }
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'Fayl topilmadi' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (file.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'Fayl juda katta (max 10MB)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const contentType = file.type || 'application/octet-stream';
    if (!contentType.startsWith('image/')) {
      return new Response(JSON.stringify({ error: 'Faqat rasm fayllari' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const rawKey = String(form.get('key') || '');
    const ext = (file.name.split('.').pop() || 'webp').toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = /^[a-zA-Z0-9/_.-]+$/.test(rawKey) && rawKey && !rawKey.includes('..')
      ? rawKey
      : `products/${crypto.randomUUID()}.${ext}`;

    const body = new Uint8Array(await file.arrayBuffer());
    const signed = await signRequest('PUT', key, body, contentType);
    const res = await fetch(signed.url, { method: 'PUT', headers: signed.headers, body });
    if (!res.ok) {
      const text = await res.text();
      console.error(`R2 upload failed [${res.status}]: ${text}`);
      return new Response(JSON.stringify({ error: 'R2 upload failed', status: res.status, details: text }), {
        status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    await res.text().catch(() => '');

    return new Response(JSON.stringify({ key, url: PUBLIC_URL ? `${PUBLIC_URL}/${key}` : null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('r2-upload error', e);
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
