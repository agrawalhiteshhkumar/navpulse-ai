import fs from 'fs';
import path from 'path';

// Load static formulary knowledge safely
let formularyData = null;
try {
  const filePath = path.join(process.cwd(), 'lib', 'formulary.json');
  if (fs.existsSync(filePath)) {
    formularyData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
} catch (e) {
  console.warn('Formulary local cache load warning:', e.message);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { query, language = 'en' } = req.body || {};
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Query prompt is required.' });
  }

  const cleanQuery = query.trim();

  // GATE 1 & 2: EMERGENCY TRIAGE AND RISK ASSESSMENT
  const lowerQuery = cleanQuery.toLowerCase();
  let triageTier = 'TIER 1: INFORMATION';
  let triageColor = 'green';
  let emergencyHalt = false;

  const urgentKeywords = [
    'swelling of lips', 'hives', 'anaphylaxis', 'trouble breathing',
    'warfarin', 'bleeding', 'paracetamol 650mg together', 'overdose',
    'sildenafil', 'sorbitrate', 'isosorbide', 'chest pain', 'serotonin',
    'tramadol', 'fluoxetine', 'tremors', 'high fever and agitation'
  ];

  const cautionKeywords = [
    'stop amoxicillin', 'stop antibiotic', 'missed dose',
    'ciprofloxacin with milk', 'calcium', 'omeprazole', 'clopidogrel',
    'spironolactone', 'potassium', 'alcohol', 'zolpidem'
  ];

  if (urgentKeywords.some(kw => lowerQuery.includes(kw))) {
    triageTier = 'TIER 3: URGENT';
    triageColor = 'orange';
  } else if (cautionKeywords.some(kw => lowerQuery.includes(kw))) {
    triageTier = 'TIER 2: CAUTION';
    triageColor = 'yellow';
  }

  // GATE 3: FORMULARY LOOKUP
  let matchedMonograph = null;
  if (formularyData && formularyData.monographs) {
    for (const [key, monograph] of Object.entries(formularyData.monographs)) {
      if (cleanQuery.toLowerCase().includes(key.toLowerCase())) {
        matchedMonograph = monograph;
        break;
      }
    }
  }

  // API CREDENTIALS CHECK
  const API_KEY = (process.env.GEMINI_API_KEY || '').trim();
  if (!API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel.' });
  }

  // GATE 4: CONSTRAINED INFERENCE
  const prompt = `You are a clinical decision support system for pharmacists adhering to Good Pharmacy Practice (GPP) and the National Formulary of India (NFI).
Evaluate the following clinical scenario:
"${cleanQuery}"

Language requested: ${language}
Assigned Risk Tier: ${triageTier}
Formulary Data: ${matchedMonograph ? JSON.stringify(matchedMonograph) : 'General reference only'}

Return ONLY a valid JSON object matching this exact schema:
{
  "triage_tier": "${triageTier}",
  "risk_color": "${triageColor}",
  "clinical_assessment": "Direct clinical explanation grounded in GPP and pharmacology.",
  "pharmacist_action": "Actionable instructions for the dispensing pharmacist.",
  "patient_counsel": "Direct patient counselling points.",
  "teach_back": "One interactive verification question to confirm patient understanding.",
  "formulary_match": {
    "monograph_title": "${matchedMonograph ? matchedMonograph.monograph_title : 'Standard Formulary Clinical Review'}",
    "edition": "${matchedMonograph ? matchedMonograph.edition : 'NFI 6th Edition / IP 2022'}",
    "section": "${matchedMonograph ? matchedMonograph.section : 'Clinical Pharmacology Reference'}",
    "status": "${matchedMonograph ? 'Formulary Matched & Cross-Referenced' : 'Standard General Review'}"
  }
}
Output ONLY raw valid JSON without markdown formatting or code fences.`;

  // USE STABLE GEMINI 1.5 FLASH ENDPOINT (SUPPORTS BOTH AUTH HEADERS AND URL KEY PARAMS)
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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
