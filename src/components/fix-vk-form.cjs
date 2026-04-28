const fs = require('fs');
let c = fs.readFileSync('AccountsPage.tsx', 'utf8');

// Replace VK OAuth button with manual token input form
c = c.replace(
  `{/* VK */}
          {form.platform === 'vk' && (
            <div className="space-y-4 mb-4">
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex flex-col items-center text-center shadow-sm">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white mb-4 shadow-lg">
                  <PlatformIcon platform="vk" size={32} />
                </div>
                <h3 className="text-base font-bold text-blue-900 mb-2">вторизация VK ID</h3>
                <p className="text-sm text-blue-700 mb-6 max-w-sm">
                  ажмите кнопку ниже, чтобы безопасно подключить ваш аккаунт или группу через официальный сервис онтакте.
                </p>
                <button
                  onClick={() => handleOAuth('vk')}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                >
                  <ExternalLink size={18} />
                  ойти через онтакте
                </button>
              </div>
            </div>
          )}`,
  `{/* VK */}
          {form.platform === 'vk' && (
            <div className="space-y-3 mb-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
              <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wide">VK API Token</h3>
              <div>
                <label className={labelCls}>Access Token</label>
                <input className={inputCls} placeholder="vk1.a.ABCdefGHI..."
                  value={form.vkToken} onChange={(e) => setField('vkToken', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">олучить: https://dev.vk.com/method/getting-started</p>
              </div>
              <div>
                <label className={labelCls}>Owner ID</label>
                <input className={inputCls} placeholder="123456789 (положительный - группа, отрицательный - пользователь)"
                  value={form.vkOwnerId} onChange={(e) => setField('vkOwnerId', e.target.value)} />
                <p className="text-xs text-gray-400 mt-1">ля группы: положительный. ля пользователя: отрицательный</p>
              </div>
              <div className="bg-blue-100 rounded-lg p-3 text-xs text-blue-800 space-y-1">
                <p className="font-medium">ак получить Access Token:</p>
                <p>1. ткройте: https://dev.vk.com/method/getting-started</p>
                <p>2. Создайте Standalone приложение</p>
                <p>3. спользуйте Implicit Flow: https://oauth.vk.com/authorize?client_id={'<ID>'}&response_type=token</p>
                <p>4. Скопируйте token из URL (#access_token=...)</p>
              </div>
            </div>
          )}`
);

fs.writeFileSync('AccountsPage.tsx', c, 'utf8');
console.log('✅ VK OAuth replaced with manual token input');
