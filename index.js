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

// Configurazione WebAuthn
const rpName = 'Passkeys Server';
const rpID = process.env.RP_ID || 'localhost'; // Permette override via env var
const origin = process.env.ORIGIN || `http://${rpID}:${PORT}`;

// Storage in memoria per demo (in produzione usare un database)
const users = new Map();
const currentChallenges = new Map();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Permetti localhost e domini ngrok
    if (!origin || 
        origin.includes('localhost') || 
        origin.includes('ngrok') || 
        origin.includes('ngrok.io') ||
        origin.includes('ngrok.app') ||
        origin.includes('ngrok-free.app')) {
      callback(null, true);
    } else {
      callback(new Error('Non permesso da CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

// Middleware specifico per .well-known con headers corretti
app.use('/.well-known', express.static('static/.well-known', {
  setHeaders: (res, path) => {
    if (path.endsWith('apple-app-site-association')) {
      res.setHeader('Content-Type', 'application/json');
    }
  }
}));

// Servire altri contenuti statici
app.use(express.static('static'));

app.use(session({
  secret: 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // true in produzione con HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 ore
  }
}));

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

// Endpoint di base
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Passkeys Server</title>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 600px; margin: 0 auto; }
        button { padding: 10px 20px; margin: 10px 0; font-size: 16px; }
        .status { margin: 20px 0; padding: 10px; border-radius: 5px; }
        .success { background-color: #d4edda; color: #155724; }
        .error { background-color: #f8d7da; color: #721c24; }
        .info { background-color: #d1ecf1; color: #0c5460; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔐 Passkeys Server</h1>
        <p>Server Node.js con autenticazione WebAuthn/Passkeys</p>
        
        <div id="status" class="status info">
          Caricamento librerie...
        </div>
        
        <div id="controls" style="display: none;">
          <input type="text" id="username" placeholder="Nome utente" value="testuser">
          <br>
          <button onclick="register()">🔑 Registra Passkey</button>
          <button onclick="authenticate()">🔐 Autentica</button>
          <button onclick="getCurrentTime()">⏰ Ottieni Orario</button>
          <button onclick="logout()">🚪 Logout</button>
        </div>
        
        <div id="result"></div>
      </div>
      
      <script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
      <script src="/client.js"></script>
    </body>
    </html>
  `);
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
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
      supportedAlgorithmIDs: [-7, -257], // ES256 e RS256
    });

    // Salva il challenge per la verifica
    currentChallenges.set(userId, options.challenge);
    
    // Salva i dati temporanei dell'utente
    req.session.tempUser = { userId, username };

    console.log('Opzioni di registrazione generate:', {
      userId,
      username,
      challengeLength: options.challenge.length,
      rpID: options.rp.id,
      userIdInOptions: options.user.id,
      origin: requestOrigin
    });

    res.json(options);
  } catch (error) {
    console.error('Errore nella registrazione:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint per completare la registrazione
app.post('/register/complete', async (req, res) => {
  try {
    const { credential } = req.body;
    const tempUser = req.session.tempUser;
    
    if (!tempUser) {
      return res.status(400).json({ error: 'Sessione di registrazione non trovata' });
    }

    const expectedChallenge = currentChallenges.get(tempUser.userId);
    
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Challenge non valido' });
    }

    // Rileva automaticamente l'origine dalla richiesta
    const requestOrigin = req.get('origin') || req.get('referer')?.replace(/\/$/, '');
    const currentRpID = requestOrigin ? new URL(requestOrigin).hostname : rpID;

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: requestOrigin || origin,
      expectedRPID: currentRpID,
    });

    if (verification.verified && verification.registrationInfo) {
      // Salva l'utente con le credenziali
      users.set(tempUser.userId, {
        id: tempUser.userId,
        username: tempUser.username,
        credentials: [{
          credentialID: verification.registrationInfo.credentialID,
          credentialPublicKey: verification.registrationInfo.credentialPublicKey,
          counter: verification.registrationInfo.counter,
        }],
        createdAt: new Date()
      });

      // Pulisci i dati temporanei
      currentChallenges.delete(tempUser.userId);
      delete req.session.tempUser;

      res.json({ 
        verified: true, 
        message: 'Passkey registrata con successo!',
        userId: tempUser.userId 
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
    
    const options = await generateAuthenticationOptions({
      rpID: currentRpID,
      allowCredentials: [],
      userVerification: 'preferred',
    });

    // Salva il challenge per la verifica
    req.session.currentChallenge = options.challenge;

    res.json(options);
  } catch (error) {
    console.error('Errore nell\'autenticazione:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint per completare l'autenticazione
app.post('/authenticate/complete', async (req, res) => {
  try {
    const { credential } = req.body;
    const expectedChallenge = req.session.currentChallenge;
    
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Challenge non valido' });
    }

    // Rileva automaticamente l'origine dalla richiesta
    const requestOrigin = req.get('origin') || req.get('referer')?.replace(/\/$/, '');
    const currentRpID = requestOrigin ? new URL(requestOrigin).hostname : rpID;

    // Trova l'utente dalla credenziale
    let authenticatedUser = null;
    let matchedCredential = null;

    for (const [userId, userData] of users.entries()) {
      const userCredential = userData.credentials.find(cred => 
        Buffer.from(cred.credentialID).toString('base64url') === 
        Buffer.from(credential.id, 'base64url').toString('base64url')
      );
      
      if (userCredential) {
        authenticatedUser = userData;
        matchedCredential = userCredential;
        break;
      }
    }

    if (!authenticatedUser || !matchedCredential) {
      return res.status(400).json({ error: 'Credenziale non trovata' });
    }

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: requestOrigin || origin,
      expectedRPID: currentRpID,
      authenticator: {
        credentialID: matchedCredential.credentialID,
        credentialPublicKey: matchedCredential.credentialPublicKey,
        counter: matchedCredential.counter,
      },
    });

    if (verification.verified) {
      // Aggiorna il counter
      matchedCredential.counter = verification.authenticationInfo.newCounter;
      
      // Salva la sessione autenticata
      req.session.authenticated = true;
      req.session.userId = authenticatedUser.id;
      req.session.username = authenticatedUser.username;

      // Pulisci il challenge
      delete req.session.currentChallenge;

      res.json({ 
        verified: true, 
        message: 'Autenticazione riuscita!',
        user: {
          id: authenticatedUser.id,
          username: authenticatedUser.username
        }
      });
    } else {
      res.status(400).json({ error: 'Verifica dell\'autenticazione fallita' });
    }
  } catch (error) {
    console.error('Errore nella verifica dell\'autenticazione:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Endpoint protetto per ottenere l'orario corrente
app.get('/api/current-time', requireAuth, (req, res) => {
  const now = new Date();
  const italianTime = now.toLocaleString('it-IT', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long'
  });

  res.json({
    timestamp: now.getTime(),
    isoString: now.toISOString(),
    italianTime: italianTime,
    timezone: 'Europe/Rome',
    authenticatedUser: {
      id: req.session.userId,
      username: req.session.username
    },
    message: 'Orario corrente ottenuto con successo!'
  });
});

// Endpoint per verificare lo stato dell'autenticazione
app.get('/api/auth-status', (req, res) => {
  res.json({
    authenticated: !!req.session.authenticated,
    user: req.session.authenticated ? {
      id: req.session.userId,
      username: req.session.username
    } : null
  });
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
  console.log(`📁 Contenuti statici:`);
  console.log(`   - /static/*                   - File dalla cartella static/`);
  console.log(`   - /.well-known/*              - File well-known con headers specifici`);
  console.log(`   - /demo.json                  - File JSON di esempio`);
  console.log(`   - /images/*                   - Asset e immagini`);
});