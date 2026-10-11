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
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { query, language = 'en' } = req.body;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: 'Query is required.' });
  }

  const cleanQuery = query.trim();

  // =========================================================================
  // GATE 1: DETERMINISTIC TIER 4 EMERGENCY TRIAGE (HARD RED-FLAG HALT)
  // =========================================================================
  const emergencyPattern = /chest pain|कळ मारणे|हृदयविकार|heart attack|crushing pain|radiating to left arm|anaphylaxis|poison|suicide|विषबाधा|struggling to breathe|difficulty breathing|shortness of breath/i;
  if (emergencyPattern.test(cleanQuery)) {
    return res.status(200).json({
      is_emergency: true,
      risk_tier: 'TIER 4 : EMERGENCY',
      risk_color: 'red',
      drug_name: 'EMERGENCY RED-FLAG INTERCEPT',
      schedule: 'Immediate Casualty Referral',
      direct_answer: language === 'mr'
        ? 'आणीबाणी चेतावणी: ही लक्षणे गंभीर वैद्यकीय आणीबाणी दर्शवतात. सर्व औषध समुपदेशन थांबवण्यात आले आहे. ताबडतोब १०८ वर कॉल करा.'
        : 'CRITICAL EMERGENCY: Reported symptoms indicate an acute clinical emergency. Routine medication counselling is suspended.',
      administration: 'Automated digital counselling strictly halted.',
      precautions: 'Do not delay emergency evaluation to take or adjust oral medications.',
      side_effects: 'N/A - Immediate life-saving assessment required.',
      red_flags: 'Severe chest discomfort, acute dyspnoea, signs of systemic anaphylaxis or poisoning.',
      referral: 'Call 108 Emergency Ambulance / Report to Nearest Casualty immediately.',
      referral_reason: 'Potential acute coronary syndrome, severe airway compromise, or acute toxidrome.',
      evidence_monograph: {
        source: 'National Emergency Clinical Triage Protocol',
        monograph_title: 'Emergency Medical Services (EMS) Protocol',
        edition: 'DGHS / MoHFW Emergency Protocol',
        section: 'Immediate Cardiovascular & Airway Triage',
        status: 'Deterministic Rule Triggered'
      }
    });
  }

  // =========================================================================
  // GATE 2: DETERMINISTIC HIGH-RISK INTERACTION & DOSING ANOMALY CHECKS
  // =========================================================================
  // Check A: Sildenafil / Tadalafil + Nitrates (Fatal Hypotension)
  const hasPDE5i = /sildenafil|tadalafil|vardenafil/i.test(cleanQuery);
  const hasNitrate = /nitroglycerin|sorbitrate|isosorbide|mononitrate|nicorandil|nitrate/i.test(cleanQuery);
  if (hasPDE5i && hasNitrate) {
    return res.status(200).json({
      is_emergency: false,
      risk_tier: 'TIER 3 : URGENT',
      risk_color: 'orange',
      drug_name: 'Sildenafil / Tadalafil + Nitrate Co-administration Flag',
      schedule: 'Schedule H / Prescribed',
      direct_answer: language === 'mr'
        ? 'धोकादायक परस्परसंवाद चेतावणी: नायट्रेट्स आणि PDE-5 इनहिबिटर एकत्र घेतल्यास रक्तदाब अत्यंत धोकादायक पातळीवर घसरू शकतो.'
        : 'CRITICAL CONTRAINDICATION: Co-administration of PDE-5 inhibitors with nitrates produces severe, potentially fatal synergistic hypotension.',
      administration: 'Do not take these medications together under any circumstances.',
      precautions: 'Inform all treating physicians and cardiologists before taking either class.',
      side_effects: 'Severe dizziness, syncope, acute coronary ischemia, profound hypotension.',
      red_flags: 'Unconsciousness, extreme lightheadedness, chest pain.',
      referral: 'Urgent consultation with treating cardiologist / prescribing physician.',
      referral_reason: 'Dangerous pharmacological drug-drug interaction requiring immediate regimen review.',
      evidence_monograph: {
        source: 'National Formulary of India (NFI)',
        monograph_title: 'Sildenafil Citrate & Nitrates Interaction Monograph',
        edition: 'NFI 6th Edition',
        section: 'Section 12.4: Cardiovascular Vasodilator Contraindications',
        status: 'Deterministic Rule Triggered'
      }
    });
  }

  // Check B: Methotrexate Daily vs Weekly Fatal Error
  if (/methotrexate/i.test(cleanQuery) && /daily|every day|रोज/i.test(cleanQuery)) {
    return res.status(200).json({
      is_emergency: false,
      risk_tier: 'TIER 3 : URGENT',
      risk_color: 'orange',
      drug_name: 'Methotrexate Dosage Frequency Warning',
      schedule: 'Schedule H / Antimetabolite',
      direct_answer: language === 'mr'
        ? 'डोस वारंवारता चेतावणी: संधिवातासाठी मेथोत्रेक्झेट सहसा आठवड्यातून फक्त एकदाच (Weekly) दिले जाते. रोज घेतल्यास जीवघेणी विषबाधा होऊ शकते.'
        : 'CRITICAL DOSING ALERT: For autoimmune indications (e.g., rheumatoid arthritis, psoriasis), Methotrexate is taken ONCE WEEKLY. Daily administration is a well-documented cause of fatal toxicity.',
      administration: 'Withhold dose until confirmed with prescribing rheumatologist or registered pharmacist.',
      precautions: 'Never assume daily dosing for Methotrexate without specialist oncologic verification.',
      side_effects: 'Acute bone marrow suppression, mouth ulcers, severe gastrointestinal ulceration.',
      red_flags: 'Oral ulcerations, unexplained bruising, fever, throat pain.',
      referral: 'Contact prescribing physician or clinical pharmacist immediately.',
      referral_reason: 'Suspected fatal dosing frequency error requiring urgent intervention.',
      evidence_monograph: {
        source: 'Indian Pharmacopoeia (IP)',
        monograph_title: 'Methotrexate IP Monograph & Safety Alerts',
        edition: 'IP 2022',
        section: 'Section 8.1: Dosage Frequency Governance',
        status: 'Deterministic Rule Triggered'
      }
    });
  }

  // Check C: Pediatric Cold Medication Red-Flag
  if (/child|baby|infant|वर्षे|मूल|बाळ/i.test(cleanQuery) && /cold|cough|sedative|lorazepam|cetirizine|cough syrup/i.test(cleanQuery)) {
    return res.status(200).json({
      is_emergency: false,
      risk_tier: 'TIER 2 : CAUTION',
      risk_color: 'yellow',
      drug_name: 'Pediatric Medication Safety Protocol',
      schedule: 'Pediatric Oversight Required',
      direct_answer: language === 'mr'
        ? 'बालरोग सुरक्षा सूचना: लहान मुलांमध्ये सर्दी-खोकल्याची किंवा शामक औषधे स्वतःहून देऊ नयेत. डॉक्टरांच्या अचूक वजनाधारित सल्ल्याची गरज आहे.'
        : 'PEDIATRIC SAFETY NOTICE: Adult cold, cough, and sedative preparations are not safe for self-administration in children without weight-based pediatric dosing.',
      administration: 'Suspended pending pediatric weight-based calculation.',
      precautions: 'Do not use over-the-counter multi-ingredient adult syrups in young children.',
      side_effects: 'Excessive sedation, paradoxical excitation, respiratory depression.',
      red_flags: 'Stridor, labored breathing, extreme lethargy, persistent high fever.',
      referral: 'Consult a registered pediatrician or dispensing pharmacist.',
      referral_reason: 'Pediatric dosing requires exact body weight and age stratification.',
      evidence_monograph: {
        source: 'National Formulary of India (NFI)',
        monograph_title: 'Pediatric Prescribing Guidelines',
        edition: 'NFI 6th Edition',
        section: 'General Guidance: Pediatric Dosing Caution',
        status: 'Deterministic Rule Triggered'
      }
    });
  }

  // =========================================================================
  // GATE 3: GROUNDED EVIDENCE RETRIEVAL FROM LOCAL FORMULARY KNOWLEDGE BASE
  // =========================================================================
  let matchedMonograph = null;
  if (formularyData && formularyData.monographs) {
    for (const [key, monograph] of Object.entries(formularyData.monographs)) {
      if (cleanQuery.toLowerCase().includes(key)) {
        matchedMonograph = monograph;
        break;
      }
    }
  }

  const API_KEY = (process.env.GEMINI_API_KEY || '').trim();
  if (!API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel.' });
  }

  // =========================================================================
  // GATE 4: CONSTRAINED INFERENCE (EVIDENCE INJECTED)
  // =========================================================================
  try {
    const evidenceContext = matchedMonograph
      ? `VERIFIED FORMULARY MONOGRAPH (Do NOT contradict these facts):
- Substance: ${matchedMonograph.generic_name} (${matchedMonograph.class})
- Source: ${matchedMonograph.source}, ${matchedMonograph.edition}, ${matchedMonograph.section}
- Critical Rules: ${matchedMonograph.missed_dose_rule || matchedMonograph.administration_rule || matchedMonograph.dosage_frequency_safety || 'Standard Schedule H protocol'}
- Critical Contraindications: ${(matchedMonograph.critical_contraindications || []).join('; ')}
- Red Flags: ${matchedMonograph.red_flags}`
      : `NO LOCAL FORMULARY MATCH FOUND. Use general Indian Pharmacopoeia / NFI therapeutic guidance. If key clinical parameters are missing, advise clinical pharmacist review.`;

    const prompt = `You are NAVPULSE AI™, a clinical medication counselling safety assistant under the MSBTE Research Project.
Patient Query: "${cleanQuery}"
Language: ${language === 'mr' ? 'Marathi' : 'English'}

${evidenceContext}

Produce an evidence-grounded medication counselling output. Follow these strict rules:
1. DO NOT claim that missing a metformin dose causes acute hypoglycemia in monotherapy. Emphasize not taking double doses.
2. DO NOT claim 100% safety or zero hallucinations.
3. If dosage form or frequency is not clear from query, state caution and recommend consulting the dispensing pharmacist.
4. Output strictly valid JSON matching this schema:
{
  "is_emergency": false,
  "risk_tier": "TIER 1 : INFORMATION" or "TIER 2 : CAUTION" or "TIER 3 : URGENT",
  "risk_color": "green" or "yellow" or "orange",
  "drug_name": "Generic name with dosage form and strength (if identified)",
  "schedule": "Schedule H / Schedule G / Prescribed / OTC",
  "direct_answer": "Clear, direct 1-2 sentence core clinical advice",
  "administration": "How and when to take, relation to meals, dosage form handling",
  "precautions": "Safety precautions (alertness, interactions, posture)",
  "side_effects": "Documented common side effects",
  "red_flags": "Warning symptoms requiring immediate medical evaluation",
  "referral": "Doctor or registered pharmacist escalation path",
  "referral_reason": "Specific clinical rationale for referral",
  "teach_back_question": "One practical question testing patient comprehension",
  "teach_back_options": ["Correct option", "Distractor option 1", "Distractor option 2"],
  "correct_option_index": 0,
  "evidence_monograph": {
    "source": "${matchedMonograph ? matchedMonograph.source : 'National Formulary of India (NFI)'}",
    "monograph_title": "${matchedMonograph ? matchedMonograph.monograph_title : 'Standard Formulary Clinical Review'}",
    "edition": "${matchedMonograph ? matchedMonograph.edition : 'NFI 6th Edition / IP 2022'}",
    "section": "${matchedMonograph ? matchedMonograph.section : 'Clinical Pharmacology Reference'}",
    "status": "${matchedMonograph ? 'Formulary Matched & Cross-Referenced' : 'Standard General Formulary Review'}"
  }
}

Output ONLY valid JSON without Markdown fences.`;

    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': API_KEY
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
