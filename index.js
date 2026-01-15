const express = require('express');
const { ethers } = require("ethers");
const fetch = require('node-fetch');
const config = require('./whales.json');

// --- SETUP ---
const TG_TOKEN = "8382653788:AAHOyDd0fM57uGoXnjhF6R2WQTffuUzHcpE";
const TG_CHAT_ID = "6138493107"; 
const RPC_URL = "https://eth-mainnet.public.blastapi.io"; 

const app = express();
const PORT = process.env.PORT || 3000;
const provider = new ethers.JsonRpcProvider(RPC_URL);

// --- ROUTES ---

// 1. Home Route (For UptimeRobot)
app.get('/', (req, res) => {
    res.send('KAITO RADAR ACTIVE 🟢 Monitoring Whales...');
});

// 2. Test Route (To verify Telegram)
app.get('/test', async (req, res) => {
    console.log("Manual Test Triggered...");
    const success = await sendTelegram("🔔 <b>RADAR TEST:</b> System is live and listening for whales.");
    if (success) {
        res.send("✅ Test signal sent to your Telegram!");
    } else {
        res.status(500).send("❌ Failed to send Telegram message. Check your bot token.");
    }
});

// --- FUNCTIONS ---

async function getKaitoPrice() {
    try {
        const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${config.KAITO_CONTRACT}`);
        const data = await response.json();
        return data.pairs && data.pairs[0] ? parseFloat(data.pairs[0].priceUsd) : 0;
    } catch (e) { return 0; }
}

async function sendTelegram(text) {
    try {
        const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true })
        });
        const data = await res.json();
        return data.ok;
    } catch (e) { 
        console.error("TG Error", e); 
        return false;
    }
}

async function startBlockchainListener() {
    const abi = ["event Transfer(address indexed from, address indexed to, uint256 value)"];
    const contract = new ethers.Contract(config.KAITO_CONTRACT, abi, provider);

    const whaleAddrs = config.TARGET_WHALES.map(w => w.address.toLowerCase());
    const exchAddrs = Object.values(config.EXCHANGES).map(a => a.toLowerCase());

    console.log("Radar is live and listening for KAITO movements...");

    contract.on("Transfer", async (from, to, value, event) => {
        try {
            const fromLower = from.toLowerCase();
            const toLower = to.toLowerCase();

            if (whaleAddrs.includes(fromLower)) {
                const whale = config.TARGET_WHALES.find(w => w.address.toLowerCase() === fromLower);
                const amount = parseFloat(ethers.formatUnits(value, 18));
                
                if (amount < 5000) return;

                const price = await getKaitoPrice();
                const usdValue = (amount * price).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
                const ethBalance = await provider.getBalance(to);
                
                let title = "🐋 <b>WHALE MOVEMENT</b>";
                let destination = `<code>${to.substring(0, 10)}...</code>`;

                if (exchAddrs.includes(toLower)) {
                    title = "🚨 <b>SELL ALERT: DIRECT EXCHANGE</b> 🚨";
                    const exName = Object.keys(config.EXCHANGES).find(k => config.EXCHANGES[k].toLowerCase() === toLower);
                    destination = `🏛 <b>${exName}</b>`;
                } else if (whaleAddrs.includes(toLower)) {
                    title = "🔄 <b>INTERNAL ROTATION</b>";
                    const target = config.TARGET_WHALES.find(w => w.address.toLowerCase() === toLower);
                    destination = `👤 <b>${target.name}</b>`;
                } else if (ethBalance === 0n) {
                    title = "⚠️ <b>POTENTIAL SELL: FRESH WALLET</b>";
                    destination = "❓ <b>Unknown (0 ETH)</b>\n<i>(Probable CEX Deposit)</i>";
                }

                let msg = `${title}\n\n`;
                msg += `<b>Value:</b> 💰 <b>${usdValue}</b>\n`;
                msg += `<b>Amount:</b> ${amount.toLocaleString()} KAITO\n\n`;
                msg += `<b>From:</b> ${whale.name}\n`;
                msg += `<b>To:</b> ${destination}\n\n`;
                msg += `🔗 <a href="https://etherscan.io/tx/${event.log.transactionHash}">Etherscan</a> | `;
                msg += `<a href="https://platform.arkhamintelligence.com/explorer/address/${to}">Arkham</a>`;

                await sendTelegram(msg);
            }
        } catch (e) { console.error("Listener Error:", e); }
    });
}

// Start Server
app.listen(PORT, () => {
    console.log(`Radar active on port ${PORT}`);
    startBlockchainListener();
});
