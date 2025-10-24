// Utility functions per WebAuthn
function showStatus(message, type = 'info') {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
}

function showResult(data) {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
}

function clearResult() {
    document.getElementById('result').innerHTML = '';
}

function showControls() {
    document.getElementById('controls').style.display = 'block';
}

// Verifica se SimpleWebAuthn è disponibile
function isSimpleWebAuthnReady() {
    return window.SimpleWebAuthnBrowser && 
           window.SimpleWebAuthnBrowser.startRegistration && 
           window.SimpleWebAuthnBrowser.startAuthentication;
}

// Funzione per la registrazione
async function register() {
    if (!isSimpleWebAuthnReady()) {
        showStatus('❌ SimpleWebAuthn non ancora caricato, riprova tra un momento', 'error');
        return;
    }

    try {
        clearResult();
        const username = document.getElementById('username').value.trim();
        
        if (!username) {
            showStatus('Inserisci un nome utente', 'error');
            return;
        }

        showStatus('Iniziando la registrazione...', 'info');

        // Step 1: Ottieni le opzioni di registrazione dal server
        const beginResponse = await fetch('/register/begin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username })
        });

        if (!beginResponse.ok) {
            const error = await beginResponse.json();
            throw new Error(error.error || 'Errore nella richiesta di registrazione');
        }

        const options = await beginResponse.json();
        console.log('Opzioni ricevute dal server:', options);

        // Step 2: Usa WebAuthn per creare le credenziali
        showStatus('Creazione credenziali in corso...', 'info');
        const credential = await window.SimpleWebAuthnBrowser.startRegistration(options);

        // Step 3: Invia le credenziali al server per la verifica
        showStatus('Verifica credenziali...', 'info');
        const completeResponse = await fetch('/register/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ credential })
        });

        if (!completeResponse.ok) {
            const error = await completeResponse.json();
            throw new Error(error.error || 'Errore nella verifica della registrazione');
        }

        const result = await completeResponse.json();
        showStatus('✅ Passkey registrata con successo!', 'success');
        showResult(result);

    } catch (error) {
        console.error('Errore durante la registrazione:', error);
        showStatus(`❌ Errore: ${error.message}`, 'error');
        showResult({ error: error.message });
    }
}

// Funzione per l'autenticazione
async function authenticate() {
    if (!isSimpleWebAuthnReady()) {
        showStatus('❌ SimpleWebAuthn non ancora caricato, riprova tra un momento', 'error');
        return;
    }

    try {
        clearResult();
        showStatus('Iniziando l\'autenticazione...', 'info');

        // Step 1: Ottieni le opzioni di autenticazione dal server
        const beginResponse = await fetch('/authenticate/begin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        if (!beginResponse.ok) {
            const error = await beginResponse.json();
            throw new Error(error.error || 'Errore nella richiesta di autenticazione');
        }

        const options = await beginResponse.json();

        // Step 2: Usa WebAuthn per l'autenticazione
        showStatus('Autenticazione in corso...', 'info');
        const credential = await window.SimpleWebAuthnBrowser.startAuthentication(options);

        // Step 3: Invia le credenziali al server per la verifica
        showStatus('Verifica autenticazione...', 'info');
        const completeResponse = await fetch('/authenticate/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ credential })
        });

        if (!completeResponse.ok) {
            const error = await completeResponse.json();
            throw new Error(error.error || 'Errore nella verifica dell\'autenticazione');
        }

        const result = await completeResponse.json();
        showStatus('✅ Autenticazione riuscita!', 'success');
        showResult(result);

    } catch (error) {
        console.error('Errore durante l\'autenticazione:', error);
        showStatus(`❌ Errore: ${error.message}`, 'error');
        showResult({ error: error.message });
    }
}

// Funzione per ottenere l'orario corrente
async function getCurrentTime() {
    try {
        clearResult();
        showStatus('Richiesta orario corrente...', 'info');

        const response = await fetch('/api/current-time', {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Errore nella richiesta dell\'orario');
        }

        const result = await response.json();
        showStatus('✅ Orario ottenuto con successo!', 'success');
        showResult(result);

    } catch (error) {
        console.error('Errore nell\'ottenere l\'orario:', error);
        showStatus(`❌ Errore: ${error.message}`, 'error');
        showResult({ error: error.message });
    }
}

// Funzione per il logout
async function logout() {
    try {
        clearResult();
        showStatus('Logout in corso...', 'info');

        const response = await fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Errore durante il logout');
        }

        const result = await response.json();
        showStatus('✅ Logout effettuato!', 'success');
        showResult(result);

    } catch (error) {
        console.error('Errore durante il logout:', error);
        showStatus(`❌ Errore: ${error.message}`, 'error');
        showResult({ error: error.message });
    }
}

// Verifica lo stato dell'autenticazione al caricamento della pagina
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth-status', {
            credentials: 'include'
        });

        if (response.ok) {
            const status = await response.json();
            if (status.authenticated) {
                showStatus(`✅ Autenticato come: ${status.user.username}`, 'success');
            } else {
                showStatus('🔐 Pronto per l\'autenticazione', 'info');
            }
        }
    } catch (error) {
        console.error('Errore nel verificare lo stato di autenticazione:', error);
    }
}

// Funzione chiamata quando SimpleWebAuthn è caricato
function onSimpleWebAuthnLoaded() {
    console.log('SimpleWebAuthn caricato con successo');
    
    // Verifica che tutte le funzioni necessarie siano disponibili
    if (isSimpleWebAuthnReady()) {
        showControls();
        checkAuthStatus();
        showStatus('🔐 Pronto per l\'autenticazione', 'info');
    } else {
        showStatus('❌ Errore nel caricamento di SimpleWebAuthn', 'error');
    }
}

// Inizializza l'applicazione
document.addEventListener('DOMContentLoaded', () => {
    // Verifica se SimpleWebAuthn è già caricato
    if (isSimpleWebAuthnReady()) {
        onSimpleWebAuthnLoaded();
    } else {
        // Aspetta che lo script si carichi
        const checkLoaded = setInterval(() => {
            if (isSimpleWebAuthnReady()) {
                clearInterval(checkLoaded);
                onSimpleWebAuthnLoaded();
            }
        }, 100);
        
        // Timeout dopo 10 secondi
        setTimeout(() => {
            if (!isSimpleWebAuthnReady()) {
                clearInterval(checkLoaded);
                showStatus('❌ Timeout nel caricamento di SimpleWebAuthn', 'error');
            }
        }, 10000);
    }
});