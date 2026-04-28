const fs = require('fs');
const file = 'src/components/AccountsPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// Find VK section and replace entire block
const start = content.indexOf('{/* VK */}');
const end = content.indexOf('{/* OK */}');

if (start !== -1 && end !== -1) {
  const newVK = `{/* VK */}
          {form.platform === 'vk' && (
            <div className="space-y-3 mb-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
              <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wide">VK API Token</h3>
              <div>
                <label className={labelCls}>Access Token</label>
                <input className={inputCls} placeholder="vk1.a.ABCdefGHI..."
                  value={form.vkToken} onChange={(e) => setField('vkToken', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">олучить: https://oauth.vk.com/authorize?client_id=54556245&response_type=token</p>
              </div>
              <div>
                <label className={labelCls}>Owner ID</label>
                <input className={inputCls} placeholder="1850087"
                  value={form.vkOwnerId} onChange={(e) => setField('vkOwnerId', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">ля группы: положительный. ля пользователя: отрицательный</p>
              </div>
            </div>
          )}

          `;
  
  content = content.substring(0, start) + newVK + content.substring(end);
  fs.writeFileSync(file, content, 'utf8');
  console.log('✅ VK form replaced successfully!');
} else {
  console.log('❌ Could not find VK or OK section');
  console.log('Start:', start, 'End:', end);
}
