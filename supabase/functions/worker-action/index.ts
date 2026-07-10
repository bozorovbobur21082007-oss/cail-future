// Server-authoritative worker actions. Validates a signed worker session token
// (HMAC-SHA256 with WORKER_SESSION_SECRET) issued by verify-worker-pin, then
// performs a whitelisted mutation using the service role. This is what allows
// worker-mode users to write inventory data even though RLS forbids anon writes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

async function verifyWorkerToken(token: string, secret: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [h, p, sig] = parts;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const expected = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, enc.encode(`${h}.${p}`)),
    );
    if (b64url(expected) !== sig) return false;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
    if (payload.role !== 'worker') return false;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const token = typeof body?.token === 'string' ? body.token : '';
    const action = typeof body?.action === 'string' ? body.action : '';
    const secret = Deno.env.get('WORKER_SESSION_SECRET');
    if (!secret) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!token || !(await verifyWorkerToken(token, secret))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    if (action === 'record_operation') {
      const p = body.payload || {};
      const worker_id = typeof p.worker_id === 'string' ? p.worker_id : null;
      const product_id = typeof p.product_id === 'string' ? p.product_id : null;
      const worker_name = typeof p.worker_name === 'string' ? p.worker_name.slice(0, 200) : '';
      const product_name = typeof p.product_name === 'string' ? p.product_name.slice(0, 200) : '';
      const action_type = p.action_type === 'IN' || p.action_type === 'OUT' ? p.action_type : null;
      const quantity = Number.isInteger(p.quantity) && p.quantity > 0 && p.quantity < 100000 ? p.quantity : null;
      if (!product_id || !action_type || !quantity) {
        return new Response(JSON.stringify({ error: 'Invalid payload' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: prod, error: pErr } = await supabase
        .from('products').select('id, quantity').eq('id', product_id).maybeSingle();
      if (pErr || !prod) {
        return new Response(JSON.stringify({ error: 'Product not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const newQty = action_type === 'OUT' ? prod.quantity - quantity : prod.quantity + quantity;
      if (action_type === 'OUT' && newQty < 0) {
        return new Response(JSON.stringify({ error: 'Not enough stock' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { error: uErr } = await supabase
        .from('products').update({ quantity: newQty }).eq('id', product_id);
      if (uErr) throw uErr;
      const { data: op, error: oErr } = await supabase
        .from('operations').insert({
          worker_id, product_id, worker_name, product_name, action_type, quantity,
        }).select().single();
      if (oErr) throw oErr;
      return new Response(JSON.stringify({ ok: true, operation: op }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'create_product') {
      const p = body.payload || {};
      const name = typeof p.name === 'string' ? p.name.trim().slice(0, 200) : '';
      if (!name) {
        return new Response(JSON.stringify({ error: 'Name required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const insert: Record<string, unknown> = {
        name, quantity: 0, low_stock_threshold: 10, approved: false,
      };
      if (typeof p.product_code === 'string' && p.product_code.trim()) {
        insert.product_code = p.product_code.trim().toUpperCase().slice(0, 64);
      }
      const { data: dup } = await supabase
        .from('products').select('id').ilike('name', name).limit(1).maybeSingle();
      if (dup) {
        return new Response(JSON.stringify({ error: 'Duplicate name' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data, error } = await supabase
        .from('products').insert(insert).select('product_code, name').single();
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, product: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
