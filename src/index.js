import express from 'express';
import fetch from 'node-fetch';
import { PrivateKey, PublicKey, Signature } from 'snarkyjs';

const app = express();
const PORT = 3000;

const PYTH_ENDPOINT = 'https://xc-mainnet.pyth.network';
// FIXME: Don't put keys into static code in production!
const ORACLE_PRIVATE_KEY = 'EKFYy6VdjW2eHrPeq76VQtC5cdtxEKFL5ctCDb4pBHNAMT2p3NTf';
// const ORACLE_PUBLIC_KEY = 'B62qizxPbuzM1Ap9SCnoeX1d3nfynDDyjqAPFGNmEj1BX3pKJYQ5zdF';

const feedIds = {
    BTC: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    DAI: '0xb0948a5e5313200c632b51bb5ca32f6de0d36e9950a942d19751e833f70dabfd',
    ETH: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    BNB: '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f,'
};

async function fetchFromPyth(feedId) {
    const feedAddress = feedIds[feedId];
    const feeds = await fetch(`${PYTH_ENDPOINT}/api/latest_price_feeds?ids[]=${feedAddress}`)
        .then((response) => response.json());
    
    const feed = feeds[0];
    // We're going to use exponentially-weighted moving average (EMA) price and confidence
    const { id } = feed; 
    const { conf, expo, price, publish_time } = feed["ema_price"];

    const meanPrice = parseInt(price) * (10 ** expo);
    const confidenceInterval = parseInt(conf) * (10 ** expo);
    const publishTime = publish_time;

    const privateKey = PrivateKey.fromBase58(ORACLE_PRIVATE_KEY);
    const publicKey = PublicKey.fromPrivateKey(privateKey).toBase58();
    const signature = Signature.create(sk, [id, meanPrice, confidenceInterval, publishTime]).toJSON();

    return {
        data: { id, meanPrice, confidenceInterval, publishTime },
        signature,
        publicKey,
    };
}

app.get('/feeds/:feedId', async (req, res) => {
    const { feedId } = req.params;
    if (!feedIds[feedId]) { 
        res.status(404).json({ error: `Unknown feed: ${feedId}`});
        return;
    }

    const pyth = await fetchFromPyth(feedId);
    res.status(200).json(pyth);
});

app.listen(PORT, (error) =>{
	if(!error)
		console.log("Server is Successfully Running, and App is listening on port "+ PORT)
	else
		console.log("Error occurred, server can't start", error);
	}
);

// Example output from Pyth
// [
//     {
//         "ema_price": { "conf": "67209737", "expo": -8, "price": "113969287000", "publish_time": 1669171884 },
//         "id": "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
//         "price": { "conf": "132398898", "expo": -8, "price": "115946101102", "publish_time": 1669171884 }
//     }
// ]