import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!;
const BUCKET = Deno.env.get('R2_BUCKET')!;
const ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID')!;
const SECRET_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')!;

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

async function signGet(key: string) {
  const host = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const region = 'auto';
  const service = 's3';
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(new Uint8Array());
  const canonicalUri = `/${BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`;

  const headers: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map((h) => `${h}:${headers[h]}\n`).join('');
  const canonicalRequest = ['GET', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
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
    const key = new URL(req.url).searchParams.get('key') || '';
    if (!key || key.includes('..') || !/^[a-zA-Z0-9/_.-]+$/.test(key)) {
      return new Response('Bad key', { status: 400, headers: corsHeaders });
    }
    const signed = await signGet(key);
    const res = await fetch(signed.url, { headers: signed.headers });
    if (!res.ok) {
      return new Response('Not found', { status: res.status, headers: corsHeaders });
    }
    return new Response(res.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': res.headers.get('content-type') || 'image/webp',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (e) {
    console.error('r2-image error', e);
    return new Response('Error', { status: 500, headers: corsHeaders });
  }
});
