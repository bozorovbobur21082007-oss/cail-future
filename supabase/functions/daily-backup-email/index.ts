// Daily backup email — sends warehouse data ZIP to configured email via Gmail connector
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BACKUP_TABLES = [
  "sectors",
  "shelves",
  "products",
  "product_placements",
  "workers",
  "operations",
  "app_settings",
];

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64Std(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Accept either: (1) admin JWT (manual trigger from UI), or
    // (2) shared cron token in x-cron-token header (pg_cron scheduled call).
    const cronToken = req.headers.get("x-cron-token");
    const expectedCronToken = Deno.env.get("BACKUP_CRON_TOKEN");
    const isCron = !!expectedCronToken && cronToken === expectedCronToken;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (!isCron) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const jwt = authHeader.replace("Bearer ", "");
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      if (roleErr || !isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }



    // Read settings
    const { data: settingsRows, error: sErr } = await supabase
      .from("app_settings")
      .select("key,value")
      .in("key", ["backup_enabled", "backup_email"]);
    if (sErr) throw sErr;

    const settings = new Map((settingsRows || []).map((r: any) => [r.key, r.value]));
    const enabled = settings.get("backup_enabled") === "true";
    const toEmail = (settings.get("backup_email") || "").trim();

    if (!enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "backup disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!toEmail) {
      return new Response(JSON.stringify({ skipped: true, reason: "no email configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build ZIP
    const tables: Record<string, any[]> = {};
    for (const t of BACKUP_TABLES) {
      const { data, error } = await supabase.from(t).select("*");
      if (error) throw new Error(`${t}: ${error.message}`);
      tables[t] = data || [];
    }
    const payload = {
      version: 1,
      created_at: new Date().toISOString(),
      tables,
    };
    const zip = new JSZip();
    zip.file("backup.json", JSON.stringify(payload, null, 2));
    for (const [name, rows] of Object.entries(tables)) {
      zip.file(`tables/${name}.json`, JSON.stringify(rows, null, 2));
    }
    const zipBytes: Uint8Array = await zip.generateAsync({ type: "uint8array" });
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const filename = `ombor-zaxira-${stamp}.zip`;

    // Compose MIME (multipart/mixed with attachment)
    const boundary = `----=_Part_${crypto.randomUUID()}`;
    const zipB64 = b64Std(zipBytes).replace(/(.{76})/g, "$1\r\n");

    const stats = Object.entries(tables).map(([k, v]) => `${k}: ${v.length}`).join("\n");
    const bodyText = `Aqlli Omborxona — kunlik avtomatik zaxira\n\nSana: ${new Date().toLocaleString("uz-UZ")}\n\nJadval yozuvlari:\n${stats}\n\nZIP fayl biriktirilgan.`;

    const mime =
      `To: ${toEmail}\r\n` +
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(`Aqlli Omborxona — zaxira ${stamp}`)))}?=\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/plain; charset="UTF-8"\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n` +
      `${btoa(unescape(encodeURIComponent(bodyText)))}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/zip; name="${filename}"\r\n` +
      `Content-Disposition: attachment; filename="${filename}"\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n` +
      `${zipB64}\r\n` +
      `--${boundary}--`;

    const raw = b64urlEncode(new TextEncoder().encode(mime));

    // Send via mail API gateway
    const MAIL_GATEWAY_URL = Deno.env.get("MAIL_GATEWAY_URL") ??
      "https://connector-gateway.lovable.dev/google_mail";
    const gmailRes = await fetch(
      `${MAIL_GATEWAY_URL}/gmail/v1/users/me/messages/send`,

      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
          "X-Connection-Api-Key": Deno.env.get("GOOGLE_MAIL_API_KEY")!,
        },
        body: JSON.stringify({ raw }),
      },
    );

    const gmailBody = await gmailRes.text();
    if (!gmailRes.ok) {
      console.error("Gmail send failed", gmailRes.status, gmailBody);
      return new Response(
        JSON.stringify({ error: "gmail_send_failed", status: gmailRes.status, detail: gmailBody }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ sent: true, to: toEmail, filename, size: zipBytes.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
