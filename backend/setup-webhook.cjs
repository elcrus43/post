const axios = require('axios');

async function setupWebhook() {
  const botToken = process.env.TG_NOTIFICATION_BOT_TOKEN || '8545913783:AAH6gpYMqP2zHIPc0P-7ZH2puXPZzLjz014';
  const webhookUrl = 'https://your-domain.com/api/telegram/webhook'; // амените на ваш URL
  
  // For local testing, use ngrok or similar
  // const webhookUrl = 'https://xxxx.ngrok.io/api/telegram/webhook';
  
  try {
    console.log('Setting up webhook...');
    const response = await axios.post(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      url: webhookUrl
    });
    
    if (response.data.ok) {
      console.log('✅ Webhook set successfully!');
      console.log('Webhook URL:', webhookUrl);
    } else {
      console.error('❌ Failed to set webhook:', response.data);
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

setupWebhook();
