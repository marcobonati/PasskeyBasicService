# 🔧 Troubleshooting PasskeyBasicService

## ❌ Errori Comuni e Soluzioni

### 1. **Origin Mismatch Error**

#### Errore:
```
Error: Unexpected registration response origin "https://app.onrender.com", 
expected "http://app.onrender.com:10000"
```

#### Causa:
Il server si aspetta HTTP ma riceve HTTPS, o la porta non corrisponde.

#### ✅ Soluzione:
Configura le environment variables correttamente per il tuo deployment:

**Per Render.com:**
```bash
NODE_ENV=production
HTTPS=true
RP_ID=your-app-name.onrender.com
ORIGIN=https://your-app-name.onrender.com
```

**Per Vercel:**
```bash
NODE_ENV=production
HTTPS=true
RP_ID=your-app.vercel.app
ORIGIN=https://your-app.vercel.app
```

**Per Heroku:**
```bash
NODE_ENV=production
HTTPS=true
RP_ID=your-app.herokuapp.com
ORIGIN=https://your-app.herokuapp.com
```

---

### 2. **Challenge Not Found Error**

#### Errore:
```json
{ "error": "Challenge non trovata o scaduta" }
```

#### Cause Possibili:
- Challenge scaduta (>5 minuti)
- Multiple requests con stessa challenge
- Server restart tra begin/complete
- Clock skew tra client/server

#### ✅ Soluzioni:
1. **Riprova la registrazione** da capo
2. **Verifica sincronizzazione orario** del server
3. **Non usare la stessa challenge** multiple volte
4. **Completa registrazione entro 5 minuti**

---

### 3. **CORS Errors**

#### Errore:
```
Access to fetch at 'https://api.com/register/begin' from origin 'https://app.com' 
has been blocked by CORS policy
```

#### ✅ Soluzione:
Il server ha CORS automatico, ma verifica:
1. **Origin è nella allowlist**
2. **HTTPS/HTTP matching**
3. **No trailing slash** negli URL

---

### 4. **Session/Cookie Issues**

#### Errore:
```json
{ "error": "Autenticazione richiesta" }
```

#### ✅ Soluzioni:
1. **Includi credentials nelle fetch:**
```javascript
fetch('/api/current-time', {
    credentials: 'include'  // ← Importante!
})
```

2. **Verifica cookie settings** in produzione
3. **HTTPS richiesto** per secure cookies

---

### 5. **WebAuthn Not Supported**

#### Errore:
```
navigator.credentials is undefined
```

#### Cause:
- Browser troppo vecchio
- HTTP invece di HTTPS (produzione)
- Private/Incognito mode (limitato)

#### ✅ Soluzioni:
1. **Usa HTTPS** in produzione
2. **Test su browser moderni** (Chrome 67+, Safari 14+)
3. **Evita private mode** per testing

---

## 🐛 Debug Mode

### Abilita Logging Dettagliato

Aggiungi al tuo `.env`:
```bash
DEBUG=*
LOG_LEVEL=debug
```

### Console Logs da Verificare

#### Server-side:
```bash
🔧 Configurazione WebAuthn:
   - RP ID: your-domain.com
   - Origin: https://your-domain.com  
   - Produzione: true
   - HTTPS: true

🌐 CORS check per origine: https://your-domain.com
✅ Origine permessa

🔍 Debug verifyRegistrationResponse:
- Challenge expected: kZhLGKkiHKkeNWjnKjVHqY8...
- Origin from request: https://your-domain.com
- Current RP ID: your-domain.com
- Final expected origin: https://your-domain.com
```

#### Client-side:
```javascript
// Nel browser DevTools
console.log('WebAuthn supported:', 'credentials' in navigator);
console.log('User agent:', navigator.userAgent);
console.log('Is secure context:', window.isSecureContext);
```

---

## 🔍 Testing Tools

### 1. **cURL Testing**
```bash
# Test registrazione begin
curl -X POST https://your-domain.com/register/begin \
  -H "Content-Type: application/json" \
  -H "Origin: https://your-domain.com" \
  -d '{"username":"test-user"}' \
  -v

# Verifica CORS
curl -X OPTIONS https://your-domain.com/register/begin \
  -H "Origin: https://your-domain.com" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

### 2. **Browser DevTools**
1. **Network tab**: Verifica headers Origin/Referer
2. **Console**: Controlla errori JavaScript
3. **Application tab**: Verifica cookies di sessione
4. **Security tab**: Verifica certificato HTTPS

### 3. **Online Tools**
- **WebAuthn.io**: Test compatibilità browser
- **SSL Labs**: Test configurazione HTTPS
- **CORS Tester**: Verifica policy CORS

---

## 📱 Device-Specific Issues

### iOS Safari
- **Richiede iOS 16+** per passkeys complete
- **Face ID/Touch ID** deve essere configurato
- **Private browsing** limita funzionalità

### Android Chrome
- **Google Play Services** aggiornati richiesti
- **Screen lock** deve essere attivo
- **Chrome 76+** per supporto completo

### Desktop Browsers
- **Windows Hello** per biometrics
- **Touch ID** su Mac
- **Authenticator fisici** supportati

---

## 🚀 Performance Optimization

### 1. **Timeout Settings**
```javascript
// Aumenta timeout per dispositivi lenti
const options = await generateRegistrationOptions({
    timeout: 120000, // 2 minuti invece di 1
    // ...
});
```

### 2. **Challenge Cleanup**
```javascript
// Cleanup automatico challenge scadute
setInterval(() => {
    const now = Date.now();
    for (const [challenge, data] of currentChallenges.entries()) {
        if (now - data.timestamp > 300000) { // 5 minuti
            currentChallenges.delete(challenge);
        }
    }
}, 60000); // Ogni minuto
```

### 3. **Database Optimization**
Per produzione, sostituisci Map in-memory con database:
```javascript
// Invece di: const users = new Map();
// Usa: MongoDB, PostgreSQL, Redis per persistence
```

---

*Ultimo aggiornamento: 28 ottobre 2025*