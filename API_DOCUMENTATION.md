# PasskeyBasicService - Documentazione API

## 📋 Panoramica

**PasskeyBasicService** è un server Node.js che implementa l'autenticazione WebAuthn/FIDO2 (Passkeys) con API RESTful. Il servizio supporta la registrazione e l'autenticazione senza password utilizzando biometria, PIN o chiavi di sicurezza hardware.

### 🔧 Configurazione

- **Server**: Express.js
- **Porta**: 3000 (configurabile via `PORT`)
- **Autenticazione**: WebAuthn/FIDO2 con `@simplewebauthn/server`
- **Sessioni**: Express sessions
- **CORS**: Configurato per deployment cloud

### 🌐 Environment Variables

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `PORT` | `3000` | Porta del server |
| `RP_ID` | `localhost` | Relying Party ID (dominio) |
| `ORIGIN` | `http://localhost:3000` | Origin permesso per CORS |
| `NODE_ENV` | `development` | Ambiente (`production` abilita HTTPS) |
| `HTTPS` | `false` | Forza HTTPS anche in development |

---

## 🔐 Endpoints Autenticazione

### 1. **POST** `/register/begin`

Inizia il processo di registrazione di un nuovo passkey.

#### Request Body
```json
{
  "username": "string" // Nome utente (richiesto)
}
```

#### Response (200 OK)
```json
{
  "rp": {
    "name": "Passkeys Server",
    "id": "localhost"
  },
  "user": {
    "id": "uuid-generato",
    "name": "username",
    "displayName": "username"
  },
  "challenge": "base64url-encoded-challenge",
  "pubKeyCredParams": [
    { "type": "public-key", "alg": -7 },
    { "type": "public-key", "alg": -257 }
  ],
  "timeout": 60000,
  "excludeCredentials": [],
  "authenticatorSelection": {
    "authenticatorAttachment": "platform",
    "userVerification": "preferred",
    "residentKey": "preferred",
    "requireResidentKey": false
  },
  "attestation": "none"
}
```

#### Response (400 Bad Request)
```json
{
  "error": "Username richiesto"
}
```

#### Response (500 Internal Server Error)
```json
{
  "error": "Errore interno del server"
}
```

---

### 2. **POST** `/register/complete`

Completa la registrazione del passkey con la risposta del client.

#### Request Body
```json
{
  "credential": {
    "id": "credential-id",
    "rawId": "raw-credential-id",
    "response": {
      "clientDataJSON": "base64-encoded-client-data",
      "attestationObject": "base64-encoded-attestation"
    },
    "type": "public-key"
  }
}
```

#### Response (200 OK)
```json
{
  "verified": true,
  "message": "Registrazione completata con successo"
}
```

#### Response (400 Bad Request)
```json
{
  "error": "Challenge non trovata o scaduta"
}
```

#### Response (500 Internal Server Error)
```json
{
  "error": "Errore nella verifica della registrazione"
}
```

---

### 3. **POST** `/authenticate/begin`

Inizia il processo di autenticazione con passkey.

#### Request Body
```json
{}
```
*Corpo vuoto - rileva automaticamente le credenziali disponibili*

#### Response (200 OK)
```json
{
  "challenge": "base64url-encoded-challenge",
  "timeout": 60000,
  "rpId": "localhost",
  "allowCredentials": [
    {
      "id": "credential-id",
      "type": "public-key",
      "transports": ["internal", "hybrid"]
    }
  ],
  "userVerification": "preferred"
}
```

#### Response (500 Internal Server Error)
```json
{
  "error": "Errore interno del server"
}
```

---

### 4. **POST** `/authenticate/complete`

Completa l'autenticazione con la risposta del client.

#### Request Body
```json
{
  "credential": {
    "id": "credential-id",
    "rawId": "raw-credential-id",
    "response": {
      "clientDataJSON": "base64-encoded-client-data",
      "authenticatorData": "base64-encoded-authenticator-data",
      "signature": "base64-encoded-signature",
      "userHandle": "base64-encoded-user-handle"
    },
    "type": "public-key"
  }
}
```

#### Response (200 OK)
```json
{
  "verified": true,
  "message": "Autenticazione completata con successo",
  "user": {
    "id": "user-uuid",
    "username": "username"
  }
}
```

#### Response (400 Bad Request)
```json
{
  "error": "Challenge non trovata o credenziale non valida"
}
```

#### Response (500 Internal Server Error)
```json
{
  "error": "Errore nella verifica dell'autenticazione"
}
```

---

## 🔒 Endpoints Protetti (Richiedono Autenticazione)

### 5. **GET** `/api/current-time` 🔐

Restituisce l'orario corrente del server. Richiede autenticazione valida.

#### Headers Richiesti
```
Cookie: connect.sid=session-id
```

#### Response (200 OK)
```json
{
  "currentTime": "2025-10-28T10:30:00.000Z",
  "message": "Ciao username! Questo è un endpoint protetto.",
  "user": {
    "id": "user-uuid",
    "username": "username"
  },
  "serverTime": {
    "timestamp": 1698489000000,
    "locale": "28/10/2025, 11:30:00",
    "timezone": "Europe/Rome"
  }
}
```

