import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ExtractedCertificate } from '@/lib/types';

// POST { imagePath: "<uid>/<file>.jpg" }
// Reads a kosher certificate photo that the user already uploaded to the
// 'certificates' bucket and returns structured fields for them to review.
// Nothing is saved here: the user confirms the fields, then the client
// calls propose_kosher_claim().

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY
const MODEL = 'claude-sonnet-5-5';
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedType = (typeof ALLOWED)[number];

const TOOL: Anthropic.Tool = {
  name: 'record_certificate',
  description: 'Record the fields read from a photo of an Israeli kosher certificate (תעודת כשרות).',
  input_schema: {
    type: 'object',
    properties: {
      is_kosher_certificate: { type: 'boolean', description: 'False if the photo is not a kosher certificate.' },
      business_name: { type: ['string', 'null'], description: 'Business name as printed, in Hebrew.' },
      supervising_body: {
        type: ['string', 'null'],
        description: 'Issuing body, e.g. "הרבנות הראשית רמת גן", "בד״ץ העדה החרדית", "כשרות צהר".',
      },
      level: {
        type: 'string',
        enum: ['rabanut', 'mehadrin', 'badatz', 'pikuach', 'unknown'],
        description:
          'rabanut = regular rabbinate certificate; mehadrin = rabbinate mehadrin; badatz = any בד״ץ; ' +
          'pikuach = supervision that is explicitly NOT a rabbinate certificate (e.g. Tzohar, private supervision).',
      },
      valid_until: {
        type: ['string', 'null'],
        description:
          'Expiry date as YYYY-MM-DD (Gregorian). If only a Hebrew date is printed (e.g. "עד כ״ט אדר תשפ״ז"), convert it.',
      },
      confidence: { type: 'number', minimum: 0, maximum: 1, description: 'Overall confidence in the extracted fields.' },
      issues: {
        type: 'array',
        items: { type: 'string' },
        description: 'Short notes in Hebrew about anything unclear, e.g. "התאריך מטושטש", "שם העסק חתוך בתמונה".',
      },
    },
    required: ['is_kosher_certificate', 'business_name', 'supervising_body', 'level', 'valid_until', 'confidence', 'issues'],
  },
};

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: 'צריך להתחבר' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { imagePath?: string } | null;
  const imagePath = body?.imagePath;
  if (!imagePath || imagePath.split('/')[0] !== auth.user.id) {
    return NextResponse.json({ error: 'נתיב תמונה לא תקין' }, { status: 400 });
  }

  // 20 reads per user per hour (log_extraction in 0002_app.sql)
  const { data: allowed, error: limitError } = await sb.rpc('log_extraction');
  if (limitError) return NextResponse.json({ error: 'משהו השתבש. נסו שוב.' }, { status: 500 });
  if (!allowed) {
    return NextResponse.json({ error: 'הגעתם למגבלה של 20 תעודות בשעה. אפשר למלא את הפרטים ידנית.' }, { status: 429 });
  }

  const { data: blob, error } = await sb.storage.from('certificates').download(imagePath);
  if (error || !blob) return NextResponse.json({ error: 'לא מצאנו את התמונה' }, { status: 404 });
  if (!ALLOWED.includes(blob.type as AllowedType)) {
    return NextResponse.json({ error: 'אפשר להעלות JPG, PNG או WEBP' }, { status: 415 });
  }
  if (blob.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'התמונה גדולה מ-5MB' }, { status: 413 });
  }

  const data = Buffer.from(await blob.arrayBuffer()).toString('base64');
  const today = new Date().toISOString().slice(0, 10);

  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: blob.type as AllowedType, data } },
            {
              type: 'text',
              text:
                `Today is ${today}. Read this photo of a kosher certificate and record its fields. ` +
                'Copy Hebrew text exactly as printed. If a field is not visible, use null and add a note to issues. ' +
                'Do not guess an expiry date you cannot read.',
            },
          ],
        },
      ],
    });

    const block = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!block) throw new Error('no tool_use block');
    const r = block.input as Record<string, unknown>;

    const validUntil =
      typeof r.valid_until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.valid_until) ? r.valid_until : null;

    const result: ExtractedCertificate = {
      isKosherCertificate: r.is_kosher_certificate === true,
      businessName: typeof r.business_name === 'string' ? r.business_name : null,
      supervisingBody: typeof r.supervising_body === 'string' ? r.supervising_body : null,
      level: (['rabanut', 'mehadrin', 'badatz', 'pikuach'] as const).find((l) => l === r.level) ?? 'unknown',
      validUntil,
      confidence: typeof r.confidence === 'number' ? Math.min(1, Math.max(0, r.confidence)) : 0,
      issues: Array.isArray(r.issues) ? r.issues.filter((s): s is string => typeof s === 'string') : [],
    };
    if (validUntil && validUntil < today) result.issues.push('לפי התאריך, התעודה כבר פגה');

    return NextResponse.json(result);
  } catch (e) {
    console.error('extract-certificate failed', e);
    return NextResponse.json({ error: 'לא הצלחנו לקרוא את התעודה. אפשר למלא את הפרטים ידנית.' }, { status: 502 });
  }
}
