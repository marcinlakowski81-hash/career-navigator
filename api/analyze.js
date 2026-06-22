// ============================================================================
//  W PUNKT CV — BACKEND (funkcja serverless dla Vercel)
//  Tu mieszka Twój klucz API. Klient NIGDY go nie widzi.
//
//  F1 (Analiza CV)        — zwykłe wywołanie Claude, bez web search
//  F2 (Scoring Pracodawcy) — Claude z web_search_20250305 (dane na żywo)
//
//  Aby zmienić model AI — zmień linijki poniżej.
//    Opus 4.7 (najmocniejszy) : 'claude-sonnet-4-6'
//    Sonnet 4.6 (taniej)      : 'claude-sonnet-4-6'
// ============================================================================

const MODEL_F1 = 'claude-sonnet-4-6';   // Analiza CV — bez web search
const MODEL_F2 = 'claude-sonnet-4-6'; // Scoring pracodawcy — z web search (sonnet szybszy do przeszukiwania)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Tylko POST.' });
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'Brak klucza API w konfiguracji serwera.' });
  }

  let prompt, maxTokens, useWebSearch;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    prompt       = body.prompt;
    maxTokens    = body.max_tokens || 1200;
    useWebSearch = body.web_search === true; // F2 przesyła web_search: true
  } catch (e) {
    return res.status(400).json({ error: 'Nieprawidłowe dane wejściowe.' });
  }

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Brak treści zapytania (prompt).' });
  }

  // ----------------------------------------------------------------
  // Buduj body zapytania — F2 dostaje narzędzie web_search
  // ----------------------------------------------------------------
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

  // ----------------------------------------------------------------
  // Wywołaj API Claude
  // ----------------------------------------------------------------
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       API_KEY,
        'anthropic-version': '2023-06-01',
        // web_search wymaga beta headera
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

    // ----------------------------------------------------------------
    // Obsługa tool_use (web_search) — pętla agentic
    // Claude może zwrócić tool_use zamiast tekstu końcowego.
    // Musimy wtedy dosłać wynik narzędzia i poczekać na finalną odpowiedź.
    // ----------------------------------------------------------------
    let finalText = '';
    let currentData = data;
    let messages = [{ role: 'user', content: prompt }];
    let iterations = 0;

    while (iterations < 10) {
      iterations++;
      const content = currentData.content || [];
      const stopReason = currentData.stop_reason;

      // Zbierz tekst z tej rundy
      const textParts = content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');
      if (textParts) finalText += textParts;

      // Jeśli stop_reason to "end_turn" lub brak tool_use — gotowe
      if (stopReason === 'end_turn' || !content.some(b => b.type === 'tool_use')) {
        break;
      }

      // Są tool_use — przygotuj tool_result i wyślij kolejną rundę
      const toolUseBlocks = content.filter(b => b.type === 'tool_use');

      // Dodaj odpowiedź asystenta do historii
      messages.push({ role: 'assistant', content });

      // Buduj tool_result dla każdego wywołania narzędzia
      const toolResults = toolUseBlocks.map(tu => ({
        type:        'tool_result',
        tool_use_id: tu.id,
        content:     tu.input?.query
          ? `Wyszukiwanie wykonane dla: ${tu.input.query}`
          : 'Wynik wyszukiwania'
      }));

      messages.push({ role: 'user', content: toolResults });

      // Kolejne wywołanie API z historią
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

    // Zbierz tekst z ostatniej rundy jeśli pętla nie zebrała
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
