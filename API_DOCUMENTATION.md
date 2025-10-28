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

#### Parametri Input

| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|--------------|-------------|
| `username` | `string` | ✅ | Nome utente univoco per la registrazione. Deve essere una stringa non vuota. Verrà utilizzato come `userName` e `userDisplayName` nel processo WebAuthn. Esempi: `"mario.rossi"`, `"user@example.com"`, `"MarioRossi123"` |

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

#### Parametri Input

| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|--------------|-------------|
| `credential` | `object` | ✅ | Oggetto credenziale generato dal browser tramite `navigator.credentials.create()` |
| `credential.id` | `string` | ✅ | ID della credenziale in formato Base64URL. Identifica univocamente questa credenziale |
| `credential.rawId` | `string` | ✅ | ID raw della credenziale in formato ArrayBuffer codificato Base64URL |
| `credential.type` | `string` | ✅ | Tipo di credenziale, sempre `"public-key"` per WebAuthn |
| `credential.response` | `object` | ✅ | Oggetto response contenente i dati di registrazione |
| `credential.response.clientDataJSON` | `string` | ✅ | Dati client in formato JSON codificati Base64URL. Contiene challenge, origin, type |
| `credential.response.attestationObject` | `string` | ✅ | Oggetto attestazione codificato Base64URL. Contiene chiave pubblica e metadati dell'authenticator |

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

#### Parametri Input

| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|--------------|-------------|
| *Nessun parametro* | - | - | L'endpoint non richiede parametri in input. Il server rileva automaticamente tutte le credenziali registrate e le include nella response per permettere al client di selezionare quella appropriata |

#### Note
- Il corpo della richiesta può essere vuoto `{}` o omesso completamente
- Il server utilizza l'header `Origin` o `Referer` per determinare l'RP ID appropriato
- Tutte le credenziali registrate vengono incluse in `allowCredentials` nella response

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

#### Parametri Input

| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|--------------|-------------|
| `credential` | `object` | ✅ | Oggetto credenziale generato dal browser tramite `navigator.credentials.get()` |
| `credential.id` | `string` | ✅ | ID della credenziale utilizzata per l'autenticazione, in formato Base64URL |
| `credential.rawId` | `string` | ✅ | ID raw della credenziale in formato ArrayBuffer codificato Base64URL |
| `credential.type` | `string` | ✅ | Tipo di credenziale, sempre `"public-key"` per WebAuthn |
| `credential.response` | `object` | ✅ | Oggetto response contenente i dati di autenticazione |
| `credential.response.clientDataJSON` | `string` | ✅ | Dati client in formato JSON codificati Base64URL. Contiene challenge, origin, type dell'operazione |
| `credential.response.authenticatorData` | `string` | ✅ | Dati dell'authenticator codificati Base64URL. Contiene RP ID hash, flags, counter |
| `credential.response.signature` | `string` | ✅ | Firma digitale della challenge codificata Base64URL, generata con la chiave privata |
| `credential.response.userHandle` | `string` | ❓ | Handle utente codificato Base64URL. Può essere `null` o vuoto. Utilizzato per identificare l'utente |

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

#### Parametri Input

| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|--------------|-------------|
| *Nessun parametro body* | - | - | Endpoint GET senza body |

#### Headers Richiesti

| Header | Tipo | Obbligatorio | Descrizione |
|--------|------|--------------|-------------|
| `Cookie` | `string` | ✅ | Cookie di sessione con formato `connect.sid=session-id`. Generato automaticamente dopo login successful. Il browser lo invia automaticamente se `credentials: 'include'` è specificato nella fetch |

#### Note di Autenticazione
- Richiede una sessione valida ottenuta tramite `/authenticate/complete`
- Il middleware `requireAuth` verifica `req.session.authenticated === true`
- Se non autenticato, restituisce errore 401

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

#### Parametri Input

| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|--------------|-------------|
| *Nessun parametro body* | - | - | Endpoint GET senza body |

