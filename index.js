import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const app = express();
const PORT = process.env.PORT || 3000;

// Configurazione WebAuthn cloud-friendly
const rpName = 'Passkeys Server';
const rpID = process.env.RP_ID || 'localhost'; // Permette override via env var
const isProduction = process.env.NODE_ENV === 'production';
const isHttps = process.env.HTTPS === 'true' || isProduction;
const protocol = isHttps ? 'https' : 'http';
const defaultPort = isHttps ? 443 : (process.env.PORT || 3000);
const portSuffix = (defaultPort === 80 || defaultPort === 443) ? '' : `:${defaultPort}`;
const origin = process.env.ORIGIN || `${protocol}://${rpID}${portSuffix}`;

console.log(`🔧 Configurazione WebAuthn:`);
console.log(`   - RP ID: ${rpID}`);
console.log(`   - Origin: ${origin}`);
console.log(`   - Produzione: ${isProduction}`);
console.log(`   - HTTPS: ${isHttps}`);

// Storage in memoria per demo (in produzione usare un database)
const users = new Map();
const currentChallenges = new Map();

// Middleware CORS cloud-friendly
app.use(cors({
  origin: (requestOrigin, callback) => {
    console.log(`🌐 CORS check per origine: ${requestOrigin}`);
    
    // Permetti requests senza origin (Postman, curl, etc.)
    if (!requestOrigin) {
      return callback(null, true);
    }
    
    // Lista di domini permessi (espandibile)
    const allowedOrigins = [
      'http://localhost:3000',
      'https://localhost:3000',
      origin, // L'origin configurato
    ];
    
    // Permetti localhost su qualsiasi porta
    if (requestOrigin.includes('localhost') || 
        requestOrigin.includes('127.0.0.1') ||
        requestOrigin.includes('ngrok') || 
        requestOrigin.includes('ngrok.io') ||
        requestOrigin.includes('ngrok.app') ||
        requestOrigin.includes('ngrok-free.app') ||
        allowedOrigins.includes(requestOrigin)) {
      console.log(`✅ CORS permesso per: ${requestOrigin}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS negato per: ${requestOrigin}`);
      callback(new Error(`Origine ${requestOrigin} non permessa da CORS`));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

// Headers di sicurezza per il cloud
app.use((req, res, next) => {
  // Permetti WebAuthn in iframe se necessario
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Headers per supportare le passkeys
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  
  // Headers di sicurezza generali
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
});

// Middleware specifico per .well-known con headers corretti
app.use('/.well-known', express.static('static/.well-known', {
  setHeaders: (res, path) => {
    if (path.endsWith('apple-app-site-association')) {
      res.setHeader('Content-Type', 'application/json');
    }
  }
}));

// NON servire contenuti statici sulla root - interferisce con la nostra pagina
// app.use(express.static('static'));

// Configurazione sessioni cloud-friendly
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isHttps, // true in produzione con HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 ore
    sameSite: isProduction ? 'none' : 'lax' // Per supportare cross-origin in produzione
  }
}));

console.log(`🍪 Configurazione cookie:`);
console.log(`   - Secure: ${isHttps}`);
console.log(`   - SameSite: ${isProduction ? 'none' : 'lax'}`);

// Middleware per verificare l'autenticazione
const requireAuth = (req, res, next) => {
  if (!req.session.authenticated || !req.session.userId) {
    return res.status(401).json({ 
      error: 'Autenticazione richiesta', 
      message: 'Devi autenticarti con le tue passkeys per accedere a questa risorsa' 
    });
  }
  next();
};

// Endpoint di base - PAGINA SEMPLICE CON SOLO PASSKEYS
app.get('/', (req, res) => {
  res.sendFile('simple.html', { root: '.' });
});

// Endpoint per iniziare la registrazione
app.post('/register/begin', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: 'Username richiesto' });
    }

    // Rileva automaticamente l'origine dalla richiesta
    const requestOrigin = req.get('origin') || req.get('referer')?.replace(/\/$/, '');
    const currentRpID = requestOrigin ? new URL(requestOrigin).hostname : rpID;
    
    console.log('Richiesta registrazione da:', { requestOrigin, currentRpID });

    const userId = uuidv4();
    
    const options = await generateRegistrationOptions({
      rpName,
      rpID: currentRpID,
      userID: userId, // Usa direttamente la stringa UUID
      userName: username,
      userDisplayName: username,
      attestationType: 'none',
      excludeCredentials: [],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'preferred',
        residentKey: 'preferred',
        requireResidentKey: false,
      },
      supportedAlgorithmIDs: [-7, -257],
    });

    // Salva la challenge e i dati dell'utente temporaneamente usando un timestamp come chiave
    const challengeKey = `${Date.now()}_${userId}`;
    currentChallenges.set(options.challenge, {
      challenge: options.challenge,
      userId,
      username,
      rpID: currentRpID,
      timestamp: Date.now(),
      key: challengeKey
    });

    console.log('Opzioni generate:', { challenge: options.challenge, userId, username });
    console.log('Challenge salvata con chiave:', options.challenge);

    res.json(options);
  } catch (error) {
    console.error('Errore nella generazione delle opzioni di registrazione:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint per completare la registrazione
app.post('/register/complete', async (req, res) => {
  try {
    const { credential } = req.body;
    
    // Debug: mostra il challenge ricevuto nella response
    console.log('Challenge dalla risposta credential:', credential.response?.clientDataJSON);
    
    // Trova la challenge corrispondente dalla risposta credential
    let challengeData = null;
    let challengeKey = null;
    
    // Decodifica clientDataJSON per ottenere la challenge
    const clientDataJSON = JSON.parse(
      Buffer.from(credential.response.clientDataJSON, 'base64').toString('utf8')
    );
    const challengeFromResponse = clientDataJSON.challenge;
    
    console.log('Challenge estratta dalla risposta:', challengeFromResponse);
    console.log('Challenge disponibili:', Array.from(currentChallenges.keys()));
    
    // Cerca la challenge corrispondente
    challengeData = currentChallenges.get(challengeFromResponse);
    challengeKey = challengeFromResponse;
    
    if (!challengeData) {
      console.log('Challenge non trovata. Challenges disponibili:', Array.from(currentChallenges.keys()));
      return res.status(400).json({ error: 'Challenge non trovata o scaduta' });
    }

    const { challenge, userId, username, rpID: currentRpID } = challengeData;

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: req.get('origin') || `http://${currentRpID}:${PORT}`,
      expectedRPID: currentRpID,
      requireUserVerification: false,
    });

    if (verification.verified && verification.registrationInfo) {
      // Salva l'utente con le sue credenziali
      users.set(userId, {
        id: userId,
        username,
        credentials: [{
          credentialID: verification.registrationInfo.credentialID,
          credentialPublicKey: verification.registrationInfo.credentialPublicKey,
          counter: verification.registrationInfo.counter,
          credentialDeviceType: verification.registrationInfo.credentialDeviceType,
          credentialBackedUp: verification.registrationInfo.credentialBackedUp,
        }],
        createdAt: new Date()
      });

      // Imposta la sessione come autenticata
      req.session.authenticated = true;
      req.session.userId = userId;
      req.session.username = username;

      // Rimuovi la challenge usata
      currentChallenges.delete(challengeKey);

      console.log('Registrazione completata con successo per:', username);

      res.json({ 
        verified: true, 
        message: 'Passkey registrata con successo!',
        user: { id: userId, username }
      });
    } else {
      res.status(400).json({ error: 'Verifica della registrazione fallita' });
    }
  } catch (error) {
    console.error('Errore nella verifica della registrazione:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint per iniziare l'autenticazione
app.post('/authenticate/begin', async (req, res) => {
  try {
    // Rileva automaticamente l'origine dalla richiesta
    const requestOrigin = req.get('origin') || req.get('referer')?.replace(/\/$/, '');
    const currentRpID = requestOrigin ? new URL(requestOrigin).hostname : rpID;

    console.log('Richiesta autenticazione da:', { requestOrigin, currentRpID });

    // Ottieni tutte le credenziali degli utenti registrati
    const allowCredentials = [];
    for (const user of users.values()) {
      for (const cred of user.credentials) {
        allowCredentials.push({
          id: cred.credentialID,
          type: 'public-key',
          transports: ['internal', 'hybrid'],
        });
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: currentRpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    // Salva la challenge per la verifica usando la challenge come chiave
    currentChallenges.set(options.challenge, {
      challenge: options.challenge,
      rpID: currentRpID,
      timestamp: Date.now()
    });

    console.log('Opzioni di autenticazione generate:', { challenge: options.challenge });
    console.log('Challenge autenticazione salvata:', options.challenge);

    res.json(options);
  } catch (error) {
    console.error('Errore nella generazione delle opzioni di autenticazione:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint per completare l'autenticazione
app.post('/authenticate/complete', async (req, res) => {
  try {
    const { credential } = req.body;
    
    // Decodifica clientDataJSON per ottenere la challenge
    const clientDataJSON = JSON.parse(
      Buffer.from(credential.response.clientDataJSON, 'base64').toString('utf8')
    );
    const challengeFromResponse = clientDataJSON.challenge;
    
    console.log('Challenge autenticazione dalla risposta:', challengeFromResponse);
    console.log('Challenge autenticazione disponibili:', Array.from(currentChallenges.keys()));
    
    // Trova la challenge corrispondente
    const challengeData = currentChallenges.get(challengeFromResponse);
    const challengeKey = challengeFromResponse;
    
    if (!challengeData) {
      console.log('Challenge non trovata per autenticazione. Challenges disponibili:', Array.from(currentChallenges.keys()));
      return res.status(400).json({ error: 'Challenge non trovata o scaduta' });
    }

    const { challenge, rpID: currentRpID } = challengeData;

    // Trova l'utente con questa credenziale
    let user = null;
    let userCredential = null;

    // Converti l'ID della credenziale da base64 a Uint8Array per il confronto
    console.log('Credential ID ricevuto (raw):', credential.id);
    console.log('Credential ID tipo:', typeof credential.id);
    
    // Proviamo diversi modi di decodificare l'ID
    let credentialIdFromResponse;
    try {
      if (typeof credential.id === 'string') {
        credentialIdFromResponse = new Uint8Array(Buffer.from(credential.id, 'base64'));
      } else {
        // Potrebbe essere già un array buffer o uint8array
        credentialIdFromResponse = new Uint8Array(credential.id);
      }
      console.log('Credential ID decodificato:', Array.from(credentialIdFromResponse));
    } catch (error) {
      console.error('Errore decodifica credential ID:', error);
      return res.status(400).json({ error: 'ID credenziale non valido' });
    }

    console.log('Utenti registrati:', users.size);
    for (const [userId, u] of users.entries()) {
      console.log(`Utente ${userId} (${u.username}) ha ${u.credentials.length} credenziali`);
      for (let i = 0; i < u.credentials.length; i++) {
        const cred = u.credentials[i];
        console.log(`  Credenziale ${i}:`, Array.from(new Uint8Array(cred.credentialID)));
        
        // Confronta le credenziali come Uint8Array
        const storedCredentialId = new Uint8Array(cred.credentialID);
        const isMatch = storedCredentialId.length === credentialIdFromResponse.length &&
                       storedCredentialId.every((val, i) => val === credentialIdFromResponse[i]);
        
        console.log(`  Match: ${isMatch}`);
        
        if (isMatch) {
          user = u;
          userCredential = cred;
          break;
        }
      }
      if (user) break;
    }

    if (!user || !userCredential) {
      return res.status(400).json({ error: 'Credenziale non trovata' });
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: req.get('origin') || `http://${currentRpID}:${PORT}`,
      expectedRPID: currentRpID,
      authenticator: {
        credentialID: userCredential.credentialID,
        credentialPublicKey: userCredential.credentialPublicKey,
        counter: userCredential.counter,
      },
      requireUserVerification: false,
    });

    if (verification.verified) {
      // Aggiorna il counter
      userCredential.counter = verification.authenticationInfo.newCounter;

      // Imposta la sessione come autenticata
      req.session.authenticated = true;
      req.session.userId = user.id;
      req.session.username = user.username;

      // Rimuovi la challenge usata
      currentChallenges.delete(challengeKey);

      console.log('Autenticazione completata con successo per:', user.username);

      res.json({ 
        verified: true, 
        message: 'Autenticazione riuscita!',
        user: { id: user.id, username: user.username }
      });
    } else {
      res.status(400).json({ error: 'Verifica dell\'autenticazione fallita' });
    }
  } catch (error) {
    console.error('Errore nella verifica dell\'autenticazione:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// API protetta per ottenere l'orario corrente
app.get('/api/current-time', requireAuth, (req, res) => {
  res.json({
    currentTime: new Date().toISOString(),
    message: `Ciao ${req.session.username}! Questo è un endpoint protetto.`,
    user: {
      id: req.session.userId,
      username: req.session.username
    },
    serverTime: {
      timestamp: Date.now(),
      locale: new Date().toLocaleString('it-IT'),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  });
});

// Endpoint per verificare lo stato di autenticazione
app.get('/api/auth-status', (req, res) => {
  if (req.session.authenticated && req.session.userId) {
    res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        username: req.session.username
      }
    });
  } else {
    res.json({
      authenticated: false
    });
  }
});

// Endpoint per il logout
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Errore durante il logout' });
    }
    res.json({ message: 'Logout effettuato con successo' });
  });
});

// Avvio del server
app.listen(PORT, () => {
  console.log(`🚀 Server avviato su http://localhost:${PORT}`);
  console.log(`📱 WebAuthn configurato per: ${origin}`);
  console.log(`🔐 Endpoints disponibili:`);
  console.log(`   - GET  /                      - Pagina di test`);
  console.log(`   - POST /register/begin        - Inizia registrazione passkey`);
  console.log(`   - POST /register/complete     - Completa registrazione passkey`);
  console.log(`   - POST /authenticate/begin    - Inizia autenticazione`);
  console.log(`   - POST /authenticate/complete - Completa autenticazione`);
  console.log(`   - GET  /api/current-time      - Ottieni orario (richiede auth)`);
  console.log(`   - GET  /api/auth-status       - Verifica stato autenticazione`);
  console.log(`   - POST /api/logout            - Effettua logout`);
});