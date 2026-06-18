import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Tylko POST.' });
  }

  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;

  if (!GMAIL_USER || !GMAIL_PASS) {
    return res.status(500).json({ error: 'Brak konfiguracji e-mail.' });
  }

  let stars, comment, source;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    stars   = parseInt(body.stars, 10);
    comment = (body.comment || '').slice(0, 1000).trim();
    source  = body.source === 'scoring' ? 'Scoring Pracodawcy' : 'Analiza CV';
  } catch (e) {
    return res.status(400).json({ error: 'Nieprawidłowe dane.' });
  }

  if (!stars || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Nieprawidłowa ocena.' });
  }

  const starStr  = '★'.repeat(stars) + '☆'.repeat(5 - stars);
  const dateStr  = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
  const commentSection = comment
    ? `<p><strong>Komentarz:</strong><br>${comment.replace(/\n/g, '<br>')}</p>`
    : '<p><em>Brak komentarza.</em></p>';

  const htmlBody = `
<div style="font-family:sans-serif;max-width:520px;color:#16263f">
  <h2 style="margin:0 0 12px;color:#16263f">Nowa opinia — W Punkt CV</h2>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><td style="padding:8px 0;color:#7a7060;width:120px">Narzędzie</td><td style="padding:8px 0;font-weight:600">${source}</td></tr>
    <tr><td style="padding:8px 0;color:#7a7060">Ocena</td><td style="padding:8px 0;font-size:20px;color:#b88a32">${starStr} <span style="font-size:14px;color:#16263f">(${stars}/5)</span></td></tr>
    <tr><td style="padding:8px 0;color:#7a7060">Data</td><td style="padding:8px 0">${dateStr}</td></tr>
  </table>
  <hr style="border:none;border-top:1px solid #e3dbcb;margin:16px 0">
  ${commentSection}
  <p style="font-size:12px;color:#7a7060;margin-top:24px">Wiadomość wysłana automatycznie przez W Punkt CV · wpunktcv.pl</p>
</div>`;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS
      }
    });

    await transporter.sendMail({
      from:    `"W Punkt CV Feedback" <${GMAIL_USER}>`,
      to:      GMAIL_USER,
      subject: `[W Punkt CV] Opinia ${starStr} — ${source}`,
      html:    htmlBody
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Błąd wysyłki e-mail:', e.message);
    return res.status(500).json({ error: 'Błąd wysyłki: ' + e.message });
  }
}
