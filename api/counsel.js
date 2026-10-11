export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { query, language = 'en' } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter.' });
  }

  // 1. DETERMINISTIC SAFETY GATE: Immediate Emergency Red Flags
  const EMERGENCY_REGEX = /chest pain|heart attack|कळ मारणे|छातीत दुखणे|breathing difficulty|दम लागणे|anaphylaxis|poison|विषबाधा|overdose|suicide/i;
  if (EMERGENCY_REGEX.test(query)) {
    return res.status(200).json({
      triage_level: 'RED',
      is_emergency: true,
      direct_answer: language === 'mr' 
        ? 'आणीबाणी इशारा: तीव्र छातीत वेदना किंवा श्वास घेण्यास अडचण ही गंभीर वैद्यकीय आणीबाणी असू शकते. सामान्य औषध समुपदेशन तात्काळ थांबवले आहे.'
        : 'EMERGENCY RED FLAG: Severe chest pain or respiratory distress indicates a potential life-threatening emergency. Normal counseling is suspended.',
      action_required: 'Immediate emergency transfer to Casualty / 108 Ambulance.'
    });
  }

  // 2. CALL GOOGLE AI STUDIO (GEMINI 2.5 FLASH)
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured.' });
  }

  const SYSTEM_INSTRUCTION = `
You are NAVPULSE AI™, an evidence-grounded medication counselling assistant developed by Navjeevan Education Society's D. P. Kharde Navjeevan College of Pharmacy and Bright Path.
REGULATORY COMPLIANCE:
- You must strictly comply with Section 42 of the Pharmacy Act, 1948 and the Drugs & Cosmetics Act, 1940.
- NEVER independently prescribe, diagnose, or modify dosages of Schedule H, H1, or X medications.
- Answer in the selected language: ${language === 'mr' ? 'Marathi' : 'English'}.
OUTPUT FORMAT: Return raw JSON conforming strictly to:
{
  "drug_name": "Identified drug or inquiry",
  "schedule": "Regulatory classification",
  "direct_answer": "1. Direct concise advice",
  "administration": "2. How/when to take and food relationship",
  "precautions": "3. Critical cautions and interactions",
  "side_effects": "4. Common self-limiting effects",
  "red_flags": "5. Emergency warning signs",
  "referral": "6. When to consult RPh or Doctor",
  "teach_back_question": "7. Single comprehension question",
  "teach_back_options": ["Option A", "Option B", "Option C"],
  "correct_option_index": 0,
  "citation": "Authoritative Indian Pharmacopoeia / NFI monograph citation"
}
`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: query }] }],
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        generationConfig: {
          temperature: 0.0,
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const structuredResult = JSON.parse(rawText);

    return res.status(200).json({
      triage_level: 'GREEN',
      is_emergency: false,
      ...structuredResult
    });
  } catch (error) {
    return res.status(500).json({ error: 'Inference failure: ' + error.message });
  }
}
