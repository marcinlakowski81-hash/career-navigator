# Career Navigator — jak postawić na Vercel (≈15 minut)

Masz przed sobą gotowy projekt. Nie musisz nic programować — wystarczy
wgrać pliki, wkleić klucz i kliknąć „Deploy". Poniżej każdy krok dokładnie.

---

## Co masz w paczce

```
career-navigator/
├── api/
│   └── analyze.js      ← BACKEND: tu (na serwerze) dokładany jest Twój klucz
├── public/
│   └── index.html      ← STRONA: narzędzie, które widzą klienci
├── vercel.json         ← konfiguracja (nie ruszaj)
└── package.json        ← konfiguracja (nie ruszaj)
```

Klucz API **NIE jest** nigdzie w plikach. Wklejasz go raz, w panelu Vercela,
w bezpiecznym miejscu (krok 4). Dzięki temu klient nigdy go nie zobaczy.

---

## KROK 1 — Załóż konto na Vercel (raz, ~3 min)

1. Wejdź na **vercel.com** i kliknij „Sign Up".
2. Najprościej: zaloguj się kontem GitHub (jeśli nie masz GitHuba, użyj e-maila).
3. Wybierz darmowy plan „Hobby". To wystarczy w zupełności na start.

---

## KROK 2 — Wgraj projekt

Masz dwie drogi. Wybierz **A** (najprostsza, bez instalowania niczego).

### Droga A — przez stronę Vercela (zalecana)

1. Spakuj folder `career-navigator` do pliku ZIP
   (kliknij prawym na folder → „Kompresuj" / „Wyślij do → folder skompresowany").
2. Na Vercelu kliknij **Add New… → Project**.
3. Poszukaj opcji wgrania/„Deploy" — możesz przeciągnąć ZIP albo połączyć z GitHubem.
   - Jeśli pojawi się prośba o repozytorium Git: użyj drogi B poniżej,
     albo najpierw wrzuć folder na GitHub (darmowe) i połącz.

### Droga B — przez terminal (jeśli wolisz; tak stawia się to najszybciej)

1. Zainstaluj narzędzie Vercela (raz): otwórz terminal/PowerShell i wpisz:
   ```
   npm install -g vercel
   ```
2. Wejdź do folderu projektu:
   ```
   cd ścieżka/do/career-navigator
   ```
3. Uruchom:
   ```
   vercel
   ```
   Odpowiadaj Enter na pytania (przyjmij domyślne). Po chwili dostaniesz adres
   typu `https://career-navigator-xxxx.vercel.app`.

---

## KROK 3 — Zdobądź klucz API Anthropic (jeśli jeszcze nie masz pod ręką)

Masz już klucz z generatora postów — użyj tego samego, albo zrób nowy:

1. Wejdź na **console.anthropic.com** → zaloguj się.
2. Zakładka **API Keys** → „Create Key" → skopiuj (zaczyna się od `sk-ant-...`).
3. Upewnij się, że na koncie masz doładowane środki (Billing).
   Na testy wystarczy kilkadziesiąt złotych — jedna analiza to grosze.

> ⚠️ Klucz skopiuj w bezpieczne miejsce. Trzymaj go dla siebie.

---

## KROK 4 — Wklej klucz do Vercela (NAJWAŻNIEJSZY KROK)

To tutaj klucz ląduje w bezpiecznym, zaszyfrowanym miejscu — nie w kodzie.

1. W panelu Vercela otwórz swój projekt.
2. Kliknij **Settings** (w bocznym menu).
3. Wejdź w **Environment Variables**.
4. Dodaj nową zmienną:
   - **Name** (nazwa):  `ANTHROPIC_API_KEY`
     (dokładnie tak, wielkimi literami, z podkreśleniami — bez tego nie zadziała)
   - **Value** (wartość):  wklej swój klucz `sk-ant-...`
   - Zaznacz wszystkie środowiska (Production, Preview, Development).
5. Zapisz (Save).

---

## KROK 5 — Przedeployuj (żeby klucz „wszedł w życie")

Ważne: klucz dodany po wgraniu projektu działa dopiero po ponownym deployu.

- **Droga A:** w zakładce **Deployments** kliknij przy ostatnim deployu
  „…” (trzy kropki) → **Redeploy**.
- **Droga B (terminal):** wpisz `vercel --prod`.

Po chwili wejdź na swój adres `https://...vercel.app` i przetestuj —
wklej CV i ogłoszenie, kliknij „Analizuj". Powinno działać. 🎉

---

## Jak zmienić model AI (gdybyś chciał taniej)

Otwórz `api/analyze.js`, zmień JEDNĄ linijkę na górze:

```js
const MODEL = 'claude-opus-4-7';          // najmocniejszy (teraz)
// const MODEL = 'claude-sonnet-4-6';      // taniej, bardzo zbliżona jakość
// const MODEL = 'claude-haiku-4-5-20251001'; // najtaniej
```

Zapisz, wgraj ponownie (Redeploy). Tyle.

---

## Coś nie działa? Najczęstsze przyczyny

- **„Brak klucza API w konfiguracji serwera"** → nie dodałeś zmiennej
  `ANTHROPIC_API_KEY` albo nie zrobiłeś Redeploy po jej dodaniu (KROK 5).
- **Błąd 401 / „authentication"** → klucz błędny lub konto bez środków.
- **Nazwa zmiennej z literówką** → musi być DOKŁADNIE `ANTHROPIC_API_KEY`.
- **Strona działa, ale analiza nie** → otwórz adres `...vercel.app`,
  a nie plik z dysku.

---

## Co dalej (kolejne kroki biznesowe)

1. Przetestuj na 3–5 osobach ze swojej sieci (LinkedIn, rekruter).
2. Dodaj bramkę płatności (Stripe / Przelewy24) dla pełnego raportu.
3. Dopiero potem — własna domena (np. careernavigator.tech) podpięta tutaj.

Powodzenia. Masz teraz prawdziwy, działający produkt — nie demo.
