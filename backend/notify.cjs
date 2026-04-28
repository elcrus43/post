const axios = require('axios');

async function notifyQueue(item) { 
  try { 
    const botToken = process.env.TG_NOTIFICATION_BOT_TOKEN; 
    const chatId = process.env.TG_NOTIFICATION_CHAT_ID; 
    if (!botToken || !chatId) return; 
    
    let text = item.original_text || '';
    
    const linkMatch = text.match(/\n\n\[LINK\] (.+)$/s);
    let linkUrl = '';
    if (linkMatch) {
      linkUrl = linkMatch[1];
      text = text.replace(/\n\n\[LINK\] .+$/s, '');
    }
    
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/[ \t]+$/gm, '');
    text = text.replace(/^\s+/, '');
    text = text.trim();
    
    if (text.length > 300) {
      text = text.substring(0, 300).trim() + '...';
    }
    
    if (linkUrl) {
      text = text + '\n\n' + '<a href="' + linkUrl + '">Ссылка</a>';
    }
    
    // Only approve button - no reject (default is not publishing)
    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ публиковать', callback_data: 'approve_' + item.id }
        ]
      ]
    };
    
    await axios.post('https://api.telegram.org/bot' + botToken + '/sendMessage', { 
      chat_id: chatId, 
      text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
      disable_web_page_preview: false
    }); 
    
    console.log('[notify] Telegram notification sent with approve button only');
  } catch (e) { 
    console.error('[notify] Error:', e.message); 
  } 
} 

module.exports = { notifyQueue };
