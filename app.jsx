const { useState, useEffect, useRef } = React;
const { createClient } = supabase;
const SUPABASE_URL = 'https://vvvsuoadoawdivzyjmnh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_csF0Yu6fNHfJy2VhNmL1ZA_mkxPGoTP';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// [CSS 인젝션] 더 정교한 애니메이션과 스크롤바 디자인
const styleTag = document.createElement('style');
styleTag.textContent = `
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulseRed { 0% { box-shadow: 0 0 0 0 rgba(153, 27, 27, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(153, 27, 27, 0); } 100% { box-shadow: 0 0 0 0 rgba(153, 27, 27, 0); } }
  .animate-fade-up { animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .pulse-red { animation: pulseRed 2s infinite; }
  .custom-scrollbar::-webkit-scrollbar { width: 5px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: #000; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #441111; border-radius: 0px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #991b1b; }
  input:focus, textarea:focus, select:focus { border-color: #991b1b !important; box-shadow: 0 0 10px rgba(153, 27, 27, 0.2); }
`;
document.head.appendChild(styleTag);

/* -------------------------------------------------------------------------- */
/* 하위 컴포넌트                                                               */
/* -------------------------------------------------------------------------- */

// 결투 신청 모달
const DuelRequestModal = ({ isOpen, mailData, onAccept, onReject }) => {
  if (!isOpen || !mailData) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-xl">
      <div className="relative w-[450px] border border-red-900 bg-[#0a0000] p-12 shadow-[0_0_100px_rgba(139,0,0,0.5)] animate-fade-up">
        <div className="mb-4 text-center">
          <span className="text-[10px] tracking-[0.6em] text-red-600 font-black uppercase opacity-60">System Notification</span>
        </div>
        <h2 className="mb-10 text-center text-5xl font-black text-white italic tracking-tighter leading-none border-b border-red-900 pb-6">DUEL INVITATION</h2>
        <div className="mb-14 text-center">
          <p className="text-xl text-zinc-400 font-medium leading-relaxed">
            <span className="text-white font-black bg-red-900/30 px-2 py-1">[{mailData.sender_name}]</span> 님이<br />
            결투를 신청했습니다.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <button onClick={() => onAccept(mailData.id)} className="w-full bg-red-700 py-6 text-2xl font-black text-white transition-all hover:bg-red-600 active:scale-95 shadow-lg uppercase tracking-widest">Accept Duel</button>
          <button onClick={() => onReject(mailData.id)} className="w-full bg-transparent py-3 text-xs font-bold text-zinc-700 transition-colors hover:text-red-900 uppercase tracking-widest">Decline</button>
        </div>
      </div>
    </div>
  );
};