#### Headers Opzionali

| Header | Tipo | Obbligatorio | Descrizione |
|--------|------|--------------|-------------|
| `Cookie` | `string` | ❓ | Cookie di sessione con formato `connect.sid=session-id`. Se presente e valido, restituisce info utente autenticato. Se assente o invalido, restituisce `authenticated: false` |

#### Note
- Non richiede autenticazione (a differenza di `/api/current-time`)
- Utile per verificare stato login prima di fare altre chiamate
- Safe endpoint - non espone informazioni sensibili se non autenticato

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

#### Parametri Input

| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|--------------|-------------|
| *Nessun parametro body* | - | - | Il corpo può essere vuoto `{}` o omesso completamente |

#### Headers Richiesti

| Header | Tipo | Obbligatorio | Descrizione |
|--------|------|--------------|-------------|
| `Cookie` | `string` | ✅ | Cookie di sessione con formato `connect.sid=session-id`. Identifica la sessione da distruggere. Dopo il logout questo cookie diventerà invalido |

#### Note
- Distrugge completamente la sessione server-side
- Dopo il logout, tutti gli endpoint protetti restituiranno 401
- Il browser dovrebbe rimuovere automaticamente il cookie di sessione

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

#### Parametri Input

| Campo | Tipo | Obbligatorio | Descrizione |
|-------|------|--------------|-------------|
| *Nessun parametro* | - | - | Endpoint GET che serve file statico |

#### Query Parameters

| Parametro | Tipo | Obbligatorio | Descrizione |
|-----------|------|--------------|-------------|
| *Nessuno* | - | - | Non accetta query parameters |

#### Note
- Serve il file `simple.html` dalla directory root del progetto
- Contiene interfaccia web completa per testing manuale dei passkeys
- Include JavaScript client-side per chiamare le API WebAuthn

#### Response
Restituisce il file `simple.html` con:
- Form di registrazione passkey
- Form di autenticazione passkey  
- Pulsanti per testare API protette
- Pulsante di logout
- Visualizzazione stato di autenticazione

---

## � **Formati di Codifica e Validazione**

### Base64URL Encoding
Tutti i dati binari nelle API WebAuthn utilizzano la codifica **Base64URL** (RFC 4648 Section 5):
- Caratteri: `A-Z`, `a-z`, `0-9`, `-`, `_`
- No padding `=`
- URL-safe (può essere usato in URL senza encoding)

#### Esempi di Campi Base64URL:
```javascript
// Challenge (32 byte random)
"challenge": "kZhLGKkiHKkeNWjnKjVHqY8bO4RkwrJ8_2E5BhkYFuc"

// Credential ID
"id": "AeOW5QP_c_M3gR8pJIGPEtQKkJrFQ9VvYZJMZ2YN8_Q"

// ClientDataJSON (decodifica in JSON)
"clientDataJSON": "eyJ0eXBlIjoiL..."
// Decodificato: {"type":"webauthn.create","challenge":"...","origin":"https://..."}
```

### Validazione Input

#### Username (Registrazione)
- **Lunghezza**: 1-64 caratteri
- **Caratteri permessi**: Lettere, numeri, `.`, `@`, `_`, `-`
- **Esempi validi**: `mario.rossi`, `user@example.com`, `user_123`
- **Esempi non validi**: `""`, `null`, `undefined`, stringhe con spazi

#### Credential ID
- **Formato**: Base64URL string
- **Lunghezza**: Tipicamente 32-64 byte (44-86 caratteri codificati)
- **Deve corrispondere** a una credenziale precedentemente registrata

#### Challenge
- **Formato**: Base64URL string  
- **Lunghezza**: Esattamente 32 byte (43 caratteri codificati)
- **Validità**: 5 minuti dalla generazione
- **Uso singolo**: Ogni challenge può essere utilizzata una sola volta

---

## �💻 Esempi di Utilizzo

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