# 🚀 Guida Deployment Cloud per Passkeys Server

## 📋 Configurazione Generale

Quando deploi su cloud, devi configurare le seguenti variabili d'ambiente:

### Variabili Obbligatorie:
```bash
NODE_ENV=production
RP_ID=il-tuo-dominio.com
ORIGIN=https://il-tuo-dominio.com
HTTPS=true
SESSION_SECRET=una-chiave-segreta-molto-lunga-e-casuale
```

## 🌍 Provider Cloud Specifici

### Heroku
```bash
# Imposta le variabili d'ambiente
heroku config:set NODE_ENV=production
heroku config:set RP_ID=myapp.herokuapp.com
heroku config:set ORIGIN=https://myapp.herokuapp.com
heroku config:set HTTPS=true
heroku config:set SESSION_SECRET=your-secret-here

# Deploy
git push heroku main
```

### Vercel
Crea file `vercel.json`:
```json
{
  "functions": {
    "index.js": {
      "runtime": "nodejs18.x"
    }
  },
  "env": {
    "NODE_ENV": "production",
    "RP_ID": "myapp.vercel.app",
    "ORIGIN": "https://myapp.vercel.app",
    "HTTPS": "true",
    "SESSION_SECRET": "your-secret-here"
  }
}
```

### Railway
Nel dashboard Railway, imposta:
```
NODE_ENV=production
RP_ID=myapp.railway.app
ORIGIN=https://myapp.railway.app
HTTPS=true
SESSION_SECRET=your-secret-here
```

### Digital Ocean App Platform
Nel file `app.yaml`:
```yaml
name: passkeys-server
services:
- name: api
  source_dir: /
  github:
    repo: your-repo
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: RP_ID
    value: myapp.ondigitalocean.app
  - key: ORIGIN
    value: https://myapp.ondigitalocean.app
  - key: HTTPS
    value: "true"
  - key: SESSION_SECRET
    value: your-secret-here
```

## 🔧 Requisiti Tecnici

### 1. HTTPS Obbligatorio
Le passkeys funzionano solo con HTTPS in produzione (eccetto localhost).

### 2. Dominio Corretto
`RP_ID` deve corrispondere esattamente al dominio del tuo servizio.

### 3. Origin Matching
`ORIGIN` deve corrispondere esattamente all'URL del frontend.

### 4. Headers CORS
Il server è configurato per accettare requests da:
- localhost (qualsiasi porta)
- il dominio configurato in `ORIGIN`
- domini ngrok per testing

## 🧪 Test del Deployment

1. **Verifica HTTPS**: L'URL deve iniziare con `https://`
2. **Test API**: Visita `/api/auth-status` per verificare che il server risponda
3. **Test Passkeys**: Prova registrazione e login dalla pagina principale
4. **Debug**: Controlla i log del provider cloud per eventuali errori

## 🚨 Problemi Comuni

### "Invalid Origin"
- Verifica che `ORIGIN` corrisponda esattamente all'URL del browser
- Controlla che non ci siano slash finali extra

### "CORS Error"
- Aggiungi il tuo dominio alla lista `allowedOrigins` nel codice
- Verifica le impostazioni del provider cloud

### "Secure Context Required"
- Assicurati che HTTPS sia attivo
- Verifica che `HTTPS=true` sia impostato

### "Session Issues"
- Imposta una `SESSION_SECRET` forte
- Verifica le impostazioni dei cookie per il tuo provider

## 📱 Test Cross-Device

Le passkeys funzionano:
- ✅ Stesso dispositivo, stesso browser
- ✅ Stesso account iCloud/Google su dispositivi diversi
- ✅ Sync tramite cloud del browser
- ❌ Dispositivi non sincronizzati

## 🔐 Sicurezza in Produzione

1. **Cambia SESSION_SECRET**: Usa una stringa lunga e casuale
2. **Abilita HTTPS**: Obbligatorio per passkeys
3. **Monitora i log**: Controlla accessi e errori
4. **Backup utenti**: In produzione usa un database persistente

## 🆘 Debug

Se le passkeys non funzionano in cloud:

1. **Controlla console browser** per errori JavaScript
2. **Verifica network tab** per errori HTTP
3. **Controlla log server** per errori backend
4. **Testa API manualmente** con curl/Postman