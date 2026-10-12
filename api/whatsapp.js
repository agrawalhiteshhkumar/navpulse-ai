module.exports = async function handler(req, res) {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'NAVPULSE_SECURE_TOKEN_2026';
  const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

  // 1. Meta Webhook Verification (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ error: 'Verification token mismatch' });
  }

  // 2. Incoming WhatsApp Message Processing (POST)
  if (req.method === 'POST') {
    try {
      const body = req.body;
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];

      if (!message || message.type !== 'text') {
        return res.status(200).send('EVENT_RECEIVED');
      }

      const fromNumber = message.from;
      const userText = message.text.body;

      const isMarathi = /[\u0900-\u097F]/.test(userText);
      const language = isMarathi ? 'mr' : 'en';

      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'https://navpulse-ai.vercel.app';

      const counselResponse = await fetch(`${baseUrl}/api/counsel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userText, language: language })
      });

      const data = await counselResponse.json();

      let replyMessage = '';
      if (data.is_emergency || data.risk_color === 'red') {
        replyMessage = `🚨 *NAVPULSE AI™ EMERGENCY ALERT* 🚨\n\n` +
          `*Risk:* ${data.risk_tier}\n` +
          `*Urgent Action:* ${data.direct_answer}\n\n` +
          `⚠️ *Red Flags:* ${data.red_flags}\n` +
          `🚑 *Emergency:* Dial 108 immediately or visit the nearest casualty.\n\n` +
          `_Developed by students of Navjeevan Education Society's D. P. Kharde Navjeevan College of Pharmacy._`;
      } else {
        replyMessage = `🏥 *NAVPULSE AI™ Clinical Guidance*\n` +
          `*Medicine:* ${data.drug_name || 'Medication Review'}\n` +
          `*Safety Tier:* ${data.risk_tier || 'TIER 1 : INFORMATION'}\n\n` +
          `*1. Advice:* ${data.direct_answer}\n` +
          `*2. Timing:* ${data.administration}\n` +
          `*3. Precautions:* ${data.precautions}\n` +
          `*4. Side Effects:* ${data.side_effects}\n` +
          `*5. Warning Signs:* ${data.red_flags}\n` +
          `*6. Referral:* ${data.referral} (${data.referral_reason})\n\n` +
          `📚 *Evidence:* ${data.evidence_monograph?.source || 'NFI 6th Ed / IP 2022'}\n\n` +
          `_Decision support under registered pharmacist oversight._\n` +
          `_Navjeevan Education Society’s D. P. Kharde Navjeevan College of Pharmacy._`;
      }

      if (ACCESS_TOKEN && PHONE_NUMBER_ID) {
        await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: fromNumber,
            type: 'text',
            text: { preview_url: false, body: replyMessage }
          })
        });
      }

      return res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
      console.error('WhatsApp Webhook Error:', err);
      return res.status(200).send('EVENT_RECEIVED');
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
};
