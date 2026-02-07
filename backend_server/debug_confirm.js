const axios = require('axios');

async function testConfirm() {
    try {
        const response = await axios.post('https://hastrology-server.vercel.app/api/horoscope/confirm', {
            walletAddress: '2pKP6ZqTFixkNHi14bieZfuqbHb85MwpYWsdzzxH4dfN', // Used from user logs
            signature: 'FREE_ACCESS_bypass_payment'
        });
        console.log('Success:', response.data);
    } catch (error) {
        console.error('Error status:', error.response?.status);
        console.error('Error data:', error.response?.data);
    }
}

testConfirm();
