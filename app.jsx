const { useState, useEffect, useRef } = React;
const { createClient } = supabase;
const SUPABASE_URL = 'https://vvvsuoadoawdivzyjmnh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_csF0Yu6fNHfJy2VhNmL1ZA_mkxPGoTP';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * [SUB COMPONENT] DuelRequestModal: 결투 신청 팝업
 */
const DuelRequestModal = ({ isOpen, mailData, onAccept, onReject }) => {
  if (!isOpen || !mailData) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-[420px] border border-red-900/40 bg-[#0a0000] p-10 shadow-[0_0_50px_rgba(139,0,0,0.4)] animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        <div className="mb-2 text-center text-[10px] tracking-[0.4em] text-red-600 font-bold uppercase opacity-80">Incoming Duel</div>
        <h2 className="mb-8 text-center text-4xl font-black text-white italic tracking-tighter uppercase">결투 신청</h2>
        <div className="mb-12 text-center text-xl text-gray-300 font-medium leading-relaxed">
          <span className="text-red-500 font-bold underline">[{mailData.sender_name}]</span> 님이<br />결투를 신청했습니다.
        </div>
        <div className="flex flex-col gap-4">
          <button onClick={() => onAccept(mailData.id)} className="w-full bg-[#b22222] py-5 text-2xl font-black text-white hover:bg-red-700 active:scale-95 transition-all shadow-[0_4px_15px_rgba(178,34,34,0.3)]">수 락</button>
          <button onClick={() => onReject(mailData.id)} className="w-full bg-transparent py-2 text-sm font-bold text-gray-600 hover:text-gray-300">거 절</button>
        </div>
      </div>
    </div>
  );
};

/**
 * [SUB COMPONENT] StockMarket: 주식 거래소
 */
