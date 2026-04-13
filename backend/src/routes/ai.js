import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';

const router = Router();

async function callAnthropic(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

router.post('/pricing', authenticate, async (req, res) => {
  const { title, category, condition } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const text = await callAnthropic(
    `Marketplace pricing expert. Item: "${title}" (${category||'general'}, ${condition||'unknown'}). Reply ONLY with JSON no markdown: {"start":integer,"fair":integer,"buyNow":integer,"note":"one sentence","confidence":"low|medium|high"}`
  );
  if (!text) return res.json({ start: 25, fair: 75, buyNow: 100, note: 'Add ANTHROPIC_API_KEY to .env for real AI pricing.', confidence: 'low' });
  try { res.json(JSON.parse(text.replace(/```json|```/g,'').trim())); }
  catch { res.json({ start: 25, fair: 75, buyNow: 100, note: text.slice(0,120), confidence: 'low' }); }
});

router.post('/description', authenticate, async (req, res) => {
  const { prompt, title, category, condition } = req.body;
  const input = prompt || `${title} - ${category} - ${condition}`;
  const text  = await callAnthropic(`Expert auction copywriter. 2-3 sentence description for: "${input}". Specific, honest, compelling. Plain text only.`);
  res.json({ description: text || `${title} in ${condition} condition. Great item for any collector. Don't miss out on this one!` });
});

router.post('/show-script', authenticate, async (req, res) => {
  const { itemTitle, startingBid, category } = req.body;
  const text = await callAnthropic(`Live auction host. 2-3 sentence energetic intro for: "${itemTitle}" (${category}) starting at $${startingBid}. Plain text only.`);
  res.json({ script: text || `Alright folks, here we go! Up next we have the amazing ${itemTitle} — starting at just $${startingBid}! Who wants to kick things off?` });
});

export default router;