// 주식 시장 컴포넌트
const StockMarket = ({ user, fetchUserList }) => {
  const [stocks, setStocks] = useState([]);
  const [myStocks, setMyStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshMarket = async () => {
    const { data: sData } = await supabaseClient.from('stocks').select('*').order('name');
    const { data: uData } = await supabaseClient.from('user_stocks').select('*').eq('user_code', user.code);
    setStocks(sData || []);
    setMyStocks(uData || []);
    setLoading(false);
  };

  useEffect(() => {
    refreshMarket();
    const interval = setInterval(refreshMarket, 10000);
    return () => clearInterval(interval);
  }, [user.code]);

  const handleTrade = async (type, stock, price) => {
    const qtyInput = prompt(`${stock.name} ${type === 'BUY' ? '매수' : '매도'} 수량을 입력하세요.`);
    const qty = parseInt(qtyInput);
    if (!qty || qty <= 0) return;
    if (type === 'BUY') {
      if (user.points < qty * price) return alert("PTS가 부족합니다.");
      const pos = myStocks.find(s => s.stock_name === stock.name);
      if (pos) {
        const newQty = pos.quantity + qty;
        const newAvg = Math.floor((pos.avg_price * pos.quantity + qty * price) / newQty);
        await supabaseClient.from('user_stocks').update({ quantity: newQty, avg_price: newAvg }).eq('id', pos.id);
      } else {
        await supabaseClient.from('user_stocks').insert([{ user_code: user.code, stock_name: stock.name, quantity: qty, avg_price: price }]);
      }
      await supabaseClient.from('users').update({ points: user.points - (qty * price) }).eq('code', user.code);
    } else {
      const pos = myStocks.find(s => s.stock_name === stock.name);
      if (!pos || pos.quantity < qty) return alert("보유 수량이 부족합니다.");
      if (pos.quantity === qty) await supabaseClient.from('user_stocks').delete().eq('id', pos.id);
      else await supabaseClient.from('user_stocks').update({ quantity: pos.quantity - qty }).eq('id', pos.id);
      await supabaseClient.from('users').update({ points: user.points + (qty * price) }).eq('code', user.code);
    }
    fetchUserList(); refreshMarket();
  };

  if (loading) return <div className="text-center py-40 animate-pulse text-red-900 font-black tracking-widest uppercase">Initializing Market Stream...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 animate-fade-up">
      <div className="bg-[#050505] border border-zinc-900 p-10">
        <h3 className="text-red-600 font-black italic mb-10 uppercase tracking-[0.3em] border-l-4 border-red-900 pl-6">Live Quotes</h3>
        <div className="space-y-6">
          {stocks.map(s => (
            <div key={s.id} className="p-6 border border-zinc-900 bg-black flex justify-between items-center group hover:border-red-900 transition-all">
              <div>
                <div className="text-white font-black italic text-xl uppercase tracking-tighter">{s.name}</div>
                <div className={`text-[11px] font-black ${s.change_rate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>{s.change_rate >= 0 ? '▲' : '▼'} {Math.abs(s.change_rate || 0).toFixed(2)}%</div>
              </div>
              <div className="flex items-center gap-8">
                <span className="text-3xl font-black text-zinc-300 italic tracking-tighter">{s.current_price?.toLocaleString()}</span>
                <div className="flex gap-2">
                  <button onClick={() => handleTrade('BUY', s, s.current_price)} className="bg-red-900/10 border border-red-900 px-5 py-3 text-red-600 text-[11px] font-black hover:bg-red-900 hover:text-white transition-all uppercase tracking-widest">Buy</button>
                  <button onClick={() => handleTrade('SELL', s, s.current_price)} className="bg-blue-900/10 border border-blue-900 px-5 py-3 text-blue-600 text-[11px] font-black hover:bg-blue-900 hover:text-white transition-all uppercase tracking-widest">Sell</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-[#050505] border border-zinc-900 p-10">
        <h3 className="text-zinc-500 font-black italic mb-10 uppercase tracking-[0.3em] border-l-4 border-zinc-800 pl-6">My Portfolio</h3>
        <div className="space-y-6">
          {myStocks.length > 0 ? myStocks.map(ms => {
            const cur = stocks.find(s => s.name === ms.stock_name)?.current_price || 0;
            const profit = (cur - ms.avg_price) * ms.quantity;
            return (
              <div key={ms.id} className="p-6 border border-zinc-900 bg-black flex justify-between items-center">
                <div>
                  <div className="text-zinc-400 font-black uppercase italic">{ms.stock_name}</div>
                  <div className="text-[10px] text-zinc-700 font-black tracking-widest">QTY: {ms.quantity} | AVG: {ms.avg_price.toLocaleString()}</div>
                </div>
                <div className={`text-2xl font-black italic ${profit >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  {profit >= 0 ? '+' : ''}{profit.toLocaleString()} <span className="text-[10px]">PTS</span>
                </div>
              </div>
            );
          }) : <div className="py-24 text-center text-zinc-800 italic border border-dashed border-zinc-900 uppercase font-black tracking-widest">No Active Positions</div>}
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 메인 앱                                                                    */
/* -------------------------------------------------------------------------- */

function App() {
  const [user, setUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [mails, setMails] = useState([]);
  const [shopItems, setShopItems] = useState([]); 
  const [inventory, setInventory] = useState([]);
  const [userHistory, setUserHistory] = useState([]); 
  const [view, setView] = useState('home'); 
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isMailFormOpen, setIsMailFormOpen] = useState(false);
  const [isAdminMailOpen, setIsAdminMailOpen] = useState(false);
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState(false);
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [isDuelModalOpen, setIsDuelModalOpen] = useState(false);
  const [pendingDuel, setPendingDuel] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loginData, setLoginData] = useState({ id: '', pw: '' });
  
  // 메일 폼 데이터 (필드 확장)
  const [mailForm, setMailForm] = useState({ 
    category: '건의사항', 
    title: '', 
    targetUser: '', 
    content: '', 
    selectedGiftItem: '',
    importance: 'NORMAL' 
  });
  
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const channelRef = useRef(null);
  const LOGO_URL = '4.png';
  
  // 데이터 로딩 로직
  const fetchShopItems = async () => {
    const { data } = await supabaseClient.from('shop_items').select('*').order('price', { ascending: true });
    setShopItems(data || []);
  };

  const fetchInventory = async () => {
    if (!user) return;
    const { data } = await supabaseClient.from('user_inventory').select('*').eq('user_code', user.code).order('created_at', { ascending: false });
    setInventory(data || []);
  };

  const fetchUserHistory = async () => {
    if (!user) return;
    const { data } = await supabaseClient.from('user_history').select('*').eq('user_code', user.code).order('created_at', { ascending: false });
    setUserHistory(data || []);
  };

  const fetchUserList = async () => {
    if (!user) return;
    const { data } = await supabaseClient.from('users').select('*').order('name', { ascending: true });
    setAllUsers(data || []);
    const updatedUser = data?.find(u => u.code === user.code);
    if (updatedUser) setUser(updatedUser);
  };

  const fetchAllMails = async () => {
    if (!user) return;
    const { data } = await supabaseClient.from('mails').select('*').order('created_at', { ascending: false });
    setMails(data || []);
  };

  useEffect(() => { 
    fetchShopItems();
    if (!user) return;
    fetchUserList(); 
    fetchAllMails();
    fetchInventory();
    fetchUserHistory();

    const channel = supabaseClient
      .channel('arena_global_v7')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mails' }, (payload) => { 
        fetchAllMails(); 
        if (payload.new && payload.new.receiver_code === user.code && payload.new.status === '처리대기') {
          if (payload.new.title.includes('[사유서]')) { setPendingDuel(payload.new); setIsDuelModalOpen(true); }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_history' }, () => { fetchUserHistory(); })
      .subscribe();
    channelRef.current = channel;
    return () => { if (channelRef.current) supabaseClient.removeChannel(channelRef.current); };
  }, [user?.code]);

  // 핸들러
  const handlePurchase = async () => {
    if (!user || !selectedItem) return;
    if (user.points < selectedItem.price) return alert('PTS가 부족합니다.');
    if (!confirm(`[${selectedItem.name}]을 구매하시겠습니까?`)) return;
    try {
      await supabaseClient.from('users').update({ points: user.points - selectedItem.price }).eq('code', user.code);
      await supabaseClient.from('user_inventory').insert([{ user_code: user.code, item_name: selectedItem.name }]);
      await supabaseClient.from('user_history').insert([{ user_code: user.code, activity: `[상점] ${selectedItem.name} 구매`, amount: -selectedItem.price }]);
      alert('완료'); setSelectedItem(null); fetchUserList(); fetchInventory(); fetchUserHistory();
    } catch (err) { alert('오류'); }
  };

  const handleLogin = async () => {
    const { data } = await supabaseClient.from('users').select('*').eq('login_id', loginData.id).eq('password', loginData.pw).single();
    if (data) { setUser(data); setIsLoginOpen(false); } 
    else { alert('인증 실패'); }
  };

  const sendMail = async () => {
    const isGift = mailForm.category === '선물하기';
    let targetInvItem = null;
    if (isGift) {
      if (!mailForm.targetUser || !mailForm.selectedGiftItem) return alert('대상과 아이템을 선택하세요.');
      targetInvItem = inventory.find(i => i.item_name === mailForm.selectedGiftItem);
      if (!targetInvItem) return alert('아이템이 없습니다.');
    }
    setIsUploading(true);
    try {
      let receiverCode = (mailForm.category === '사유서' || mailForm.category === '선물하기') 
        ? (mailForm.targetUser.match(/[\[\(](.*?)[\]\)]/) || [])[1] : 'ADMIN';
      const { error } = await supabaseClient.from('mails').insert([{ 
        sender_name: user.name, sender_code: user.code, receiver_code: receiverCode, 
        title: `[${mailForm.category}] ${mailForm.title || mailForm.targetUser}`, content: mailForm.content, status: '처리대기', is_read: false 
      }]);
      if (!error) {
        if (isGift) {
          await supabaseClient.from('user_inventory').delete().eq('id', targetInvItem.id);
          await supabaseClient.from('user_history').insert([{ user_code: user.code, activity: `[선물] ${mailForm.targetUser}에게 ${targetInvItem.item_name} 전송` }]);
        }
        alert('전송 완료'); setIsMailFormOpen(false); fetchAllMails(); fetchInventory(); fetchUserHistory();
      }
    } catch (err) { alert('실패'); } finally { setIsUploading(false); }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-400 font-serif selection:bg-red-900 selection:text-white overflow-x-hidden custom-scrollbar">
      {/* GNB */}
      <nav className="px-10 py-6 flex justify-between items-center border-b border-red-950/30 bg-black/95 backdrop-blur-2xl sticky top-0 z-50">
        <div className="flex items-center gap-16">
          <img src={LOGO_URL} className="h-10 cursor-pointer hover:scale-110 transition-transform filter brightness-125" onClick={() => setView('home')} />
          <div className="flex gap-12 items-center text-[10px] font-black tracking-[0.5em] uppercase">
             <button onClick={() => setView('home')} className={`hover:text-white transition-colors ${view === 'home' ? 'text-white border-b-2 border-red-700 pb-1' : 'text-zinc-700'}`}>[ Home ]</button>
             <button onClick={() => setView('shop')} className={`hover:text-red-500 transition-colors ${view === 'shop' ? 'text-red-600 border-b-2 border-red-700 pb-1' : 'text-zinc-700'}`}>[ Black Market ]</button>
             <button onClick={() => setView('stock')} className={`hover:text-yellow-600 transition-colors ${view === 'stock' ? 'text-yellow-600 border-b-2 border-yellow-700 pb-1' : 'text-zinc-700'}`}>[ Exchange ]</button>
             {user?.is_admin && <button onClick={() => setIsUserMgmtOpen(true)} className="text-red-600 hover:text-red-400 animate-pulse">[ Management ]</button>}
          </div>
        </div>
        <div className="flex gap-8 items-center">
          {user ? (
            <div className="flex gap-8 items-center">
              {user.is_admin && <button onClick={() => setIsAdminMailOpen(true)} className="text-red-600 text-2xl hover:scale-125 transition-transform">📬</button>}
              <button onClick={() => setIsUserProfileOpen(true)} className="text-red-600 font-black italic border-b border-red-900 tracking-tighter hover:text-red-400 transition-all">{user.name} ▾</button>
              <button onClick={() => setUser(null)} className="text-[9px] text-zinc-700 hover:text-white border border-zinc-900 px-4 py-1.5 uppercase font-black tracking-widest transition-all">Logout</button>
            </div>
          ) : <button onClick={() => setIsLoginOpen(true)} className="text-red-700 font-black text-[10px] border border-red-900 px-10 py-3 hover:bg-red-900 hover:text-white transition-all italic tracking-[0.2em]">CONNECT</button>}
        </div>
      </nav>

      {/* 메인 뷰 */}
      <div>
        {view === 'home' && (
          <main className="flex flex-col items-center justify-center pt-64 text-center px-6 animate-fade-up">
            <h1 className="text-[110px] font-black text-white italic tracking-tighter leading-none mb-8 uppercase opacity-90 select-none">"Arena Never Sleeps"</h1>
            <div className="w-32 h-[2px] bg-red-900 mb-10 shadow-[0_0_15px_rgba(153,27,27,0.8)]"></div>
            <p className="text-zinc-800 italic text-2xl tracking-[0.4em] uppercase font-light">The victory is the only record that matters.</p>
          </main>
        )}
        {view === 'shop' && (
          <main className="max-w-7xl mx-auto pt-24 px-10 pb-40 animate-fade-up">
            <div className="flex justify-between items-end mb-20 border-l-8 border-red-900 pl-10 py-4">
              <div><h2 className="text-7xl font-black text-white italic uppercase mb-2 tracking-tighter">Black Market</h2><p className="text-red-900 font-black tracking-[0.6em] text-[11px] uppercase">Classified / Restricted Access</p></div>
              <div className="text-right"><span className="text-5xl font-black text-red-600 italic tracking-tighter">{user ? user.points.toLocaleString() : '---'} <span className="text-sm ml-2">PTS</span></span></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
              {shopItems.map((item) => (
                <div key={item.id} onClick={() => setSelectedItem(item)} className="group cursor-pointer bg-[#050505] border border-zinc-900 p-1 hover:border-red-600 transition-all duration-700">
                  <div className="aspect-[4/3] bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden">
                    {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000" /> : <span className="text-zinc-900 font-black text-6xl uppercase italic">{item.name}</span>}
                  </div>
                  <div className="p-8 bg-black border-t border-zinc-900 group-hover:border-red-900 transition-colors">
                    <div className="flex justify-between items-start mb-4"><h3 className="text-2xl font-black text-zinc-500 italic group-hover:text-white uppercase tracking-tighter transition-colors">{item.name}</h3><span className="text-red-700 font-black italic">{item.price?.toLocaleString()} PTS</span></div>
                    <p className="text-zinc-700 text-[12px] italic leading-relaxed">{item.desc_text}</p>
                  </div>
                </div>
              ))}
            </div>
          </main>
        )}
        {view === 'stock' && (
          <main className="max-w-7xl mx-auto pt-24 px-10 pb-40 animate-fade-up">
            <div className="flex justify-between items-end mb-20 border-l-8 border-yellow-700 pl-10 py-4">
              <div><h2 className="text-7xl font-black text-white italic uppercase mb-2 tracking-tighter">Exchange</h2><p className="text-yellow-700 font-black tracking-[0.6em] text-[11px] uppercase">Global Risk & Volatility</p></div>
              <div className="text-right"><span className="text-5xl font-black text-yellow-600 italic tracking-tighter">{user ? user.points.toLocaleString() : '---'} <span className="text-sm ml-2">PTS</span></span></div>
            </div>
            {user ? <StockMarket user={user} fetchUserList={fetchUserList} /> : <div className="text-center py-60 text-red-900 font-black uppercase tracking-[1em] opacity-30">Authentication Required</div>}
          </main>
        )}
      </div>

      {/* 결투 모달 */}
      <DuelRequestModal isOpen={isDuelModalOpen} mailData={pendingDuel} onAccept={(id) => supabaseClient.from('mails').update({ status: '서명완료' }).eq('id', id).then(() => setIsDuelModalOpen(false))} onReject={(id) => supabaseClient.from('mails').update({ status: '거절' }).eq('id', id).then(() => setIsDuelModalOpen(false))} />

      {/* 폼: Transmission Center (완벽 복구 및 강화) */}
      {isMailFormOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/98 p-4 backdrop-blur-xl">
          <div className="bg-[#030303] border border-red-900 w-full max-w-2xl p-1 animate-fade-up shadow-[0_0_80px_rgba(0,0,0,1)]">
            <div className="border border-red-900/30 p-12 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-900 to-transparent opacity-50"></div>
              
              <div className="flex justify-between items-center mb-16">
                <div>
                  <h3 className="text-red-700 font-black italic text-3xl uppercase tracking-tighter">Transmission</h3>
                  <p className="text-[9px] text-zinc-700 font-black tracking-[0.5em] uppercase">Secure Protocol Active</p>
                </div>
                <button onClick={() => setIsMailFormOpen(false)} className="text-zinc-800 hover:text-red-800 transition-colors text-3xl">✕</button>
              </div>

              <div className="space-y-10">
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <label className="text-[9px] text-zinc-600 font-black uppercase tracking-widest ml-1">Protocol Type</label>
                     <select className="w-full bg-black border border-zinc-900 p-5 text-zinc-400 font-black uppercase text-[11px] tracking-widest outline-none transition-all" value={mailForm.category} onChange={(e) => setMailForm({...mailForm, category: e.target.value})}>
                        <option value="건의사항">Opinion / 건의</option>
                        <option value="사유서">Duel / 결투 사유서</option>
                        <option value="선물하기">Gift / 아이템 선물</option>
                     </select>
                   </div>
                   <div className="space-y-2">
                     <label className="text-[9px] text-zinc-600 font-black uppercase tracking-widest ml-1">Priority</label>
                     <select className="w-full bg-black border border-zinc-900 p-5 text-zinc-400 font-black uppercase text-[11px] tracking-widest outline-none transition-all" onChange={(e) => setMailForm({...mailForm, importance: e.target.value})}>
                        <option value="NORMAL">Normal</option>
                        <option value="HIGH">High Priority</option>
                        <option value="URGENT text-red-600">Urgent</option>
                     </select>
                   </div>
                </div>

                {mailForm.category === '선물하기' && (
                  <div className="space-y-2 animate-fade-up">
                    <label className="text-[9px] text-red-900 font-black uppercase tracking-widest ml-1">Attachment (Inventory)</label>
                    <select className="w-full bg-[#0a0000] border border-red-900/40 p-5 text-white font-black text-xs outline-none" onChange={(e) => setMailForm({...mailForm, selectedGiftItem: e.target.value})}>
                      <option value="">-- SELECT ITEM FROM INVENTORY --</option>
                      {inventory.map((inv, idx) => (<option key={idx} value={inv.item_name}>{inv.item_name}</option>))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[9px] text-zinc-600 font-black uppercase tracking-widest ml-1">Recipient / Subject</label>
                  <input type="text" placeholder="RECIPIENT CODE OR SUBJECT..." className="w-full bg-black border border-zinc-900 p-5 text-white italic outline-none text-sm tracking-tight" list="userList" onChange={(e) => setMailForm({...mailForm, targetUser: e.target.value, title: e.target.value})} />
                  <datalist id="userList">{allUsers.map(u => <option key={u.code} value={`${u.name}(${u.code})`} />)}</datalist>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] text-zinc-600 font-black uppercase tracking-widest ml-1">Encoded Message</label>
                  <textarea rows="6" className="w-full bg-black border border-zinc-900 p-5 text-white italic outline-none text-sm leading-relaxed custom-scrollbar" placeholder="ENTER MESSAGE CONTENT..." onChange={(e) => setMailForm({...mailForm, content: e.target.value})}></textarea>
                </div>

                <div className="pt-6 flex gap-4">
                  <button onClick={sendMail} disabled={isUploading} className="flex-[2] bg-red-900 py-6 font-black text-white hover:bg-red-700 uppercase tracking-[0.4em] text-xs disabled:opacity-50 transition-all shadow-lg active:scale-95">Execute Transmission</button>
                  <button onClick={() => setIsMailFormOpen(false)} className="flex-1 border border-zinc-900 py-6 font-black text-zinc-700 hover:text-white uppercase tracking-[0.2em] text-[10px] transition-all">Abort</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상점 상세 모달 */}
      {selectedItem && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/98 p-4 backdrop-blur-3xl">
          <div className="bg-black border border-red-900 w-full max-w-3xl p-16 relative animate-fade-up shadow-2xl">
            <button onClick={() => setSelectedItem(null)} className="absolute top-10 right-12 text-zinc-800 hover:text-white text-5xl transition-colors">✕</button>
            <h3 className="text-red-600 font-black italic text-6xl uppercase mb-12 tracking-tighter border-b border-red-900 pb-8">{selectedItem.name}</h3>
            <div className="bg-[#050505] border border-zinc-900 p-12 mb-16 border-l-8 border-l-red-900 shadow-inner">
              <p className="text-zinc-400 italic text-xl leading-relaxed font-light">{selectedItem.detail_text}</p>
            </div>
            <div className="flex justify-between items-center pt-8">
              <div className="flex flex-col">
                <span className="text-[10px] text-zinc-700 font-black uppercase tracking-[0.4em] mb-2">Required Credit</span>
                <span className="text-5xl font-black text-white italic tracking-tighter">{selectedItem.price?.toLocaleString()} <span className="text-lg">PTS</span></span>
              </div>
              <button onClick={handlePurchase} className="bg-red-800 px-16 py-7 text-white font-black hover:bg-red-600 uppercase text-sm tracking-[0.3em] transition-all active:scale-95 shadow-[0_0_30px_rgba(153,27,27,0.3)]">Acquire Item</button>
            </div>
          </div>
        </div>
      )}

      {/* 프로필 및 활동기록 모달 */}
      {isUserProfileOpen && user && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/99 p-4 backdrop-blur-3xl">
          <div className="bg-[#050505] border-2 border-red-800 w-full max-w-2xl p-1 animate-fade-up shadow-2xl">
            <div className="border border-red-900/20 p-14 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-start mb-14">
                <div>
                  <span className="text-red-900 font-black text-[11px] tracking-[0.6em] uppercase block mb-3 opacity-60">Citizen ID: {user.code}</span>
                  <h2 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none">{user.name}</h2>
                </div>
                <button onClick={() => setIsUserProfileOpen(false)} className="text-zinc-800 hover:text-white text-4xl transition-colors">✕</button>
              </div>

              <div className="bg-black border border-zinc-900 p-10 flex justify-between items-center mb-12 shadow-[inset_0_0_20px_rgba(0,0,0,1)]">
                  <span className="text-zinc-600 font-black uppercase text-[11px] tracking-[0.4em]">Net Worth</span>
                  <span className="text-5xl font-black text-red-600 italic tracking-tighter">{user.points.toLocaleString()} <span className="text-xs text-zinc-800 ml-3">PTS</span></span>
              </div>
              
              <div className="mb-14">
                <h3 className="text-zinc-700 font-black text-[12px] tracking-[0.5em] uppercase mb-6 italic border-b border-zinc-900 pb-2">Activity Archive</h3>
                <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-4">
                  {userHistory.length > 0 ? userHistory.map((h, idx) => (
                    <div key={idx} className="bg-[#030303] border border-zinc-900/50 p-5 flex justify-between items-center hover:bg-zinc-950 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-700 font-mono mb-2">{new Date(h.created_at).toLocaleString()}</span>
                        <span className="text-zinc-400 text-sm font-black uppercase tracking-tight italic">{h.activity}</span>
                      </div>
                      {h.amount && <span className={`text-lg font-black italic ${h.amount > 0 ? 'text-red-600' : 'text-blue-600'}`}>{h.amount > 0 ? '+' : ''}{h.amount.toLocaleString()}</span>}
                    </div>
                  )) : <div className="text-zinc-900 italic text-xs py-10 text-center border border-dashed border-zinc-900 uppercase tracking-widest font-black">Archive Empty</div>}
                </div>
              </div>

              <div className="mb-10">
                <h3 className="text-zinc-700 font-black text-[12px] tracking-[0.5em] uppercase mb-6 italic border-b border-zinc-900 pb-2">Inventory Assets</h3>
                <div className="grid grid-cols-2 gap-3">
                  {inventory.length > 0 ? inventory.map((inv, idx) => (
                    <div key={idx} className="bg-black border border-zinc-900 p-5 flex items-center gap-4 group hover:border-red-900 transition-colors">
                      <div className="w-2 h-2 bg-red-900 rounded-full group-hover:animate-pulse"></div>
                      <span className="text-zinc-500 text-xs italic font-black uppercase tracking-tighter group-hover:text-white transition-colors">{inv.item_name}</span>
                    </div>
                  )) : <div className="col-span-2 text-zinc-900 italic text-xs py-10 text-center border border-dashed border-zinc-900 uppercase tracking-widest font-black">No Assets Found</div>}
                </div>
              </div>
              <button onClick={() => setIsUserProfileOpen(false)} className="w-full mt-8 border border-zinc-900 py-5 text-[10px] font-black text-zinc-700 hover:text-white hover:bg-zinc-950 transition-all uppercase tracking-[0.5em]">Exit Personal Archive</button>
            </div>
          </div>
        </div>
      )}

      {/* 관리자 모달 */}
      {isUserMgmtOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/98 p-4 backdrop-blur-xl">
          <div className="bg-[#050505] border-2 border-red-700 w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl animate-fade-up">
            <div className="p-8 border-b border-red-900/50 flex justify-between items-center bg-black">
              <h2 className="text-red-600 font-black italic tracking-[0.5em] uppercase text-2xl">Central Intelligence</h2>
              <button onClick={() => setIsUserMgmtOpen(false)} className="text-zinc-700 hover:text-white text-4xl transition-colors">✕</button>
            </div>
            <div className="p-8 pb-0"><input type="text" placeholder="SEARCH AGENT..." className="w-full bg-black border border-zinc-800 p-5 text-white outline-none focus:border-red-800 italic tracking-widest uppercase text-xs" onChange={(e) => setSearchTerm(e.target.value)} /></div>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {allUsers.filter(u => u.name.includes(searchTerm)).map(u => (
                <div key={u.id} className="flex items-center px-8 py-6 bg-black border border-zinc-900 mb-3 hover:border-red-700 transition-all group">
                  <div className="w-1/4 flex flex-col"><span className="text-2xl font-black text-red-700 italic tracking-tighter group-hover:text-red-500 transition-colors">{u.name}</span><span className="text-[10px] text-zinc-800 font-mono mt-1 uppercase tracking-widest">{u.code}</span></div>
                  <div className="w-3/4 flex justify-end items-center gap-6">
                    <input type="number" defaultValue={u.points} id={`pt-${u.code}`} className="w-40 bg-black border border-zinc-800 p-3 text-right text-white font-black italic outline-none focus:border-red-600 text-xl" />
                    <button onClick={() => supabaseClient.from('users').update({ points: parseInt(document.getElementById(`pt-${u.code}`).value) }).eq('code', u.code).then(() => { alert('Update Success'); fetchUserList(); })} className="bg-red-950 border border-red-700 px-8 py-3 text-[11px] font-black text-red-500 hover:bg-red-700 hover:text-white transition-all uppercase tracking-widest">Override</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 로그인 */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/99 p-4 backdrop-blur-[50px] animate-fade-up">
          <div className="w-[450px] p-20 border border-red-950 bg-black text-center shadow-[0_0_100px_rgba(153,27,27,0.2)]">
            <div className="mb-10 inline-block px-4 py-1 border border-red-900/50 text-[10px] text-red-900 font-black tracking-[0.8em] uppercase">Security Gate</div>
            <h1 className="text-7xl font-black text-red-700 italic mb-20 uppercase tracking-tighter select-none">Arena</h1>
            <div className="space-y-8">
              <div className="relative">
                <input type="text" placeholder="ID" className="w-full bg-transparent border-b border-zinc-900 p-4 text-white outline-none focus:border-red-900 transition-all text-center tracking-widest" onChange={(e) => setLoginData({...loginData, id: e.target.value})} />
              </div>
              <div className="relative">
                <input type="password" placeholder="CODE" className="w-full bg-transparent border-b border-zinc-900 p-4 text-white outline-none focus:border-red-900 transition-all text-center tracking-widest" onChange={(e) => setLoginData({...loginData, pw: e.target.value})} />
              </div>
              <button onClick={handleLogin} className="w-full bg-red-900 py-6 font-black text-white hover:bg-red-700 uppercase tracking-[0.5em] text-xs transition-all active:scale-95 mt-10 shadow-lg">Authenticate</button>
            </div>
          </div>
        </div>
      )}

      {/* 플로팅 메일 버튼 */}
      {user && !user.is_admin && (
        <button onClick={() => setIsMailFormOpen(true)} className="fixed bottom-16 right-16 w-20 h-20 bg-red-950 rounded-full flex items-center justify-center text-4xl shadow-2xl border border-red-700 hover:scale-110 active:scale-90 transition-all z-40 group pulse-red">
          <span className="group-hover:animate-bounce">✉</span>
        </button>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
