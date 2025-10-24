# 🔐 Passkeys Server

Server Node.js con autenticazione WebAuthn/Passkeys che espone un'API per ottenere l'orario corrente solo dopo autenticazione.

## 🚀 Caratteristiche

- ✅ Autenticazione WebAuthn/Passkeys
- ✅ API protetta per l'orario corrente
- ✅ Interfaccia web per testing
- ✅ Gestione sessioni sicure
- ✅ Supporto per più credenziali per utente

## 📋 Requisiti

- Node.js 16+ 
- Browser moderno con supporto WebAuthn (Chrome, Firefox, Safari, Edge)
- HTTPS in produzione (per lo sviluppo va bene HTTP su localhost)

## 🛠 Installazione

1. Clona o scarica il progetto
2. Installa le dipendenze:
   ```bash
   npm install
   ```

## 🎯 Utilizzo

### Avvio del Server

```bash
# Avvio normale (solo localhost)
npm start

# Avvio con auto-reload per sviluppo
npm run dev

# Avvio con ngrok per test su dispositivi mobili
./start-ngrok.sh
```

Il server sarà disponibile su:
- **Localhost**: http://localhost:3000
- **Ngrok**: https://your-random-url.ngrok-free.app (quando usi ngrok)

### 📱 Test su Dispositivi Mobili con Ngrok

Per testare le Passkeys su dispositivi mobili reali:

1. **Installa ngrok** (se non già installato):
   ```bash
   brew install ngrok
   # oppure scarica da https://ngrok.com/
   ```

2. **Avvia con ngrok**:
   ```bash
   ./start-ngrok.sh
   ```

3. **Usa l'URL ngrok** mostrato nel terminale (es. `https://abc123.ngrok-free.app`)

4. **Su dispositivi mobili**: Apri l'URL ngrok nel browser del telefono

⚠️ **Nota**: La prima volta che visiti un URL ngrok potresti vedere una pagina di warning. Clicca "Visit Site" per continuare.

### 🔑 Registrazione Passkey

1. Vai su http://localhost:3000
2. Inserisci un nome utente
3. Clicca su "🔑 Registra Passkey"
4. Segui le istruzioni del browser per creare la passkey

### 🔐 Autenticazione

1. Clicca su "🔐 Autentica"
2. Usa la passkey registrata per autenticarti

### ⏰ Ottenere l'Orario

1. Dopo l'autenticazione, clicca su "⏰ Ottieni Orario"
2. L'API restituirà l'orario corrente in formato italiano

## 🌐 API Endpoints

### Pubblici
- `GET /` - Pagina di test
- `POST /register/begin` - Inizia registrazione passkey
- `POST /register/complete` - Completa registrazione passkey  
- `POST /authenticate/begin` - Inizia autenticazione
- `POST /authenticate/complete` - Completa autenticazione

### Protetti (richiedono autenticazione)
- `GET /api/current-time` - Ottieni orario corrente
- `GET /api/auth-status` - Verifica stato autenticazione
- `POST /api/logout` - Effettua logout

## 📱 Esempio di Chiamata API

### Ottenere l'orario corrente

```bash
# Prima devi autenticarti tramite l'interfaccia web, poi:
curl -X GET http://localhost:3000/api/current-time \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

**Risposta di successo:**
```json
{
  "timestamp": 1697977200000,
  "isoString": "2023-10-22T15:00:00.000Z",
  "italianTime": "domenica, 22/10/2023, 17:00:00",
  "timezone": "Europe/Rome",
  "authenticatedUser": {
    "id": "user-uuid",
    "username": "testuser"
  },
  "message": "Orario corrente ottenuto con successo!"
}
```

**Risposta senza autenticazione:**
```json
{
  "error": "Autenticazione richiesta",
  "message": "Devi autenticarti con le tue passkeys per accedere a questa risorsa"
}
```

## 🔧 Configurazione

### Variabili d'Ambiente

- `PORT` - Porta del server (default: 3000)

### Configurazione WebAuthn

Nel file `index.js` puoi modificare:
- `rpName` - Nome dell'applicazione
- `rpID` - Dominio dell'applicazione  
- `origin` - URL completo dell'applicazione

## 🔒 Sicurezza

### Per lo Sviluppo
- HTTP su localhost è supportato
- Session secret hardcoded (va bene per testing)
- Storage in memoria (i dati si perdono al riavvio)

### Per la Produzione
- ⚠️ **Usa HTTPS obbligatoriamente**
- ⚠️ **Cambia il session secret**
- ⚠️ **Usa un database persistente invece della memoria**
- ⚠️ **Configura CORS correttamente**
- ⚠️ **Imposta `secure: true` per i cookies**

## 🧪 Testing

1. Apri http://localhost:3000
2. Registra una passkey con un nome utente
3. Autentica usando la passkey
4. Testa l'API dell'orario
5. Prova il logout

## 🤝 Supporto Browser

| Browser | Supporto | Note |
|---------|----------|------|
| Chrome 67+ | ✅ | Completo |
| Firefox 60+ | ✅ | Completo |
| Safari 14+ | ✅ | Completo |
| Edge 18+ | ✅ | Completo |

## 📚 Dipendenze Principali

- `express` - Web framework
- `@simplewebauthn/server` - Libreria WebAuthn server-side
- `express-session` - Gestione sessioni
- `cors` - Cross-Origin Resource Sharing
- `uuid` - Generazione ID univoci

## 🐛 Risoluzione Problemi

### "Passkey non supportata"
- Verifica che il browser supporti WebAuthn
- Su Safari, abilita "Face ID & Passcode" nelle impostazioni

### "Errore di registrazione"
- Assicurati di essere su localhost o HTTPS
- Controlla la console del browser per errori specifici

### "API non accessibile"
- Verifica di essere autenticato
- Controlla che la sessione non sia scaduta

## 📄 Licenza

ISC