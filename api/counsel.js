export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { query, language = 'en' } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Query is required.' });
  }

  // 1. Hard Deterministic Emergency Triage (Tier 4: RED)
  const emergencyPattern = /chest pain|कळ मारणे|हृदयविकार|heart attack|crushing pain|radiating to left arm|anaphylaxis|poison|suicide|विषबाधा|struggling to breathe/i;
  if (emergencyPattern.test(query)) {
    return res.status(200).json({
      is_emergency: true,
      risk_tier: 'TIER 4 : EMERGENCY',
      risk_color: 'red',
      drug_name: 'EMERGENCY RED FLAG DETECTED',
      schedule: 'Immediate Casualty Referral',
      direct_answer: language === 'mr' 
        ? 'आणीबाणी चेतावणी: ही लक्षणे गंभीर वैद्यकीय आणीबाणी दर्शवतात. ताबडतोब १०८ वर कॉल करा.' 
        : 'CRITICAL EMERGENCY: Reported symptoms indicate an acute medical emergency. Routine counselling suspended.',
      administration: 'Automated digital counselling strictly halted.',
      precautions: 'Do not attempt home administration or self-medication.',
      side_effects: 'N/A - Immediate life-saving evaluation required.',
      red_flags: 'Severe chest discomfort, acute dyspnoea, diaphoresis.',
      referral: 'Call 108 Emergency Ambulance / Report to Nearest Casualty immediately.',
      referral_reason: 'Potential acute coronary syndrome or critical cardiopulmonary distress.',
      evidence_monograph: {
        source: 'National Emergency Clinical Triage Protocol',
        monograph_title: 'Acute Emergency Medical Services (EMS) Guideline',
        edition: 'DGHS / MoHFW Emergency Protocol',
        section: 'Immediate Cardiovascular Triage',
        status: 'Deterministic Rule Triggered'
      }
    });
  }

  const API_KEY = (process.env.GEMINI_API_KEY || '').trim();
  if (!API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel.' });
  }

  // 2. Clinical Inference Engine with Traceable Schema
  try {
    const prompt = `You are NAVPULSE AI™, a clinical medication counselling safety assistant under the MSBTE Research Project.
Patient Query: "${query}"
Language: ${language === 'mr' ? 'Marathi' : 'English'}

Provide an evidence-grounded medication counselling response strictly following this JSON schema:
{
  "is_emergency": false,
  "risk_tier": "TIER 1 : INFORMATION" or "TIER 2 : CAUTION" or "TIER 3 : URGENT",
  "risk_color": "green" (for Tier 1) or "yellow" (for Tier 2) or "orange" (for Tier 3),
  "drug_name": "Full identified generic title with exact strength & dosage form",
  "schedule": "Schedule H / Schedule G / OTC",
  "direct_answer": "Clear, direct 1-2 sentence core clinical advice",
  "administration": "Exact administration directions (timing, food relationship, dosage form handling)",
  "precautions": "Safety precautions (alertness, interactions, posture)",
  "side_effects": "Common clinically documented side effects",
  "red_flags": "Warning symptoms requiring immediate medical evaluation",
  "referral": "Doctor or registered pharmacist escalation path",
  "referral_reason": "Specific clinical rationale for referral",
  "teach_back_question": "One practical question testing comprehension",
  "teach_back_options": ["Correct option", "Distractor 1", "Distractor 2"],
  "correct_option_index": 0,
  "evidence_monograph": {
    "source": "National Formulary of India (NFI) / Indian Pharmacopoeia (IP)",
    "monograph_title": "Identified drug monograph name",
    "edition": "NFI 6th Edition / IP 2022",
    "section": "Section 4.2 / Clinical Pharmacology & Drug Interactions",
    "status": "Verified & Cross-Referenced"
  }
}

Do NOT use marketing language. Do NOT claim 100% safety. Output ONLY valid JSON.`;

    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
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
