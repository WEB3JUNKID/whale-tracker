const express = require('express');
const { ethers } = require("ethers");
const fetch = require('node-fetch');
const config = require('./whales.json');

// --- YOUR VERIFIED CREDENTIALS ---
const TG_TOKEN = "8382653788:AAHOyDd0fM57uGoXnjhF6R2WQTffuUzHcpE";
const TG_CHAT_ID = "6138493107"; // JUNKID's Personal ID
const RPC_URL = "https://eth-mainnet.public.blastapi.io"; 

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Root Endpoint
app.get('/', (req, res) => {
    res.send('KAITO WHALE RADAR IS ACTIVE. Use /test to verify connection.');
});

// 2. THE TEST RUNNER (Visit: https://your-app.onrender.com/test)
app.get('/test', async (req, res) => {
    console.log("Manual Test Triggered...");
    const success = await sendTelegram("🔔 <b>RADAR TEST:</b> System is live. Watching KAITO Ranks 1-50.\n\nStatus: 🟢 ONLINE");
    if (success) {
        res.send("✅ Test signal sent to your Telegram!");
    } else {
        res.status(500).send("❌ Failed to send Telegram. Check your Bot Token or Chat ID.");
    }
});

app.listen(PORT, () => {
    console.log(`Radar Online on Port ${PORT}`);
    startBlockchainListener();
});

async function startBlockchainListener() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const abi = ["event Transfer(address indexed from, address indexed to, uint256 value)"];
    const contract = new ethers.Contract(config.KAITO_CONTRACT, abi, provider);

    const watchlist = config.TARGET_WHALES.map(w => w.address.toLowerCase());
    const exchanges = Object.values(config.EXCHANGES).map(a => a.toLowerCase());

    contract.on("Transfer", async (from, to, value, event) => {
        try {
            const fromLower = from.toLowerCase();
            const toLower = to.toLowerCase();

            if (watchlist.includes(fromLower)) {
                const whale = config.TARGET_WHALES.find(w => w.address.toLowerCase() === fromLower);
                const amount = ethers.formatUnits(value, 18);
                
                if (parseFloat(amount) < 5000) return; 

                let alertMsg = `🐋 <b>WHALE MOVEMENT</b>\n\n`;
                alertMsg += `<b>Holder:</b> ${whale.name}\n`;
                
                if (exchanges.includes(toLower)) {
                    alertMsg = `🚨 <b>SELL WARNING: EXCHANGE DEPOSIT</b> 🚨\n\n`;
                    alertMsg += `<b>To:</b> BINANCE/EXCHANGE\n`;
                } else {
                    alertMsg += `<b>To:</b> <code>${to}</code>\n`;
                }

                alertMsg += `<b>Amount:</b> ${parseFloat(amount).toLocaleString()} KAITO\n`;
                alertMsg += `<b>Tx:</b> <a href="https://etherscan.io/tx/${event.log.transactionHash}">Etherscan</a>`;

                await sendTelegram(alertMsg);
            }
        } catch (e) {
            console.error("Listener Error:", e);
        }
    });
}

async function sendTelegram(text) {
    const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                chat_id: TG_CHAT_ID, 
                text: text, 
                parse_mode: 'HTML',
                disable_web_page_preview: true 
            })
        });
        const data = await response.json();
        return data.ok;
    } catch (err) {
        console.log("Telegram Failed:", err);
        return false;
    }
}
