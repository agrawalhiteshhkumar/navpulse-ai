export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { query, language = 'en' } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Query is required.' });
  }

  // 1. Deterministic Emergency Red-Flag Triage
  const emergencyPattern = /chest pain|कळ मारणे|हृदयविकार|heart attack|crushing pain|radiating to left arm|anaphylaxis|poison|suicide|विषबाधा|struggling to breathe/i;
  if (emergencyPattern.test(query)) {
    return res.status(200).json({
      is_emergency: true,
      risk_tier: 'TIER 4 : EMERGENCY',
      drug_name: 'EMERGENCY RED FLAG DETECTED',
      schedule: 'Immediate Casualty Referral',
      direct_answer: language === 'mr' ? 'आणीबाणी चेतावणी: ही लक्षणे गंभीर वैद्यकीय आणीबाणी दर्शवतात. ताबडतोब १०८ वर कॉल करा.' : 'CRITICAL EMERGENCY: Reported symptoms indicate an acute clinical emergency.',
      administration: 'Automated counselling suspended.',
      precautions: 'Do not delay emergency evaluation.',
      side_effects: 'N/A',
      red_flags: 'Severe chest discomfort, acute dyspnoea.',
      referral: 'Call 108 Emergency Casualty immediately.',
      referral_reason: 'Potential acute coronary syndrome or critical cardiopulmonary distress.',
      citation: 'National Emergency Clinical Triage Protocol'
    });
  }

  const API_KEY = (process.env.GEMINI_API_KEY || '').trim();
  if (!API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel.' });
  }

  // 2. Call Google Gemini API with Dual Auth (Bearer Token for AQ. / Query Param for AIza)
  try {
    const prompt = `You are NAVPULSE AI™, a clinical medication counselling assistant.
Patient Query: "${query}"
Language: ${language === 'mr' ? 'Marathi' : 'English'}

Provide evidence-grounded medication counselling in JSON format with these exact keys:
{
  "is_emergency": false,
  "risk_tier": "TIER 1 : INFORMATION" or "TIER 2 : CAUTION" or "TIER 3 : URGENT",
  "drug_name": "Identified drug(s) with strength and dosage form",
  "schedule": "Schedule H / Prescribed",
  "direct_answer": "Clear, direct 1-2 sentence core answer",
  "administration": "How and when to take, bedtime/morning timing, food relationship",
  "precautions": "Important safety precautions, sedative precautions, dizziness warnings",
  "side_effects": "Common side effects (morning drowsiness, dry mouth, etc.)",
  "red_flags": "Warning signs requiring immediate prescriber contact",
  "referral": "Doctor or pharmacist referral advice",
  "referral_reason": "Why professional review is advised",
  "teach_back_question": "One practical question testing understanding",
  "teach_back_options": ["Correct option", "Incorrect option 1", "Incorrect option 2"],
  "correct_option_index": 0,
  "citation": "Indian Pharmacopoeia (IP) / NFI Reference"
}
Output ONLY valid JSON.`;

    const isBearer = API_KEY.startsWith('AQ.');
    const endpoint = isBearer
      ? 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'
      : `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    const headers = { 'Content-Type': 'application/json' };
    if (isBearer) {
      headers['Authorization'] = `Bearer ${API_KEY}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'Gemini API call failed', details: errText });
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const cleanedJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanedJson);

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
