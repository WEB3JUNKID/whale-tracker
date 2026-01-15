const express = require('express');
const { ethers } = require("ethers");
const fetch = require('node-fetch');
const config = require('./whales.json');

// --- HARDCODED CREDENTIALS ---
const TG_TOKEN = process.env.TG_TOKEN || "8382653788:AAHOyDd0fM57uGoXnjhF6R2WQTffuUzHcpE";
const TG_CHAT_ID = process.env.TG_CHAT_ID || "8382653788";
// Use a free Alchemy/Infura key here, or Render env var
const RPC_URL = process.env.RPC_URL || "https://eth-mainnet.public.blastapi.io"; 

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Web Service to satisfy Render (Keep-Alive Endpoint)
app.get('/', (req, res) => {
    res.send('Whale Tracker is Running. Ping this URL to keep awake.');
});

app.listen(PORT, () => {
    console.log(`SERVER LIVE on port ${PORT}`);
    startBlockchainListener();
});

// 2. The Logic
async function startBlockchainListener() {
    console.log("Starting Blockchain Listener...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    const abi = ["event Transfer(address indexed from, address indexed to, uint256 value)"];
    const contract = new ethers.Contract(config.KAITO_CONTRACT, abi, provider);

    // Create a cleanup set of lowercase addresses to check against
    const watchlist = config.TARGET_WHALES.map(w => w.address.toLowerCase());
    const exchanges = Object.values(config.EXCHANGES).map(a => a.toLowerCase());

    contract.on("Transfer", async (from, to, value, event) => {
        try {
            const fromLower = from.toLowerCase();
            const toLower = to.toLowerCase();

            // Check if sender is in our Whale List
            if (watchlist.includes(fromLower)) {
                const whale = config.TARGET_WHALES.find(w => w.address.toLowerCase() === fromLower);
                
                // Format Amount (KAITO has 18 decimals)
                const amount = ethers.formatUnits(value, 18);
                if (parseFloat(amount) < 1000) return; // Ignore dust

                let alertMsg = `⚠️ <b>WHALE MOVEMENT DETECTED</b>\n\n`;
                alertMsg += `🐋 <b>From:</b> ${whale.name}\n`;
                
                // Check if destination is an Exchange
                if (exchanges.includes(toLower)) {
                    alertMsg = `🚨 <b>DUMP ALERT: MOVED TO BINANCE</b> 🚨\n\n`;
                    alertMsg += `🐋 <b>From:</b> ${whale.name}\n`;
                    alertMsg += `🏦 <b>To:</b> BINANCE HOT WALLET\n`;
                } else {
                    alertMsg += `➡️ <b>To:</b> ${to.slice(0,6)}...${to.slice(-4)}\n`;
                }

                alertMsg += `💰 <b>Amount:</b> ${parseFloat(amount).toLocaleString()} KAITO\n`;
                alertMsg += `🔗 <a href="https://etherscan.io/tx/${event.log.transactionHash}">View Transaction</a>`;

                console.log("Whale Move detected, sending Telegram...");
                await sendTelegram(alertMsg);
            }
        } catch (e) {
            console.error("Error processing tx:", e);
        }
    });
}

async function sendTelegram(text) {
    const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            chat_id: TG_CHAT_ID, 
            text: text, 
            parse_mode: 'HTML',
            disable_web_page_preview: true 
        })
    });
                      }
