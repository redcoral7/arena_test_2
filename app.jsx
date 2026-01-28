const { useState, useEffect, useRef } = React;
const { createClient } = supabase;
const SUPABASE_URL = 'https://vvvsuoadoawdivzyjmnh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_csF0Yu6fNHfJy2VhNmL1ZA_mkxPGoTP';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// [CSS 인젝션] 부드러운 애니메이션 및 스크롤바 스타일
const styleTag = document.createElement('style');
styleTag.textContent = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-up { animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: #000; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
`;
document.head.appendChild(styleTag);

/* DuelRequestModal: 사유서 대상자에게만 노출되는 결투 신청 팝업 */
const DuelRequestModal = ({ isOpen, mailData, onAccept, onReject }) => {
  if (!isOpen || !mailData) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="relative w-[420px] border border-red-900/40 bg-[#0a0000] p-10 shadow-[0_0_50px_rgba(139,0,0,0.4)]">
        <div className="mb-2 text-center">
          <span className="text-[10px] tracking-[0.4em] text-red-600 font-bold uppercase opacity-80">Duel Request</span>
        </div>
        <h2 className="mb-8 text-center text-4xl font-black text-white italic tracking-tighter leading-none">결투 신청</h2>
        <div className="mb-12 text-center">
          <p className="text-xl text-gray-300 font-medium leading-relaxed">
            <span className="text-red-500 font-bold">[{mailData.sender_name}]</span> 님이<br />
            결투를 신청했습니다.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <button onClick={() => onAccept(mailData.id)} className="w-full bg-[#b22222] py-5 text-2xl font-black text-white transition-all hover:bg-red-700 active:scale-95 shadow-[0_4px_15px_rgba(178,34,34,0.3)]">수 락</button>
          <button onClick={() => onReject(mailData.id)} className="w-full bg-transparent py-2 text-sm font-bold text-gray-600 transition-colors hover:text-gray-300">거 절</button>
        </div>
        <div className="absolute inset-2 border border-red-900/10 pointer-events-none"></div>
      </div>
    </div>
  );
};

/* StockMarket: 주식 거래 시스템 컴포넌트 */
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
    const interval = setInterval(refreshMarket, 10000); // 10초마다 갱신
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

  if (loading) return <div className="text-center py-20 animate-pulse text-red-900 font-black">CONNECTING TO EXCHANGE...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-fade-up">
      <div className="bg-[#050505] border border-zinc-900 p-8">
        <h3 className="text-red-600 font-black italic mb-8 uppercase tracking-widest border-l-2 border-red-900 pl-4">Market Quotes</h3>
        <div className="space-y-4">
          {stocks.map(s => (
            <div key={s.id} className="p-5 border border-zinc-900 bg-black flex justify-between items-center group hover:border-red-900 transition-all">
              <div>
                <div className="text-white font-black italic text-lg">{s.name}</div>
                <div className={`text-[10px] font-bold ${s.change_rate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>{s.change_rate >= 0 ? '▲' : '▼'} {Math.abs(s.change_rate || 0).toFixed(2)}%</div>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-2xl font-black text-zinc-300 italic">{s.current_price?.toLocaleString()}</span>
                <div className="flex gap-2">
                  <button onClick={() => handleTrade('BUY', s, s.current_price)} className="bg-red-900/10 border border-red-900 px-4 py-2 text-red-600 text-[10px] font-black hover:bg-red-900 hover:text-white transition-all uppercase">Buy</button>
                  <button onClick={() => handleTrade('SELL', s, s.current_price)} className="bg-blue-900/10 border border-blue-900 px-4 py-2 text-blue-600 text-[10px] font-black hover:bg-blue-900 hover:text-white transition-all uppercase">Sell</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-[#050505] border border-zinc-900 p-8">
        <h3 className="text-zinc-500 font-black italic mb-8 uppercase tracking-widest border-l-2 border-zinc-800 pl-4">Your Portfolio</h3>
        <div className="space-y-4">
          {myStocks.length > 0 ? myStocks.map(ms => {
            const cur = stocks.find(s => s.name === ms.stock_name)?.current_price || 0;
            const profit = (cur - ms.avg_price) * ms.quantity;
            return (
              <div key={ms.id} className="p-5 border border-zinc-900 bg-black flex justify-between items-center">
                <div>
                  <div className="text-zinc-400 font-bold uppercase">{ms.stock_name}</div>
                  <div className="text-[10px] text-zinc-700 font-black">QTY: {ms.quantity} / AVG: {ms.avg_price.toLocaleString()}</div>
                </div>
                <div className={`text-xl font-black italic ${profit >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                  {profit >= 0 ? '+' : ''}{profit.toLocaleString()} <span className="text-[10px]">PTS</span>
                </div>
              </div>
            );
          }) : <div className="py-20 text-center text-zinc-800 italic uppercase border border-dashed border-zinc-900">No Positions</div>}
        </div>
      </div>
    </div>
  );
};

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
    const { data, error } = await supabaseClient.from('shop_items').select('*').order('price', { ascending: true });
    if (!error) setShopItems(data || []);
  };

  const fetchInventory = async () => {
    if (!user) return;
    const { data } = await supabaseClient.from('user_inventory').select('*').eq('user_code', user.code).order('created_at', { ascending: false });
    setInventory(data || []);
  };

  useEffect(() => { 
    fetchShopItems();
    if (!user) {
      if (channelRef.current) { supabaseClient.removeChannel(channelRef.current); channelRef.current = null; }
      return;
    }
    fetchUserList(); 
    fetchAllMails();
    fetchInventory(); 

    const channel = supabaseClient
      .channel('public:arena_v6')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mails' }, (payload) => { 
        if (user) fetchAllMails(); 
        if (payload.new && payload.new.receiver_code === user.code && payload.new.status === '처리대기') {
          if (payload.new.title.includes('[사유서]')) {
            setPendingDuel(payload.new);
            setIsDuelModalOpen(true);
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, () => { if (user) fetchUserList(); })
      .subscribe();
    channelRef.current = channel;
    return () => { if (channelRef.current) supabaseClient.removeChannel(channelRef.current); };
  }, [user?.code]);

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

  const handlePurchase = async () => {
    if (!user || !selectedItem) return;
    if (user.points < selectedItem.price) {
      alert('크레딧(PTS)이 부족합니다.');
      return;
    }
    if (!confirm(`[${selectedItem.name}] 상품을 구매하시겠습니까?`)) return;
    try {
      const { error: userError } = await supabaseClient.from('users').update({ points: user.points - selectedItem.price }).eq('code', user.code);
      if (userError) throw userError;
      const { error: invError } = await supabaseClient.from('user_inventory').insert([{ user_code: user.code, item_name: selectedItem.name }]);
      if (invError) throw invError;
      alert('구매가 완료되었습니다.');
      setSelectedItem(null);
      fetchUserList();
      fetchInventory();
    } catch (err) {
      alert('거래 중 오류가 발생했습니다.');
    }
  };

  const handleLogin = async () => {
    const { data } = await supabaseClient.from('users').select('*').eq('login_id', loginData.id).eq('password', loginData.pw).single();
    if (data) { setUser(data); setIsLoginOpen(false); } 
    else { alert('인증 실패'); }
  };

  const handleLogout = () => {
    if (channelRef.current) { supabaseClient.removeChannel(channelRef.current); channelRef.current = null; }
    setUser(null); setView('home'); setMails([]); setAllUsers([]); setInventory([]); setIsDuelModalOpen(false);
  };

  const uploadFile = async (file) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `uploads/${fileName}`;
    const { error: uploadError } = await supabaseClient.storage.from('arena_files').upload(filePath, file);
    if (uploadError) throw uploadError;
    const { data } = supabaseClient.storage.from('arena_files').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const sendMail = async () => {
    const isGift = mailForm.category === '선물하기';
    let targetInvItem = null;
    if (isGift) {
      if (!mailForm.targetUser) return alert('선물할 대상을 선택해주세요.');
      if (!mailForm.selectedGiftItem) return alert('사용할 아이템을 선택해주세요.');
      targetInvItem = inventory.find(i => i.item_name === mailForm.selectedGiftItem);
      if (!targetInvItem) return alert('사용할 상품이 없습니다.');
    }
    setIsUploading(true);
    try {
      let fileUrl = '';
      if (selectedFile) fileUrl = await uploadFile(selectedFile);
      let receiverCode = (mailForm.category === '사유서' || mailForm.category === '선물하기') 
        ? (mailForm.targetUser.match(/[\[\(](.*?)[\]\)]/) || [])[1] : null;
      let finalTitle = `[${mailForm.category}] ${mailForm.title}`;
      if (mailForm.category === '사유서') finalTitle = `[사유서] 대상: ${mailForm.targetUser}`;
      if (mailForm.category === '선물하기') finalTitle = `[선물하기] 대상: ${mailForm.targetUser}`;
      const finalContent = fileUrl ? `${mailForm.content}\n---FILE_URL---${fileUrl}` : mailForm.content;
      const { error } = await supabaseClient.from('mails').insert([{ 
        sender_name: user.name, sender_code: user.code, receiver_code: receiverCode || 'ADMIN', 
        title: finalTitle, content: finalContent, status: '처리대기', is_read: false 
      }]);
      if (!error) {
        if (isGift && targetInvItem) {
          await supabaseClient.from('user_inventory').delete().eq('id', targetInvItem.id);
          fetchInventory();
        }
        alert('전송 완료'); setIsMailFormOpen(false); setSelectedFile(null); 
        setMailForm({ category: '건의사항', title: '', targetUser: '', content: '', selectedGiftItem: '' });
        fetchAllMails(); 
      }
    } catch (err) { alert('전송 중 오류 발생'); } finally { setIsUploading(false); }
  };

  const updatePoint = async (code, point) => {
    await supabaseClient.from('users').update({ points: parseInt(point) }).eq('code', code);
    alert('갱신 완료'); fetchUserList();
  };

  const markAsRead = async (mail) => {
    if (!mail.is_read) { await supabaseClient.from('mails').update({ is_read: true }).eq('id', mail.id); fetchAllMails(); }
    setSelectedMail(mail);
  };

  const handleDecision = async (id, decision) => {
    const { error } = await supabaseClient.from('mails').update({ status: decision }).eq('id', id);
    if (!error) { alert(`처리가 완료되었습니다. (${decision})`); setIsDuelModalOpen(false); fetchAllMails(); }
  };

  const handleGiftDecision = async (mail, decision) => {
    const { error } = await supabaseClient.from('mails').update({ status: decision }).eq('id', mail.id);
    if (!error) { alert(`선물 요청을 ${decision} 처리했습니다.`); setSelectedMail(null); fetchAllMails(); }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-400 font-serif selection:bg-red-900 selection:text-white overflow-x-hidden">
      <nav className="px-8 py-4 flex justify-between items-center border-b border-red-950/30 bg-black/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-12">
          <img src={LOGO_URL} className="h-12 cursor-pointer hover:scale-105 transition-transform duration-300" onClick={() => setView('home')} />
          <div className="flex gap-10 items-center text-[11px] font-black tracking-[0.4em] uppercase">
             <button onClick={() => setView('home')} className={`transition-all duration-300 hover:text-white ${view === 'home' ? 'text-white border-b border-red-700' : 'text-zinc-600'}`}>[ HOME ]</button>
             <button onClick={() => setView('shop')} className={`transition-all duration-300 hover:text-red-500 ${view === 'shop' ? 'text-red-600 border-b border-red-700' : 'text-zinc-600'}`}>[ SHOP ]</button>
             <button onClick={() => setView('stock')} className={`transition-all duration-300 hover:text-yellow-600 ${view === 'stock' ? 'text-yellow-600 border-b border-yellow-700' : 'text-zinc-600'}`}>[ STOCK ]</button>
             {user?.is_admin && <button onClick={() => setIsUserMgmtOpen(true)} className="text-red-600 hover:text-red-400 animate-pulse">[ 유저 관리 ]</button>}
          </div>
        </div>
        <div className="flex gap-6 items-center">
          {user ? (
            <div className="flex gap-6 items-center">
              {user.is_admin && <button onClick={() => setIsAdminMailOpen(true)} className="text-red-600 text-2xl hover:scale-125 transition-transform">📬</button>}
              <button onClick={() => setIsUserProfileOpen(true)} className="text-red-600 font-black italic border-b border-red-900 tracking-tighter hover:text-red-400 transition-colors">{user.name} ▾</button>
              <button onClick={handleLogout} className="text-[10px] text-zinc-600 hover:text-white border border-zinc-800 px-3 py-1 uppercase font-black transition-all">Logout</button>
            </div>
          ) : <button onClick={() => setIsLoginOpen(true)} className="text-red-700 font-black text-[11px] border border-red-900 px-8 py-2 hover:bg-red-900 hover:text-white transition-all duration-300 italic tracking-[0.2em]">LOGIN</button>}
        </div>
      </nav>

      <div>
        {view === 'home' && (
          <main key="home" className="flex flex-col items-center justify-center pt-60 text-center px-6 animate-fade-up">
            <h1 className="text-[90px] font-black text-white italic tracking-tighter leading-none mb-6 uppercase">"Arena Never Sleeps"</h1>
            <div className="w-24 h-[1px] bg-red-900 mb-8"></div>
            <p className="text-zinc-700 italic text-xl tracking-[0.3em] uppercase">The victory is the only record.</p>
          </main>
        )}
        {view === 'shop' && (
          <main key="shop" className="max-w-7xl mx-auto pt-24 px-8 pb-32 animate-fade-up">
            <div className="flex justify-between items-end mb-16 border-l-4 border-red-900 pl-8 py-2">
              <div>
                <h2 className="text-6xl font-black text-white italic tracking-tighter uppercase mb-2">Black Market</h2>
                <p className="text-red-900 font-black tracking-[0.5em] text-[10px] uppercase">Restricted Area / Authorized Personnel Only</p>
              </div>
              <div className="text-right">
                <span className="text-zinc-600 text-[10px] uppercase font-black tracking-widest block mb-2">Available Credits</span>
                <span className="text-4xl font-black text-red-600 italic tracking-tighter">{user ? user.points.toLocaleString() : '---'} <span className="text-sm not-italic ml-1">PTS</span></span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {shopItems.map((item) => (
                <div key={item.id} onClick={() => setSelectedItem(item)} className="group cursor-pointer bg-[#050505] border border-zinc-900 p-1 hover:border-red-600 transition-all duration-500 shadow-2xl">
                  <div className="aspect-[4/3] bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden text-center">
                      <div className="absolute inset-0 bg-gradient-to-t from-red-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      {item.image_url ? (
                        <img src={item.image_url} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
                      ) : (
                        <span className="text-zinc-900 font-black text-5xl group-hover:text-zinc-800 transition-colors uppercase italic">{item.name}</span>
                      )}
                  </div>
                  <div className="p-6 bg-black border-t border-zinc-900 group-hover:border-red-900 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-black text-zinc-400 italic group-hover:text-white transition-colors uppercase tracking-tighter">{item.name}</h3>
                        <span className="text-red-600 font-black italic tracking-tighter">{item.price?.toLocaleString()} <span className="text-[10px]">PTS</span></span>
                      </div>
                      <p className="text-zinc-600 text-[11px] font-medium leading-relaxed italic border-t border-zinc-900/50 pt-2 group-hover:text-zinc-400 transition-colors">{item.desc_text}</p>
                  </div>
                </div>
              ))}
            </div>
          </main>
        )}
        {view === 'stock' && (
          <main key="stock" className="max-w-7xl mx-auto pt-24 px-8 pb-32 animate-fade-up">
            <div className="flex justify-between items-end mb-16 border-l-4 border-yellow-700 pl-8 py-2">
              <div>
                <h2 className="text-6xl font-black text-white italic tracking-tighter uppercase mb-2">Exchange</h2>
                <p className="text-yellow-700 font-black tracking-[0.5em] text-[10px] uppercase">Market Risks & Rewards</p>
              </div>
              <div className="text-right">
                <span className="text-zinc-600 text-[10px] uppercase font-black tracking-widest block mb-2">Available Credits</span>
                <span className="text-4xl font-black text-yellow-600 italic tracking-tighter">{user ? user.points.toLocaleString() : '---'} <span className="text-sm not-italic ml-1">PTS</span></span>
              </div>
            </div>
            {user ? <StockMarket user={user} fetchUserList={fetchUserList} /> : <div className="text-center py-40 text-red-600 font-black uppercase opacity-50">Auth Required</div>}
          </main>
        )}
      </div>

      {/* Duel Modal */}
      <DuelRequestModal isOpen={isDuelModalOpen} mailData={pendingDuel} onAccept={(id) => handleDecision(id, '서명완료')} onReject={(id) => handleDecision(id, '거절')} />

      {/* Mail Form Modal */}
      {isMailFormOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/98 p-4 backdrop-blur-md">
          <div className="bg-[#050505] border border-red-900/40 w-full max-w-xl p-1 shadow-2xl animate-fade-up">
            <div className="border border-red-900/20 p-12">
              <h3 className="text-red-700 font-black italic text-xl mb-12 uppercase text-center tracking-[0.4em]">Transmission Center</h3>
              <div className="space-y-8">
                <div>
                   <label className="text-[9px] text-zinc-700 font-black uppercase mb-3 block tracking-widest">Category</label>
                   <select className="w-full bg-black border border-zinc-900 p-5 text-zinc-400 font-black uppercase text-xs focus:border-red-900 outline-none" value={mailForm.category} onChange={(e) => setMailForm({...mailForm, category: e.target.value})}>
                     <option value="건의사항">건의사항 [Opinion]</option>
                     <option value="사유서">사유서 [Duel Statement]</option>
                     <option value="선물하기">선물하기 [Gift Item]</option>
                   </select>
                </div>
                {mailForm.category === '선물하기' && (
                  <div>
                    <label className="text-[9px] text-red-700 font-black uppercase mb-3 block tracking-widest">Select Possession to Use</label>
                    <select className="w-full bg-black border border-red-900/30 p-5 text-white font-black uppercase text-xs focus:border-red-900 outline-none" onChange={(e) => setMailForm({...mailForm, selectedGiftItem: e.target.value})}>
                      <option value="">아이템 선택...</option>
                      {inventory.filter(i => i.item_name === '[세트] 목줄+방울' || i.item_name === '[단품] 목줄').map((inv, idx) => (
                        <option key={idx} value={inv.item_name}>{inv.item_name}</option>
                      ))}
                    </select>
                    {inventory.filter(i => i.item_name === '[세트] 목줄+방울' || i.item_name === '[단품] 목줄').length === 0 && (
                      <p className="text-[10px] text-red-600 mt-2 italic">※ 상점에서 구매 가능한 아이템이 없습니다.</p>
                    )}
                  </div>
                )}
                {mailForm.category === '건의사항' ? (
                  <div>
                    <label className="text-[9px] text-zinc-700 font-black uppercase mb-3 block tracking-widest">Subject</label>
                    <input type="text" placeholder="제목을 입력하십시오..." className="w-full bg-black border border-zinc-900 p-5 text-white focus:border-red-900 italic outline-none" onChange={(e) => setMailForm({...mailForm, title: e.target.value})} />
                  </div>
                ) : (
                  <div>
                    <label className="text-[9px] text-zinc-700 font-black uppercase mb-3 block tracking-widest">Target Opponent / Receiver</label>
                    <input type="text" placeholder="상대방 이름(코드)을 선택하십시오..." className="w-full bg-black border border-zinc-900 p-5 text-white focus:border-red-900 italic outline-none" list="userList" onChange={(e) => setMailForm({...mailForm, targetUser: e.target.value})} />
                  </div>
                )}
                <datalist id="userList">{allUsers.map(u => <option key={u.code} value={`${u.name}(${u.code})`} />)}</datalist>
                <div>
                  <label className="text-[9px] text-zinc-700 font-black uppercase mb-3 block tracking-widest">Detailed Content</label>
                  <textarea rows="6" className="w-full bg-black border border-zinc-900 p-5 text-white focus:border-red-900 italic leading-relaxed outline-none" placeholder="내용을 입력하십시오..." onChange={(e) => setMailForm({...mailForm, content: e.target.value})}></textarea>
                </div>
                <div>
                  <label className="text-[9px] text-zinc-700 font-black uppercase mb-3 block tracking-widest text-red-600">Attachment (File)</label>
                  <input type="file" className="w-full bg-black border border-zinc-900 p-4 text-[11px] text-zinc-500 italic file:bg-red-900 file:border-none file:text-white file:px-4 file:py-1 file:mr-4 file:font-black file:uppercase file:cursor-pointer cursor-pointer" onChange={(e) => setSelectedFile(e.target.files[0])} />
                </div>
                <div className="flex gap-4">
                  <button onClick={sendMail} disabled={isUploading} className="flex-1 bg-red-900 py-5 font-black text-white hover:bg-red-700 uppercase tracking-widest text-sm shadow-xl transition-all active:scale-95 disabled:opacity-50">{isUploading ? 'Uploading...' : 'Send'}</button>
                  <button onClick={() => { setIsMailFormOpen(false); setSelectedFile(null); }} className="flex-1 border border-zinc-900 py-5 font-black text-zinc-700 hover:text-white hover:border-zinc-500 uppercase tracking-widest text-sm transition-all">Abort</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shop Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/98 p-4 backdrop-blur-2xl">
          <div className="bg-black border border-red-900 w-full max-w-2xl p-12 relative animate-fade-up">
            <button onClick={() => setSelectedItem(null)} className="absolute top-8 right-10 text-zinc-700 hover:text-white text-4xl">✕</button>
            <h3 className="text-red-600 font-black italic text-5xl uppercase mb-10 tracking-tighter">{selectedItem.name}</h3>
            <div className="bg-[#050505] border border-zinc-900 p-10 mb-12 border-l-4 border-l-red-900">
              <p className="text-zinc-400 leading-relaxed italic text-lg">{selectedItem.detail_text}</p>
            </div>
            <div className="flex justify-between items-center border-t border-zinc-900 pt-10">
              <span className="text-4xl font-black text-white italic">{selectedItem.price?.toLocaleString()} <span className="text-sm">PTS</span></span>
              <button onClick={handlePurchase} className="bg-red-800 px-12 py-5 text-white font-black hover:bg-red-700 uppercase text-sm shadow-xl transition-all active:scale-95">Complete Transaction</button>
            </div>
          </div>
        </div>
      )}

      {/* Profile & History Modal */}
      {isUserProfileOpen && user && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/98 p-4 backdrop-blur-3xl animate-fade-up">
          <div className="bg-[#050505] border-2 border-red-700 w-full max-w-2xl p-1 shadow-2xl">
            <div className="border border-red-900/30 p-10 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-start mb-10">
                <div>
                  <span className="text-red-900 font-black text-[10px] tracking-[0.5em] uppercase block mb-2">{user.code}</span>
                  <h2 className="text-6xl font-black text-white italic uppercase tracking-tighter">{user.name}</h2>
                </div>
                <button onClick={() => setIsUserProfileOpen(false)} className="text-zinc-800 hover:text-white text-4xl transition-colors">✕</button>
              </div>
              <div className="bg-black border border-zinc-900 p-8 flex justify-between items-center mb-8 shadow-inner">
                  <span className="text-zinc-600 font-black uppercase text-[10px] tracking-widest">Available Balance</span>
                  <span className="text-4xl font-black text-red-600 italic tracking-tighter">{user.points.toLocaleString()} <span className="text-xs not-italic text-zinc-700 ml-2">PTS</span></span>
              </div>
              <div className="mb-10">
                <h3 className="text-zinc-700 font-black text-[11px] tracking-[0.4em] uppercase mb-4 italic">Possessions</h3>
                <div className="grid grid-cols-2 gap-2">
                  {inventory.length > 0 ? inventory.map((inv, idx) => (
                    <div key={idx} className="bg-zinc-950 border border-zinc-900 p-4 flex items-center gap-3">
                      <div className="w-1.5 h-1.5 bg-red-700 rounded-full"></div>
                      <span className="text-zinc-400 text-xs italic font-bold uppercase tracking-tight">{inv.item_name}</span>
                    </div>
                  )) : <div className="col-span-2 text-zinc-800 italic text-[10px] py-6 text-center border border-dashed border-zinc-900 uppercase tracking-widest">No Items Acquired</div>}
                </div>
              </div>
              <button onClick={() => setIsUserProfileOpen(false)} className="w-full mt-10 border border-zinc-800 py-4 text-[10px] font-black text-zinc-600 hover:text-white transition-all uppercase tracking-[0.3em]">Exit Archive</button>
            </div>
          </div>
        </div>
      )}

      {/* Admin User Management Modal */}
      {isUserMgmtOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md">
          <div className="bg-[#050505] border-2 border-red-700 w-full max-w-5xl h-[80vh] flex flex-col shadow-[0_0_50px_rgba(185,28,28,0.2)] animate-fade-up">
            <div className="p-6 border-b border-red-900/50 flex justify-between items-center bg-black">
              <h2 className="text-red-600 font-black italic tracking-[0.3em] uppercase text-xl">User Intelligence</h2>
              <button onClick={() => setIsUserMgmtOpen(false)} className="text-zinc-600 hover:text-white text-3xl">✕</button>
            </div>
            <div className="p-6 pb-0">
              <input type="text" placeholder="검색할 이름을 입력하십시오..." className="w-full bg-black border border-zinc-800 p-3 text-sm text-white outline-none focus:border-red-900 italic" onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex-1 overflow-y-auto p-6 pt-4 custom-scrollbar">
              <div className="grid grid-cols-1 gap-2">
                {allUsers.filter(u => u.name.includes(searchTerm)).map(u => (
                  <div key={u.id} className="flex items-center px-6 py-4 bg-black border border-zinc-900 hover:border-red-600 transition-all group">
                    <div className="w-1/4 flex flex-col">
                      <span className="text-xl font-black text-red-600 italic tracking-tighter">{u.name}</span>
                      <span className="text-[10px] text-zinc-700 font-mono tracking-widest">{u.code}</span>
                    </div>
                    <div className="w-1/4 text-center"><span className="text-[10px] px-3 py-1 border border-zinc-800 text-zinc-600 font-black tracking-widest uppercase">Authorized</span></div>
                    <div className="w-2/4 flex justify-end items-center gap-4">
                      <input type="number" defaultValue={u.points} id={`pt-${u.code}`} className="w-32 bg-[#0a0a0a] border border-zinc-800 p-2 text-right text-white font-black italic outline-none focus:border-red-600 text-lg" />
                      <button onClick={() => updatePoint(u.code, document.getElementById(`pt-${u.code}`).value)} className="bg-red-900/10 border border-red-700 px-6 py-2 text-[11px] font-black text-red-600 hover:bg-red-700 hover:text-white transition-all uppercase tracking-widest">Update</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/98 p-4 backdrop-blur-3xl animate-fade-up">
          <div className="w-96 p-16 border border-red-950 bg-black text-center">
            <h1 className="text-6xl font-black text-red-600 italic mb-16 uppercase animate-pulse">Arena</h1>
            <div className="space-y-6">
              <input type="text" placeholder="ID" className="w-full bg-black border border-zinc-900 p-5 text-white focus:border-red-900 outline-none" onChange={(e) => setLoginData({...loginData, id: e.target.value})} />
              <input type="password" placeholder="CODE" className="w-full bg-black border border-zinc-900 p-5 text-white focus:border-red-900 outline-none" onChange={(e) => setLoginData({...loginData, pw: e.target.value})} />
              <button onClick={handleLogin} className="w-full bg-red-800 py-5 font-black text-white hover:bg-red-700 uppercase tracking-widest text-sm">Connect</button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Mail Button */}
      {user && !user.is_admin && (
        <button onClick={() => setIsMailFormOpen(true)} className="fixed bottom-12 right-12 w-16 h-16 bg-red-950 rounded-full flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(153,27,27,0.4)] border border-red-700 hover:scale-110 active:scale-90 transition-all z-40 group">
          <span className="group-hover:animate-bounce">💬</span>
        </button>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
