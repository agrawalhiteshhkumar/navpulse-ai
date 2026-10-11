export default async function handler(req, res) {
  // Enforce POST method
  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Method not allowed. Use POST.' });
  }

  const { query, language = 'en' } = req.body;

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Query parameter is required.' });
  }

  // 1. HARD DETERMINISTIC SAFETY GATE: Immediate Emergency Red-Flag Triage
  // Bypasses LLM entirely to prevent delay or hallucinated reassurance (V2 Spec Section 10)
  const emergencyPattern = /chest pain|कळ मारणे|हृदयविकार|heart attack|crushing pain|radiating to left arm|anaphylaxis|poison|suicide|विषबाधा|struggling to breathe|severe breathlessness/i;
  if (emergencyPattern.test(query)) {
    return res.status(200).json({
      is_emergency: true,
      risk_tier: 'TIER 4 : EMERGENCY',
      s_category: 'S3',
      drug_name: 'EMERGENCY RED FLAG DETECTED',
      schedule: 'Immediate Casualty Referral',
      direct_answer: language === 'mr' 
        ? 'आणीबाणी चेतावणी: ही लक्षणे गंभीर वैद्यकीय आणीबाणी दर्शवतात. तात्काळ आपत्कालीन वैद्यकीय मदत घ्या.'
        : 'CRITICAL EMERGENCY: Reported symptoms indicate an acute clinical emergency requiring immediate in-person casualty care.',
      administration: language === 'mr' 
        ? 'औषध समुपदेशन थांबवण्यात आले आहे. ताबडतोब रुग्णवाहिकेशी संपर्क साधा.'
        : 'Automated counselling suspended. Do not delay emergency evaluation.',
      precautions: language === 'mr' 
        ? 'रुग्णाला हालचाल करू देऊ नका आणि त्वरित वैद्यकीय मदत मिळेपर्यंत शांत ठेवा.'
        : 'Keep the patient calm and seated. Do not administer oral tablets unless instructed by emergency crew.',
      side_effects: 'N/A - Clinical Emergency',
      red_flags: language === 'mr' 
        ? 'छातीत तीव्र कळ, डाव्या हातात कळ, चक्कर, श्वास घेण्यास तीव्र अडचण.'
        : 'Severe crushing chest discomfort, pain radiating to left arm/jaw, diaphoresis, acute breathlessness.',
      referral: language === 'mr' 
        ? 'तातडीने १०८ वर कॉल करा किंवा जवळच्या अतिदक्षता विभागात (ICU/Casualty) जा.'
        : 'Call 108 Emergency Casualty immediately or proceed to the nearest emergency department.',
      referral_reason: language === 'mr'
        ? 'लक्षणे संभाव्य हृदयविकार किंवा तीव्र जीवघेणी स्थिती दर्शवतात.'
        : 'Reported symptoms are consistent with acute coronary syndrome or critical cardiopulmonary distress.',
      teach_back_question: language === 'mr' 
        ? 'तातडीची लक्षणे असताना प्रथम काय करावे?' 
        : 'What is the immediate required action during severe chest pain?',
      teach_back_options: language === 'mr' 
        ? ['तातडीने १०८ ला फोन करावा किंवा रुग्णालयात जावे', 'घरगुती काढा प्यावा', 'सकाळपर्यंत थांबावे']
        : ['Call 108 Emergency immediately or proceed to hospital', 'Wait until morning', 'Take an antacid and rest'],
      correct_option_index: 0,
      citation: 'National Emergency Clinical Triage Protocol'
    });
  }

  // 2. GOOGLE AI STUDIO CREDENTIAL CHECK
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ 
      error: 'GEMINI_API_KEY environment variable is not configured in Vercel settings.' 
    });
  }

  // 3. SYSTEM PROMPT: 7-Part Counselling Schema & Controlled Reasoning (V2 Spec Section 8)
  const systemInstruction = `You are the clinical counselling engine of NAVPULSE AI™, developed under academic research guidance.
You are NOT a prescribing doctor and NOT an autonomous medical decision-maker.
Your role: Provide structured, patient-friendly medication counselling adhering strictly to a 7-part schema.
Follow the "No Guessing Policy" (V2 Spec Section 7):
- If the medicine name, strength, or critical patient context is missing or ambiguous, state the limitation and ask for clarification.
- Never invent a dosage, maximum dose, or unverified administration rule.
- Do NOT make unsupported claims (never claim doubling metformin causes acute hypoglycemia; instead correctly explain GI disturbance, chronic risks, and safe missed-dose protocol).
- Classify the risk tier objectively:
  - TIER 1 : INFORMATION (Standard routine advice)
  - TIER 2 : CAUTION (Potential food/drug interaction, minor side effect, missing formulation context)
  - TIER 3 : URGENT (Significant clinical concern requiring same-day professional prescriber review)
  - TIER 4 : EMERGENCY (Acute red flags)

OUTPUT REQUIREMENTS:
You MUST respond ONLY with a single valid JSON object with these exact keys:
{
  "is_emergency": boolean,
  "risk_tier": "TIER 1 : INFORMATION" | "TIER 2 : CAUTION" | "TIER 3 : URGENT" | "TIER 4 : EMERGENCY",
  "s_category": "S0" | "S1" | "S2" | "S3",
  "drug_name": "Generic/Brand name identified with strength or 'Missing Details'",
  "schedule": "Schedule H / H1 / G / OTC / Controlled",
  "direct_answer": "Clear, direct 1-2 sentence core answer to the patient's inquiry",
  "administration": "How and when to take, food relationship, missed dose advice",
  "precautions": "Key safety precautions, what to avoid (alcohol, dairy chelation, etc.)",
  "side_effects": "Common, non-emergency side effects to monitor",
  "red_flags": "Warning signs requiring urgent medical discontinuation/review",
  "referral": "Appropriate doctor or pharmacist referral recommendation",
  "referral_reason": "Clear explanation of why this professional referral is recommended",
  "teach_back_question": "One practical multiple-choice question testing understanding of the key rule",
  "teach_back_options": ["Correct option", "Incorrect plausible option 1", "Incorrect plausible option 2"],
  "correct_option_index": 0,
  "citation": "Authoritative reference (e.g. NFI 2021 / IP / CDSCO Monograph)"
}
Respond in the language requested by the user: ${language === 'mr' ? 'Marathi (मराठी)' : 'English'}.`;

  try {
    // Calling production-grade Gemini 1.5 Flash at zero temperature
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemInstruction}\n\nPatient Query: "${query}"` }]
        }
      ],
      generationConfig: {
        temperature: 0.0,
        topK: 1,
        topP: 0.1,
        responseMimeType: "application/json"
      }
    };

    const apiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!apiResponse.ok) {
      const errBody = await apiResponse.text();
      return res.status(apiResponse.status).json({ 
        error: `Google Gemini API returned status ${apiResponse.status}`,
        details: errBody
      });
    }

    const data = await apiResponse.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return res.status(502).json({ error: 'Empty response returned by Google Gemini model.' });
    }

    // Clean any accidental markdown backticks before JSON parsing
    const cleanedJsonStr = candidateText.replace(/^```json/i, '').replace(/```$/i, '').trim();
    const parsedCounselling = JSON.parse(cleanedJsonStr);

    return res.status(200).json(parsedCounselling);

  } catch (err) {
    return res.status(500).json({ 
      error: 'Clinical reasoning engine error', 
      message: err.message 
    });
  }
}
