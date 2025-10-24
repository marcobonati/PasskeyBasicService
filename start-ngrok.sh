#!/bin/bash

echo "🚀 Avvio del server Passkeys con ngrok..."
echo ""

# Avvia il server in background
echo "📱 Avvio del server Node.js sulla porta 3000..."
npm start &
SERVER_PID=$!

# Aspetta che il server si avvii
sleep 3

# Avvia ngrok
echo "🌐 Avvio di ngrok tunnel..."
echo ""
echo "🔗 Il tunnel ngrok sarà disponibile a breve..."
echo "📱 Usa l'URL https://*.ngrok-free.app per testare su dispositivi mobili"
echo ""
echo "⚠️  IMPORTANTE: Quando usi ngrok per la prima volta, potresti vedere"
echo "   una pagina di warning. Clicca 'Visit Site' per continuare."
echo ""
echo "🛑 Per fermare tutto: Ctrl+C"
echo ""

# Avvia ngrok
ngrok http 3000

# Quando ngrok viene fermato, ferma anche il server
echo ""
echo "🛑 Fermando il server..."
kill $SERVER_PID 2>/dev/null
echo "✅ Server fermato."