#### Response (401 Unauthorized)
```json
{
  "error": "Autenticazione richiesta"
}
```

---

## 📊 Endpoints di Stato

### 6. **GET** `/api/auth-status`

Verifica lo stato di autenticazione dell'utente corrente.

#### Response (200 OK) - Autenticato
```json
{
  "authenticated": true,
  "user": {
    "id": "user-uuid",
    "username": "username"
  }
}
```

#### Response (200 OK) - Non Autenticato
```json
{
  "authenticated": false
}
```

---

### 7. **POST** `/api/logout`

Effettua il logout dell'utente distruggendo la sessione.

#### Request Body
```json
{}
```

#### Response (200 OK)
```json
{
  "message": "Logout effettuato con successo"
}
```

#### Response (500 Internal Server Error)
```json
{
  "error": "Errore durante il logout"
}
```

---

## 🌐 Endpoints Statici

### 8. **GET** `/`

Serve la pagina di test principale con interfaccia semplificata per testare i passkeys.

#### Response
Restituisce il file `simple.html` con:
- Form di registrazione passkey
- Form di autenticazione passkey  
- Pulsanti per testare API protette
- Pulsante di logout
- Visualizzazione stato di autenticazione

---

## 💻 Esempi di Utilizzo

### Registrazione Passkey (JavaScript)

```javascript
// 1. Inizia registrazione
const registerResponse = await fetch('/register/begin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'mario.rossi' })
});

const registerOptions = await registerResponse.json();

// 2. Crea credenziale WebAuthn
const credential = await navigator.credentials.create({
    publicKey: registerOptions
});

// 3. Completa registrazione
const completeResponse = await fetch('/register/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential })
});

const result = await completeResponse.json();
console.log('Registrazione:', result.verified);
```

### Autenticazione Passkey (JavaScript)

```javascript
// 1. Inizia autenticazione
const authResponse = await fetch('/authenticate/begin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
});

const authOptions = await authResponse.json();

// 2. Ottieni credenziale WebAuthn
const credential = await navigator.credentials.get({
    publicKey: authOptions
});

// 3. Completa autenticazione
const completeResponse = await fetch('/authenticate/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential })
});

const result = await completeResponse.json();
console.log('Autenticazione:', result.verified);
```

### Chiamata API Protetta

```javascript
// Dopo l'autenticazione, le sessioni sono gestite automaticamente
const timeResponse = await fetch('/api/current-time', {
    credentials: 'include' // Include cookies di sessione
});

if (timeResponse.ok) {
    const timeData = await timeResponse.json();
    console.log('Orario server:', timeData.currentTime);
} else {
    console.log('Autenticazione richiesta');
}
```

### Test con cURL

```bash
# Registrazione (Step 1)
curl -X POST http://localhost:3000/register/begin \
  -H "Content-Type: application/json" \
  -d '{"username":"test-user"}'

# Verifica stato autenticazione
curl -X GET http://localhost:3000/api/auth-status \
  -H "Cookie: connect.sid=your-session-cookie"

# Logout
curl -X POST http://localhost:3000/api/logout \
  -H "Cookie: connect.sid=your-session-cookie"
```

---

## ⚠️ Note di Sicurezza

### Configurazione Produzione

1. **HTTPS Obbligatorio**: WebAuthn richiede HTTPS in produzione
2. **RP_ID Corretto**: Deve corrispondere al dominio effettivo
3. **CORS Configurato**: Lista domini permessi aggiornata
4. **Sessioni Sicure**: Configurare cookie sicuri per HTTPS

### Variabili Environment Produzione

```bash
export NODE_ENV=production
export HTTPS=true
export RP_ID=yourdomain.com
export ORIGIN=https://yourdomain.com
export PORT=443
```

### Headers di Sicurezza

Il server include automaticamente:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`  
- `X-XSS-Protection: 1; mode=block`

---

## 🔧 Sviluppo e Debug

### Logs Disponibili

Il server produce logs dettagliati per:
- ✅ Configurazione WebAuthn all'avvio
- 🌐 Richieste CORS con origine
- 🔐 Challenge generati e verificati
- ❌ Errori di registrazione/autenticazione
- 📊 Stato sessioni utente

### Testing

```bash
# Avvia server in modalità development
npm run dev

# Avvia con ngrok per test mobile
npm run ngrok
```

### File di Configurazione

- `package.json`: Dipendenze e script
- `simple.html`: Interfaccia di test
- `static/`: File statici serviti
- `.well-known/`: Configurazione Apple App Site Association

---

## 📱 Compatibilità

| Browser/Piattaforma | Supporto | Note |
|-------------------|----------|------|
| **Chrome 67+** | ✅ | WebAuthn completo |
| **Firefox 60+** | ✅ | WebAuthn completo |
| **Safari 14+** | ✅ | Passkeys supportate |
| **Edge 18+** | ✅ | WebAuthn completo |
| **iOS Safari 16+** | ✅ | Passkeys complete |
| **Android Chrome** | ✅ | Con Google Play Services |

---

*Documentazione generata per PasskeyBasicService v1.0.0*
*Data: 28 ottobre 2025*