// ============================================================================
//  W PUNKT CV — BACKEND (funkcja serverless dla Vercel)
//  Tu mieszka Twój klucz API. Klient NIGDY go nie widzi.
//
//  F1 (Analiza CV)         — zwykłe wywołanie Claude, bez web search
//  F2 (Scoring Pracodawcy) — Claude z web_search_20250305 (dane na żywo)
//  fetch-url               — pobiera treść ogłoszenia z podanego URL
//
//  Aby zmienić model AI — zmień linijki poniżej.
//    Opus 4.7 (najmocniejszy) : 'claude-opus-4-7'
//    Sonnet 4.6 (taniej)      : 'claude-sonnet-4-6'
// ============================================================================

const MODEL_F1 = 'claude-opus-4-7';   // Analiza CV — bez web search
const MODEL_F2 = 'claude-sonnet-4-6'; // Scoring pracodawcy — z web search

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Tylko POST.' });
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'Brak klucza API w konfiguracji serwera.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Nieprawidłowe dane wejściowe.' });
  }

  // ----------------------------------------------------------------
  // TRYB: fetch-url — pobierz treść ogłoszenia z URL
  // ----------------------------------------------------------------
  if (body.action === 'fetch-url') {
    const url = body.url;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Brak URL.' });
    }

    // Podstawowa walidacja URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: 'Dozwolone tylko adresy http/https.' });
      }
    } catch {
      return res.status(400).json({ error: 'Nieprawidłowy URL.' });
    }

    try {
      const pageRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WPunktCV/1.0)',
          'Accept': 'text/html,application/xhtml+xml,*/*'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000) // 10s timeout
      });

      if (!pageRes.ok) {
        return res.status(400).json({ error: `Nie udało się pobrać strony (HTTP ${pageRes.status}). Skopiuj treść ogłoszenia ręcznie.` });
      }

      const html = await pageRes.text();

      // Wyczyść HTML — zostaw tylko tekst
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s{3,}/g, '\n\n')
        .trim()
        .slice(0, 8000); // max 8000 znaków

      if (text.length < 100) {
        return res.status(400).json({ error: 'Strona nie zwróciła treści tekstowej. Skopiuj ogłoszenie ręcznie.' });
      }

      return res.status(200).json({ text });

    } catch (e) {
      if (e.name === 'TimeoutError') {
        return res.status(400).json({ error: 'Strona nie odpowiada (timeout). Skopiuj ogłoszenie ręcznie.' });
      }
      return res.status(400).json({ error: 'Błąd pobierania strony. Skopiuj ogłoszenie ręcznie.' });
    }
  }

  // ----------------------------------------------------------------
  // TRYB: analiza Claude (F1 i F2)
  // ----------------------------------------------------------------
  let prompt, maxTokens, useWebSearch;
  try {
    prompt       = body.prompt;
    maxTokens    = body.max_tokens || 1200;
    useWebSearch = body.web_search === true;
  } catch (e) {
    return res.status(400).json({ error: 'Nieprawidłowe dane wejściowe.' });
  }

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Brak treści zapytania (prompt).' });
  }

  const requestBody = {
    model:      useWebSearch ? MODEL_F2 : MODEL_F1,
    max_tokens: maxTokens,
    messages:   [{ role: 'user', content: prompt }]
  };

  if (useWebSearch) {
    requestBody.tools = [
      {
        type: 'web_search_20250305',
        name: 'web_search'
      }
    ];
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       API_KEY,
        'anthropic-version': '2023-06-01',
        ...(useWebSearch ? { 'anthropic-beta': 'web-search-2025-03-05' } : {})
      },
      body: JSON.stringify(requestBody)
    });

    const data = await r.json();

    if (!r.ok) {
      const msg = (data && data.error && data.error.message)
        ? data.error.message
        : ('HTTP ' + r.status);
      return res.status(r.status).json({ error: 'Błąd API: ' + msg });
    }

    let finalText = '';
    let currentData = data;
    let messages = [{ role: 'user', content: prompt }];
    let iterations = 0;

    while (iterations < 10) {
      iterations++;
      const content = currentData.content || [];
      const stopReason = currentData.stop_reason;

      const textParts = content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');
      if (textParts) finalText += textParts;

      if (stopReason === 'end_turn' || !content.some(b => b.type === 'tool_use')) {
        break;
      }

      const toolUseBlocks = content.filter(b => b.type === 'tool_use');
      messages.push({ role: 'assistant', content });

      const toolResults = toolUseBlocks.map(tu => ({
        type:        'tool_result',
        tool_use_id: tu.id,
        content:     tu.input?.query
          ? `Wyszukiwanie wykonane dla: ${tu.input.query}`
          : 'Wynik wyszukiwania'
      }));

      messages.push({ role: 'user', content: toolResults });

      const r2 = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':    'application/json',
          'x-api-key':       API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta':  'web-search-2025-03-05'
        },
        body: JSON.stringify({
          model:      MODEL_F2,
          max_tokens: maxTokens,
          tools:      requestBody.tools,
          messages
        })
      });

      currentData = await r2.json();

      if (!r2.ok) {
        const msg = (currentData && currentData.error && currentData.error.message)
          ? currentData.error.message
          : ('HTTP ' + r2.status);
        return res.status(r2.status).json({ error: 'Błąd API (web search): ' + msg });
      }
    }

    if (!finalText) {
      finalText = (currentData.content || [])
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();
    }

    return res.status(200).json({ text: finalText.trim() });

  } catch (e) {
    return res.status(500).json({ error: 'Błąd połączenia z AI: ' + (e.message || 'nieznany') });
  }
}
