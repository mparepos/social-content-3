import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

function readSource(filename) {
  const filepath = path.join(process.cwd(), filename);
  return fs.existsSync(filepath) ? fs.readFileSync(filepath, 'utf-8') : '';
}

const sources = {
  company:  readSource('company_summary.md'),
  brand:    readSource('brand_guidelines.md'),
  linkedin: readSource('linkedin_posts.md'),
  facebook: readSource('facebook_posts.md'),
  blogs:    readSource('blog_posts.md'),
};

const client = new Anthropic();

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

  const systemPrompt = `You are a senior content strategist and copywriter for A-Z Services LLC. You have full knowledge of the company, its brand guidelines, and its entire content history. Your job is to generate fresh, original content that fits seamlessly with what has already been published.

--- COMPANY SUMMARY ---
${sources.company}

--- BRAND GUIDELINES ---
${sources.brand}

--- HISTORICAL LINKEDIN POSTS (study tone, length, structure) ---
${sources.linkedin}

--- HISTORICAL FACEBOOK POSTS (study tone, length, emojis, structure) ---
${sources.facebook}

--- HISTORICAL BLOG POSTS (study depth, headings, voice, CTAs) ---
${sources.blogs}`;

  const userPrompt = `Generate a completely fresh set of content for A-Z Services LLC. Choose angles, topics, and hooks that have NOT been used in the historical posts above.

You MUST respond using EXACTLY this format with these exact markers on their own lines. No extra text before [BLOG_IDEA] or after the final [/FACEBOOK_POST]:

[BLOG_IDEA]
Describe the fresh blog post idea in 2-3 sentences. Include the proposed title in quotes and explain what unique angle or insight makes this post compelling and different from the historical posts.
[/BLOG_IDEA]

[LINKEDIN_IDEA]
Describe the fresh LinkedIn post idea in 1-2 sentences. Include what makes it timely, thought-provoking, or useful to a professional audience.
[/LINKEDIN_IDEA]

[FACEBOOK_IDEA]
Describe the fresh Facebook post idea in 1-2 sentences. Include the community or emotional hook that will drive engagement.
[/FACEBOOK_IDEA]

[BLOG_POST]
Write the complete blog post. It must be 700-900 words, include a compelling headline, 3-5 subheadings using ##, body paragraphs, and a CTA paragraph at the end. Match the voice from the historical blog posts exactly: professional, empathetic, direct, value-first, no jargon. End with the standard italicized company tagline.
[/BLOG_POST]

[LINKEDIN_POST]
Write the complete LinkedIn post. It must be 150-300 words, match the professional thought-leadership tone of the historical LinkedIn posts exactly. May include a numbered list or key points. End with a single subtle CTA sentence. Include 4-6 relevant hashtags on a final line.
[/LINKEDIN_POST]

[FACEBOOK_POST]
Write the complete Facebook post. It must be 150-250 words, match the warm, conversational, community-oriented tone of the historical Facebook posts exactly. Use emojis where appropriate (same density as historical posts). End with a question or engagement CTA. Include 3-5 relevant hashtags on a final line.
[/FACEBOOK_POST]`;

  try {
    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        send({ type: 'text', text: event.delta.text });
      }
    }

    send({ type: 'done' });
  } catch (err) {
    send({ type: 'error', message: err.message });
  } finally {
    res.end();
  }
}