const StockMarket = ({ user, fetchUserList }) => {
  const [stocks, setStocks] = useState([]);
  const [myStocks, setMyStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshData = async () => {
    const { data: sData } = await supabaseClient.from('stocks').select('*').order('name');
    const { data: uData } = await supabaseClient.from('user_stocks').select('*').eq('user_code', user.code);
    setStocks(sData || []);
    setMyStocks(uData || []);
    setLoading(false);
  };

  useEffect(() => {
    refreshData();
    const timer = setInterval(simulatePrice, 20000);
    return () => clearInterval(timer);
  }, []);

  const simulatePrice = async () => {
    const { data: currentStocks } = await supabaseClient.from('stocks').select('*');
    if (!currentStocks) return;
    for (const s of currentStocks) {
      const change = Math.floor(s.current_price * (Math.random() * 0.08 - 0.04));
      const newPrice = Math.max(100, s.current_price + change);
      await supabaseClient.from('stocks').update({ current_price: newPrice, change_rate: ((newPrice - s.current_price) / s.current_price) * 100 }).eq('id', s.id);
    }
    refreshData();
  };

  const handleAction = async (type, sName, price) => {
    if (type === 'BUY') {
      const qty = parseInt(prompt(`${sName} 매수 수량?`, "1"));
      if (!qty || qty <= 0) return;
      if (user.points < qty * price) return alert("PTS 부족");
      const pos = myStocks.find(s => s.stock_name === sName);
      if (pos) {
        const nQty = pos.quantity + qty;
        const nAvg = Math.floor((pos.avg_price * pos.quantity + qty * price) / nQty);
        await supabaseClient.from('user_stocks').update({ quantity: nQty, avg_price: nAvg }).eq('id', pos.id);
      } else {
        await supabaseClient.from('user_stocks').insert([{ user_code: user.code, stock_name: sName, quantity: qty, avg_price: price }]);
      }
      await supabaseClient.from('users').update({ points: user.points - (qty * price) }).eq('code', user.code);
    } else {
      const pos = myStocks.find(s => s.stock_name === sName);
      if (!pos || pos.quantity <= 0) return alert("보유량 없음");
      const qty = parseInt(prompt(`매도 수량 (보유: ${pos.quantity})`, pos.quantity));
      if (!qty || qty <= 0 || qty > pos.quantity) return;
      const gain = qty * price;
      if (pos.quantity === qty) await supabaseClient.from('user_stocks').delete().eq('id', pos.id);
      else await supabaseClient.from('user_stocks').update({ quantity: pos.quantity - qty }).eq('id', pos.id);
      await supabaseClient.from('users').update({ points: user.points + gain }).eq('code', user.code);
    }
    fetchUserList(); refreshData();
  };

  if (loading) return <div className="text-center py-20 text-red-900 font-black animate-pulse tracking-widest uppercase">Syncing Market Data...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-[#050505] border border-zinc-900 p-8 shadow-2xl">
        <h3 className="text-red-600 font-black italic mb-8 uppercase tracking-[0.3em] border-l-2 border-red-900 pl-4">Live Quotes</h3>
        <div className="space-y-3">
          {stocks.map(s => (
            <div key={s.id} className="p-5 border border-zinc-900 bg-black flex justify-between items-center group hover:border-red-900 transition-all">
              <div>
                <div className="text-white font-black italic text-lg">{s.name}</div>
                <div className={`text-[10px] font-bold ${s.change_rate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>{s.change_rate >= 0 ? '▲' : '▼'} {Math.abs(s.change_rate || 0).toFixed(2)}%</div>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-2xl font-black text-zinc-300 italic">{s.current_price?.toLocaleString()} <span className="text-[10px] text-zinc-600">PTS</span></span>
                <div className="flex gap-1">
                  <button onClick={() => handleAction('BUY', s.name, s.current_price)} className="bg-red-900/10 border border-red-900 px-4 py-2 text-red-600 text-[10px] font-black hover:bg-red-900 hover:text-white transition-all uppercase">Buy</button>
                  <button onClick={() => handleAction('SELL', s.name, s.current_price)} className="bg-blue-900/10 border border-blue-900 px-4 py-2 text-blue-600 text-[10px] font-black hover:bg-blue-900 hover:text-white transition-all uppercase">Sell</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-[#050505] border border-zinc-900 p-8 shadow-2xl">
        <h3 className="text-zinc-500 font-black italic mb-8 uppercase tracking-[0.3em] border-l-2 border-zinc-800 pl-4">Your Portfolio</h3>
        <div className="space-y-3">
          {myStocks.length > 0 ? myStocks.map(ms => {
            const cur = stocks.find(s => s.name === ms.stock_name)?.current_price || 0;
            const profit = (cur - ms.avg_price) * ms.quantity;
            return (
              <div key={ms.id} className="p-5 border border-zinc-900 bg-black flex justify-between items-end">
                <div><div className="text-zinc-400 font-bold mb-1">{ms.stock_name}</div><div className="text-[10px] text-zinc-700 uppercase font-black tracking-tighter">Qty: {ms.quantity} / Avg: {ms.avg_price.toLocaleString()}</div></div>
                <div className={`text-xl font-black italic ${profit >= 0 ? 'text-red-600' : 'text-blue-600'}`}>{profit >= 0 ? '+' : ''}{profit.toLocaleString()} <span className="text-[10px]">PTS</span></div>
              </div>
            );
          }) : <div className="py-20 text-center text-zinc-800 italic text-[10px] uppercase border border-dashed border-zinc-900 tracking-widest">No active positions</div>}
        </div>
      </div>
    </div>
  );
};

/**
 * [MAIN APP]
 */
function App() {
  const [user, setUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [mails, setMails] = useState([]);
  const [shopItems, setShopItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [view, setView] = useState('home');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isMailFormOpen, setIsMailFormOpen] = useState(false);
  const [isAdminMailOpen, setIsAdminMailOpen] = useState(false);
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState(false);
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [isDuelModalOpen, setIsDuelModalOpen] = useState(false);
  const [pendingDuel, setPendingDuel] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedMail, setSelectedMail] = useState(null);
  const [loginData, setLoginData] = useState({ id: '', pw: '' });
  const [mailForm, setMailForm] = useState({ category: '건의사항', title: '', targetUser: '', content: '', selectedGiftItem: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('건의사항');
  const [searchTerm, setSearchTerm] = useState('');
  const channelRef = useRef(null);
  const LOGO_URL = '4.png';

  const fetchShopItems = async () => {
    const { data } = await supabaseClient.from('shop_items').select('*').order('price', { ascending: true });
    setShopItems(data || []);
  };
  const fetchInventory = async () => {
    if (!user) return;
    const { data } = await supabaseClient.from('user_inventory').select('*').eq('user_code', user.code).order('created_at', { ascending: false });
    setInventory(data || []);
  };
  const fetchUserList = async () => {
    if (!user) return;
    const { data } = await supabaseClient.from('users').select('*').order('name', { ascending: true });
    setAllUsers(data || []);
    const updated = data?.find(u => u.code === user.code);
    if (updated) setUser(updated);
  };
  const fetchAllMails = async () => {
    if (!user) return;
    const { data } = await supabaseClient.from('mails').select('*').order('created_at', { ascending: false });
    setMails(data || []);
  };

  useEffect(() => {
    fetchShopItems();
    if (!user) return;
    fetchUserList(); fetchAllMails(); fetchInventory();
    const channel = supabaseClient.channel('arena_main')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mails' }, (payload) => {
        fetchAllMails();
        if (payload.new && payload.new.receiver_code === user.code && payload.new.status === '처리대기' && payload.new.title.includes('[사유서]')) {
          setPendingDuel(payload.new); setIsDuelModalOpen(true);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, fetchUserList)
      .subscribe();
    channelRef.current = channel;
    return () => { if (channelRef.current) supabaseClient.removeChannel(channelRef.current); };
  }, [user?.code]);

  const handleLogin = async () => {
    const { data } = await supabaseClient.from('users').select('*').eq('login_id', loginData.id).eq('password', loginData.pw).single();
    if (data) { setUser(data); setIsLoginOpen(false); } else alert('인증 실패');
  };

  const handleLogout = () => { setUser(null); setView('home'); };

  const sendMail = async () => {
    const isGift = mailForm.category === '선물하기';
    let targetInvItem = isGift ? inventory.find(i => i.item_name === mailForm.selectedGiftItem) : null;
    if (isGift && !targetInvItem) return alert('아이템을 선택해주세요.');

    setIsUploading(true);
    try {
      let fileUrl = '';
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        await supabaseClient.storage.from('arena_files').upload(`uploads/${fileName}`, selectedFile);
        const { data } = supabaseClient.storage.from('arena_files').getPublicUrl(`uploads/${fileName}`);
        fileUrl = data.publicUrl;
      }
      let receiverCode = (mailForm.category === '사유서' || mailForm.category === '선물하기') 
        ? (mailForm.targetUser.match(/[\[\(](.*?)[\]\)]/) || [])[1] : 'ADMIN';
      let finalTitle = `[${mailForm.category}] ${mailForm.category === '건의사항' ? mailForm.title : '대상: ' + mailForm.targetUser}`;
      const finalContent = fileUrl ? `${mailForm.content}\n---FILE_URL---${fileUrl}` : mailForm.content;
      const { error } = await supabaseClient.from('mails').insert([{ sender_name: user.name, sender_code: user.code, receiver_code: receiverCode, title: finalTitle, content: finalContent, status: '처리대기' }]);
      if (!error) {
        if (isGift) await supabaseClient.from('user_inventory').delete().eq('id', targetInvItem.id);
        alert('전송 완료'); setIsMailFormOpen(false); setMailForm({ category: '건의사항', title: '', targetUser: '', content: '', selectedGiftItem: '' }); setSelectedFile(null); fetchInventory(); fetchAllMails();
      }
    } catch (e) { alert('전송 실패'); } finally { setIsUploading(false); }
  };

  const handlePurchase = async () => {
    if (!user || !selectedItem) return;
    if (user.points < selectedItem.price) return alert('PTS 부족');
    if (!confirm(`[${selectedItem.name}] 구매하시겠습니까?`)) return;
    await supabaseClient.from('users').update({ points: user.points - selectedItem.price }).eq('code', user.code);
    await supabaseClient.from('user_inventory').insert([{ user_code: user.code, item_name: selectedItem.name }]);
    alert('구매 완료'); setSelectedItem(null); fetchUserList(); fetchInventory();
  };

  const markAsRead = async (mail) => {
    if (!mail.is_read) { await supabaseClient.from('mails').update({ is_read: true }).eq('id', mail.id); fetchAllMails(); }
    setSelectedMail(mail);
  };

  return (
    <div className="min-h-screen bg-black text-zinc-400 font-serif overflow-x-hidden selection:bg-red-900 selection:text-white">
      {/* Navigation */}
      <nav className="px-8 py-4 flex justify-between items-center border-b border-red-950/30 bg-black/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-12">
          <img src={LOGO_URL} className="h-12 cursor-pointer hover:scale-105 transition-all" onClick={() => setView('home')} />
          <div className="flex gap-10 items-center text-[11px] font-black tracking-[0.4em] uppercase">
             <button onClick={() => setView('home')} className={`hover:text-white transition-colors ${view === 'home' ? 'text-white border-b border-red-700' : 'text-zinc-600'}`}>[ HOME ]</button>
             <button onClick={() => setView('shop')} className={`hover:text-red-600 transition-colors ${view === 'shop' ? 'text-red-600 border-b border-red-700' : 'text-zinc-600'}`}>[ SHOP ]</button>
             <button onClick={() => setView('stock')} className={`hover:text-yellow-600 transition-colors ${view === 'stock' ? 'text-yellow-600 border-b border-yellow-700' : 'text-zinc-600'}`}>[ STOCK ]</button>
             {user?.is_admin && <button onClick={() => setIsUserMgmtOpen(true)} className="text-red-600 animate-pulse">[ ADMIN ]</button>}
          </div>
        </div>
        <div className="flex gap-6 items-center">
          {user ? (
            <>
              {user.is_admin && <button onClick={() => setIsAdminMailOpen(true)} className="text-red-600 text-2xl hover:scale-110 transition-transform">📬</button>}
              <button onClick={() => setIsUserProfileOpen(true)} className="text-red-600 font-black italic border-b border-red-900 uppercase hover:text-red-400 transition-colors">{user.name} ▾</button>
              <button onClick={handleLogout} className="text-[10px] text-zinc-600 border border-zinc-800 px-3 py-1 font-black hover:bg-zinc-900 transition-all">LOGOUT</button>
            </>
          ) : <button onClick={() => setIsLoginOpen(true)} className="text-red-700 font-black text-[11px] border border-red-900 px-8 py-2 italic tracking-widest hover:bg-red-900 hover:text-white transition-all">LOGIN</button>}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto pt-24 px-8 pb-32">
        {view === 'home' && (
          <div className="flex flex-col items-center justify-center pt-40 text-center animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <h1 className="text-[90px] font-black text-white italic tracking-tighter leading-none mb-6 uppercase">"Arena Never Sleeps"</h1>
            <div className="w-24 h-[1px] bg-red-900 mb-8"></div>
            <p className="text-zinc-700 italic text-xl tracking-[0.3em] uppercase">Victory is the only record.</p>
          </div>
        )}

        {view === 'shop' && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex justify-between items-end mb-16 border-l-4 border-red-900 pl-8">
              <div><h2 className="text-6xl font-black text-white italic uppercase mb-2">Black Market</h2><p className="text-red-900 text-[10px] uppercase font-black tracking-widest">Restricted Area</p></div>
              <div className="text-right font-black italic text-4xl text-red-600">{user?.points.toLocaleString() || '---'} PTS</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {shopItems.map(item => (
                <div key={item.id} onClick={() => setSelectedItem(item)} className="group cursor-pointer bg-[#050505] border border-zinc-900 p-1 hover:border-red-600 transition-all duration-300">
                  <div className="aspect-[4/3] bg-zinc-950 flex items-center justify-center overflow-hidden">
                    {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 scale-105 group-hover:scale-100" /> : <span className="text-zinc-900 font-black text-4xl italic uppercase opacity-20">{item.name}</span>}
                  </div>
                  <div className="p-6 bg-black border-t border-zinc-900 group-hover:border-red-900">
                    <div className="flex justify-between items-center mb-2"><h3 className="text-xl font-black text-zinc-400 italic group-hover:text-white uppercase">{item.name}</h3><span className="text-red-600 font-black italic">{item.price?.toLocaleString()} PTS</span></div>
                    <p className="text-zinc-600 text-[11px] italic pt-2 line-clamp-2">{item.desc_text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'stock' && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
             <div className="flex justify-between items-end mb-16 border-l-4 border-yellow-700 pl-8">
              <div><h2 className="text-6xl font-black text-white italic tracking-tighter uppercase mb-2">Exchange</h2><p className="text-yellow-700 font-black tracking-[0.5em] text-[10px] uppercase">Risk & Return</p></div>
              <div className="text-right font-black italic text-4xl text-yellow-600">{user?.points.toLocaleString() || '---'} PTS</div>
            </div>
            {user ? <StockMarket user={user} fetchUserList={fetchUserList} /> : <div className="text-center py-40 text-red-600 font-black uppercase tracking-[0.3em] italic opacity-50 animate-pulse">Authentication Required</div>}
          </div>
        )}
      </main>

      {/* Global Modals */}
      <DuelRequestModal isOpen={isDuelModalOpen} mailData={pendingDuel} onAccept={(id) => { supabaseClient.from('mails').update({ status: '서명완료' }).eq('id', id).then(() => { setIsDuelModalOpen(false); alert('수락'); fetchAllMails(); }); }} onReject={(id) => { supabaseClient.from('mails').update({ status: '거절' }).eq('id', id).then(() => { setIsDuelModalOpen(false); alert('거절'); fetchAllMails(); }); }} />

      {/* Profile Modal */}
      {isUserProfileOpen && user && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/98 p-4 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="bg-[#050505] border-2 border-red-700 w-full max-w-2xl p-10 shadow-2xl animate-in zoom-in-95 duration-500 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-start mb-10">
              <div><span className="text-red-900 font-black text-[10px] tracking-[0.5em] uppercase">{user.code}</span><h2 className="text-6xl font-black text-white italic uppercase tracking-tighter">{user.name}</h2></div>
              <button onClick={() => setIsUserProfileOpen(false)} className="text-zinc-800 hover:text-white text-4xl transition-all">✕</button>
            </div>
            <div className="bg-black border border-zinc-900 p-8 flex justify-between items-center mb-8 shadow-inner">
              <span className="text-zinc-600 font-black uppercase text-[10px] tracking-widest">Balance</span>
              <span className="text-4xl font-black text-red-600 italic tracking-tighter">{user.points.toLocaleString()} <span className="text-xs text-zinc-700">PTS</span></span>
            </div>
            <div>
              <h3 className="text-zinc-700 font-black text-[11px] tracking-[0.4em] uppercase mb-4 italic">Inventory</h3>
              <div className="grid grid-cols-2 gap-2">
                {inventory.length > 0 ? inventory.map((inv, idx) => (
                  <div key={idx} className="bg-zinc-950 border border-zinc-900 p-4 flex items-center gap-3"><div className="w-1.5 h-1.5 bg-red-700 rounded-full"></div><span className="text-zinc-400 text-xs italic font-bold uppercase">{inv.item_name}</span></div>
                )) : <div className="col-span-2 text-zinc-800 italic text-[10px] py-10 text-center border border-dashed border-zinc-900 uppercase">Archive Empty</div>}
              </div>
            </div>
            <button onClick={() => setIsUserProfileOpen(false)} className="w-full mt-12 border border-zinc-800 py-4 text-[10px] font-black text-zinc-700 hover:text-white transition-all uppercase tracking-[0.5em]">Close</button>
          </div>
        </div>
      )}

      {/* Admin Mailbox */}
      {isAdminMailOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/98 p-4 backdrop-blur-md animate-in fade-in">
          <div className="bg-black border-2 border-red-700 w-full max-w-6xl h-[850px] flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="p-10 border-b border-red-900/50 flex items-center justify-between">
              <div className="flex gap-6">
                {['건의사항', '사유서', '선물하기'].map(tab => (
                  <button key={tab} onClick={() => { setActiveTab(tab); setSelectedMail(null); }} className={`px-12 py-4 text-[11px] font-black border uppercase tracking-widest transition-all ${activeTab === tab ? 'border-red-600 text-red-600 bg-red-900/10' : 'border-zinc-800 text-zinc-700 hover:border-zinc-600'}`}>{tab}</button>
                ))}
              </div>
              <button onClick={() => { setIsAdminMailOpen(false); setSelectedMail(null); }} className="text-zinc-600 hover:text-white text-4xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
              {!selectedMail ? (
                <div className="space-y-4">
                  {mails.filter(m => m.title?.includes(`[${activeTab}]`)).map(m => (
                    <div key={m.id} onClick={() => markAsRead(m)} className="p-8 border border-zinc-900 flex justify-between items-center bg-[#050505] hover:border-red-600 cursor-pointer group transition-all">
                      <div className="flex items-center gap-12">
                        <span className={`text-[9px] font-black px-2 py-1 ${m.is_read ? 'text-zinc-800 bg-zinc-900' : 'text-white bg-red-800 animate-pulse'}`}>{m.is_read ? 'READ' : 'NEW'}</span>
                        <span className="text-red-600 font-black italic text-2xl w-32 truncate uppercase">{m.sender_name}</span>
                        <span className="text-zinc-500 text-xl italic group-hover:text-zinc-300 transition-colors">{m.title}</span>
                      </div>
                      <div className="flex gap-10 items-center">
                        {m.status && <span className="px-5 py-1 text-[11px] border border-red-800 text-red-600 font-black">{m.status}</span>}
                        <span className="text-xs text-zinc-800 font-mono">{new Date(m.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-10 duration-500">
                  <button onClick={() => setSelectedMail(null)} className="text-red-900 text-[11px] font-black uppercase mb-12 hover:text-red-600 flex items-center gap-3">← BACK</button>
                  <h3 className="text-5xl font-black text-white italic uppercase mb-8 border-b border-zinc-900 pb-8 tracking-tighter">{selectedMail.title}</h3>
                  <div className="bg-[#050505] border border-zinc-900 p-12 min-h-[300px] flex-1">
                    <div className="text-zinc-400 italic text-xl whitespace-pre-wrap leading-relaxed mb-10">{selectedMail.content.split('---FILE_URL---')[0]}</div>
                    {selectedMail.content.includes('---FILE_URL---') && <a href={selectedMail.content.split('---FILE_URL---')[1]} target="_blank" className="text-red-600 underline font-black uppercase tracking-widest text-xs hover:text-red-400">Download Attachment</a>}
                  </div>
                  {activeTab === '선물하기' && selectedMail.status === '처리대기' && (
                    <div className="mt-8 flex gap-4">
                      <button onClick={async () => { await supabaseClient.from('mails').update({ status: '처리완료' }).eq('id', selectedMail.id); alert('승인됨'); setSelectedMail(null); fetchAllMails(); }} className="flex-1 bg-red-900 py-4 font-black text-white hover:bg-red-700 transition-all uppercase tracking-widest">Approve</button>
                      <button onClick={async () => { await supabaseClient.from('mails').update({ status: '거절됨' }).eq('id', selectedMail.id); alert('거절됨'); setSelectedMail(null); fetchAllMails(); }} className="flex-1 border border-zinc-800 py-4 text-zinc-600 hover:text-white transition-all uppercase tracking-widest">Reject</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mail Form */}
      {isMailFormOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/98 p-4 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#050505] border border-red-900/40 w-full max-w-xl p-12 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-red-700 font-black italic text-xl mb-12 uppercase text-center tracking-[0.4em]">Transmission Center</h3>
            <div className="space-y-8">
              <div>
                <label className="text-[9px] text-zinc-700 font-black uppercase mb-3 block">Category</label>
                <select className="w-full bg-black border border-zinc-900 p-5 text-zinc-400 font-black text-xs outline-none focus:border-red-900 transition-all" value={mailForm.category} onChange={(e) => setMailForm({...mailForm, category: e.target.value})}>
                  <option value="건의사항">건의사항 (ADMIN)</option>
                  <option value="사유서">사유서 (결투 신청)</option>
                  <option value="선물하기">아이템 선물</option>
                </select>
              </div>
              {mailForm.category === '선물하기' && (
                <div>
                  <label className="text-[9px] text-red-700 font-black uppercase mb-3 block">Gift Item</label>
                  <select className="w-full bg-black border border-red-900/30 p-5 text-white font-black text-xs outline-none" onChange={(e) => setMailForm({...mailForm, selectedGiftItem: e.target.value})}>
                    <option value="">보관함 아이템 선택...</option>
                    {inventory.map((inv, idx) => (<option key={idx} value={inv.item_name}>{inv.item_name}</option>))}
                  </select>
                </div>
              )}
              {mailForm.category === '건의사항' ? (
                <div><label className="text-[9px] text-zinc-700 font-black uppercase mb-3 block">Subject</label><input type="text" className="w-full bg-black border border-zinc-900 p-5 text-white italic outline-none focus:border-red-900" onChange={(e) => setMailForm({...mailForm, title: e.target.value})} /></div>
              ) : (
                <div><label className="text-[9px] text-zinc-700 font-black uppercase mb-3 block">Recipient (Name/Code)</label><input type="text" className="w-full bg-black border border-zinc-900 p-5 text-white italic outline-none focus:border-red-900" list="userList" placeholder="이름(코드) 입력..." onChange={(e) => setMailForm({...mailForm, targetUser: e.target.value})} /><datalist id="userList">{allUsers.filter(u => u.code !== user.code).map(u => <option key={u.code} value={`${u.name}(${u.code})`} />)}</datalist></div>
              )}
              <div><label className="text-[9px] text-zinc-700 font-black uppercase mb-3 block">Message</label><textarea rows="5" className="w-full bg-black border border-zinc-900 p-5 text-white italic outline-none focus:border-red-900" onChange={(e) => setMailForm({...mailForm, content: e.target.value})}></textarea></div>
              <div><label className="text-[9px] text-red-600 font-black uppercase mb-3 block">Attachment</label><input type="file" className="w-full bg-black border border-zinc-900 p-4 text-[11px] text-zinc-500 cursor-pointer" onChange={(e) => setSelectedFile(e.target.files[0])} /></div>
              <div className="flex gap-4">
                <button onClick={sendMail} disabled={isUploading} className="flex-1 bg-red-900 py-5 font-black text-white hover:bg-red-700 transition-all uppercase tracking-widest text-sm">{isUploading ? 'Sending...' : 'Transmit'}</button>
                <button onClick={() => setIsMailFormOpen(false)} className="flex-1 border border-zinc-900 py-5 font-black text-zinc-700 hover:text-white transition-all uppercase tracking-widest text-sm">Abort</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shop Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/98 p-4 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-black border border-red-900 w-full max-w-2xl p-12 relative animate-in zoom-in-95 shadow-[0_0_100px_rgba(139,0,0,0.2)]">
            <button onClick={() => setSelectedItem(null)} className="absolute top-8 right-10 text-zinc-700 hover:text-white text-4xl">✕</button>
            <h3 className="text-red-600 font-black italic text-5xl uppercase mb-10 tracking-tighter">{selectedItem.name}</h3>
            <div className="bg-[#050505] border border-zinc-900 p-10 mb-12 border-l-4 border-l-red-900"><p className="text-zinc-400 leading-relaxed italic text-lg">{selectedItem.detail_text || selectedItem.desc_text}</p></div>
            <div className="flex justify-between items-center border-t border-zinc-900 pt-10"><span className="text-4xl font-black text-white italic">{selectedItem.price?.toLocaleString()} PTS</span><button onClick={handlePurchase} className="bg-red-800 px-12 py-5 text-white font-black hover:bg-red-700 uppercase text-sm shadow-xl transition-all active:scale-95">Acquire Item</button></div>
          </div>
        </div>
      )}

      {/* Admin: User Intelligence (Point Management) */}
      {isUserMgmtOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#050505] border-2 border-red-700 w-full max-w-5xl h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95">
            <div className="p-6 border-b border-red-900/50 flex justify-between items-center bg-black"><h2 className="text-red-600 font-black italic tracking-[0.3em] uppercase text-xl">User Intelligence</h2><button onClick={() => setIsUserMgmtOpen(false)} className="text-zinc-600 hover:text-white text-3xl">✕</button></div>
            <div className="p-6 pb-0"><input type="text" placeholder="검색할 유저 이름..." className="w-full bg-black border border-zinc-800 p-3 text-sm text-white italic outline-none focus:border-red-900" onChange={(e) => setSearchTerm(e.target.value)} /></div>
            <div className="flex-1 overflow-y-auto p-6 space-y-2 custom-scrollbar">
              {allUsers.filter(u => u.name.includes(searchTerm)).map(u => (
                <div key={u.id} className="flex items-center px-6 py-4 bg-black border border-zinc-900 hover:border-red-600 group transition-all">
                  <div className="w-1/4 flex flex-col"><span className="text-xl font-black text-red-600 italic tracking-tighter">{u.name}</span><span className="text-[10px] text-zinc-700 font-mono tracking-widest">{u.code}</span></div>
                  <div className="w-3/4 flex justify-end items-center gap-4">
                    <input type="number" defaultValue={u.points} id={`pt-${u.code}`} className="w-32 bg-[#0a0a0a] border border-zinc-800 p-2 text-right text-white font-black italic outline-none focus:border-red-600 text-lg" />
                    <button onClick={async () => { const pt = document.getElementById(`pt-${u.code}`).value; await supabaseClient.from('users').update({ points: parseInt(pt) }).eq('code', u.code); alert('갱신 완료'); fetchUserList(); }} className="bg-red-900/10 border border-red-700 px-6 py-2 text-[11px] font-black text-red-600 hover:bg-red-700 transition-all uppercase tracking-widest">Update</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/98 p-4 backdrop-blur-3xl animate-in fade-in duration-500">
          <div className="w-96 p-16 border border-red-950 bg-black text-center animate-in slide-in-from-bottom-20 duration-500 shadow-[0_0_100px_rgba(153,27,27,0.2)]">
            <h1 className="text-6xl font-black text-red-600 italic mb-16 uppercase tracking-tighter animate-pulse">Arena</h1>
            <div className="space-y-6">
              <input type="text" placeholder="ID" className="w-full bg-black border border-zinc-900 p-5 text-white outline-none focus:border-red-900 transition-colors" onChange={(e) => setLoginData({...loginData, id: e.target.value})} />
              <input type="password" placeholder="CODE" className="w-full bg-black border border-zinc-900 p-5 text-white outline-none focus:border-red-900 transition-colors" onChange={(e) => setLoginData({...loginData, pw: e.target.value})} />
              <button onClick={handleLogin} className="w-full bg-red-800 py-5 font-black text-white hover:bg-red-700 uppercase tracking-widest text-sm transition-all shadow-xl active:scale-95">Connect</button>
            </div>
          </div>
        </div>
      )}

      {/* FAB - Mail Button */}
      {user && !user.is_admin && (
        <button onClick={() => setIsMailFormOpen(true)} className="fixed bottom-12 right-12 w-16 h-16 bg-red-950 rounded-full flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(153,27,27,0.4)] border border-red-700 hover:scale-110 active:scale-90 transition-all z-40 group animate-in slide-in-from-right-10 duration-700">
          <span className="group-hover:animate-pulse">💬</span>
        </button>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
