// ============================================================================
//  CAREER NAVIGATOR — BACKEND (funkcja serverless dla Vercel)
//  Tu mieszka Twój klucz API. Klient NIGDY go nie widzi.
//
//  Aby zmienić model AI — zmień JEDNĄ linijkę poniżej (MODEL).
//    Opus 4.7 (najmocniejszy) : 'claude-opus-4-7'
//    Sonnet 4.6 (taniej)      : 'claude-sonnet-4-6'
//    Haiku 4.5 (najtaniej)    : 'claude-haiku-4-5-20251001'
// ============================================================================

const MODEL = 'claude-opus-4-7';

export default async function handler(req, res) {
  // --- Zezwól tylko na metodę POST ---
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Tylko POST.' });
  }

  // --- Klucz pobierany z bezpiecznej zmiennej środowiskowej (NIE z kodu) ---
  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'Brak klucza API w konfiguracji serwera.' });
  }

  // --- Odbierz prompt od frontendu ---
  let prompt, maxTokens;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    prompt = body.prompt;
    maxTokens = body.max_tokens || 2000;
  } catch (e) {
    return res.status(400).json({ error: 'Nieprawidłowe dane wejściowe.' });
  }
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Brak treści zapytania (prompt).' });
  }

  // --- Wywołaj API Claude (klucz dokładany TUTAJ, po stronie serwera) ---
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await r.json();

    if (!r.ok) {
      const msg = (data && data.error && data.error.message) ? data.error.message : ('HTTP ' + r.status);
      return res.status(r.status).json({ error: 'Błąd API: ' + msg });
    }

    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: 'Błąd połączenia z AI: ' + (e.message || 'nieznany') });
  }
}
