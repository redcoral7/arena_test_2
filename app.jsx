const { useState, useEffect, useRef } = React;
const { createClient } = supabase;

const SUPABASE_URL = 'https://vvvsuoadoawdivzyjmnh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_csF0Yu6fNHfJy2VhNmL1ZA_mkxPGoTP';
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * DuelRequestModal: 결투 신청 팝업
 */
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

function App() {
  const [user, setUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [mails, setMails] = useState([]);
  const [shopItems, setShopItems] = useState([]); // 상점 아이템 상태 추가
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
  const [mailForm, setMailForm] = useState({ category: '건의사항', title: '', targetUser: '', content: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const [activeTab, setActiveTab] = useState('건의사항');
  const [searchTerm, setSearchTerm] = useState('');

  const channelRef = useRef(null);
  
  // 로고를 4.png로 수정
  const LOGO_URL = '4.png'; 

  // 초기 데이터 로드 (상점 아이템 포함)
  const fetchShopItems = async () => {
    const { data } = await supabaseClient.from('shop_items').select('*').order('id');
    setShopItems(data || []);
  };

  useEffect(() => { 
    fetchShopItems();
    if (!user) return;
    
    fetchUserList(); 
    fetchAllMails();
    
    const channel = supabaseClient
      .channel('public:arena_v6')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mails' }, (payload) => { 
        fetchAllMails(); 
        if (payload.new && payload.new.receiver_code === user.code && payload.new.status === '처리대기') {
          setPendingDuel(payload.new);
          setIsDuelModalOpen(true);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, () => { fetchUserList(); })
      .subscribe();
    channelRef.current = channel;
    return () => { if (channelRef.current) supabaseClient.removeChannel(channelRef.current); };
  }, [user?.code]);

  const fetchUserList = async () => {
    const { data } = await supabaseClient.from('users').select('*').order('name', { ascending: true });
    setAllUsers(data || []);
    const updatedUser = data?.find(u => u.code === user?.code);
    if (updatedUser) setUser(updatedUser);
  };

  const fetchAllMails = async () => {
    const { data } = await supabaseClient.from('mails').select('*').order('created_at', { ascending: false });
    setMails(data || []);
  };

  const handleLogin = async () => {
    const { data } = await supabaseClient.from('users').select('*').eq('login_id', loginData.id).eq('password', loginData.pw).single();
    if (data) { setUser(data); setIsLoginOpen(false); } 
    else { alert('인증 실패'); }
  };

  const handleLogout = () => {
    setUser(null); setView('home'); setIsDuelModalOpen(false);
  };

  const sendMail = async () => {
    setIsUploading(true);
    try {
      let receiverCode = mailForm.category === '사유서' ? (mailForm.targetUser.match(/[\[\(](.*?)[\]\)]/) || [])[1] : null;
      let finalTitle = mailForm.category === '사유서' ? `[사유서] 대상: ${mailForm.targetUser}` : `[건의사항] ${mailForm.title}`;
      
      const { error } = await supabaseClient.from('mails').insert([{ 
        sender_name: user.name, 
        sender_code: user.code, 
        receiver_code: receiverCode, 
        title: finalTitle, 
        content: mailForm.content, 
        status: mailForm.category === '사유서' ? '처리대기' : '기타', 
        is_read: false 
      }]);

      if (!error) { alert('전송 완료'); setIsMailFormOpen(false); fetchAllMails(); }
    } catch (err) { alert('오류 발생'); } finally { setIsUploading(false); }
  };

  const updatePoint = async (code, point) => {
    await supabaseClient.from('users').update({ points: parseInt(point) }).eq('code', code);
    alert('갱신 완료'); fetchUserList();
  };

  const handleDecision = async (id, decision) => {
    await supabaseClient.from('mails').update({ status: decision }).eq('id', id);
    setIsDuelModalOpen(false); fetchAllMails();
  };

  return (
    <div className="min-h-screen bg-black text-zinc-400 font-serif selection:bg-red-900 selection:text-white overflow-x-hidden">
      {/* 네비게이션 */}
      <nav className="px-8 py-4 flex justify-between items-center border-b border-red-950/30 bg-black/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-12">
          <img src={LOGO_URL} className="h-12 cursor-pointer hover:scale-105 transition-transform" onClick={() => setView('home')} />
          <div className="flex gap-10 items-center text-[11px] font-black tracking-[0.4em] uppercase">
             <button onClick={() => setView('home')} className={view === 'home' ? 'text-white border-b border-red-700' : 'text-zinc-600'}>[ HOME ]</button>
             <button onClick={() => setView('shop')} className={view === 'shop' ? 'text-red-600 border-b border-red-700' : 'text-zinc-600'}>[ SHOP ]</button>
             {user?.is_admin && <button onClick={() => setIsUserMgmtOpen(true)} className="text-red-600 animate-pulse">[ 유저 관리 ]</button>}
          </div>
        </div>
        <div className="flex gap-6 items-center">
          {user ? (
            <div className="flex gap-6 items-center">
              <button onClick={() => setIsUserProfileOpen(true)} className="text-red-600 font-black italic border-b border-red-900">{user.name} ▾</button>
              <button onClick={handleLogout} className="text-[10px] text-zinc-600 border border-zinc-800 px-3 py-1 uppercase font-black">Logout</button>
            </div>
          ) : <button onClick={() => setIsLoginOpen(true)} className="text-red-700 font-black text-[11px] border border-red-900 px-8 py-2 italic tracking-[0.2em]">LOGIN</button>}
        </div>
      </nav>

      {/* 메인 뷰 */}
      <div>
        {view === 'home' ? (
          <main className="flex flex-col items-center justify-center pt-60 text-center px-6">
            <h1 className="text-[90px] font-black text-white italic tracking-tighter uppercase mb-6">"Arena Never Sleeps"</h1>
            <div className="w-24 h-[1px] bg-red-900 mb-8"></div>
            <p className="text-zinc-700 italic text-xl tracking-[0.3em] uppercase">The victory is the only record.</p>
          </main>
        ) : (
          <main className="max-w-7xl mx-auto pt-24 px-8 pb-32">
            <div className="flex justify-between items-end mb-16 border-l-4 border-red-900 pl-8">
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
                <div key={item.id} onClick={() => setSelectedItem(item)} className="group cursor-pointer bg-[#050505] border border-zinc-900 p-1 hover:border-red-600 transition-all">
                  <div className="aspect-[4/3] bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden">
                      <img src={item.image_url} className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity" />
                      <span className="absolute text-white font-black text-2xl uppercase italic drop-shadow-lg">{item.name}</span>
                  </div>
                  <div className="p-6 bg-black border-t border-zinc-900">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-black text-zinc-400 italic group-hover:text-white uppercase tracking-tighter">{item.name}</h3>
                        <span className="text-red-600 font-black italic tracking-tighter">{item.price} <span className="text-[10px]">PTS</span></span>
                      </div>
                      <p className="text-zinc-600 text-[11px] italic border-t border-zinc-900/50 pt-2">{item.desc_text}</p>
                  </div>
                </div>
              ))}
            </div>
          </main>
        )}
      </div>

      {/* 모달 섹션 (기존과 동일하게 유지하되 위 코드로 로직 보강됨) */}
      <DuelRequestModal isOpen={isDuelModalOpen} mailData={pendingDuel} onAccept={(id) => handleDecision(id, '서명완료')} onReject={(id) => handleDecision(id, '거절')} />

      {/* 로그인 모달 */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/98 p-4 backdrop-blur-3xl">
          <div className="w-96 p-16 border border-red-950 bg-black text-center">
            <h1 className="text-6xl font-black text-red-600 italic mb-16 uppercase">Arena</h1>
            <div className="space-y-6">
              <input type="text" placeholder="ID" className="w-full bg-black border border-zinc-900 p-5 text-white" onChange={(e) => setLoginData({...loginData, id: e.target.value})} />
              <input type="password" placeholder="CODE" className="w-full bg-black border border-zinc-900 p-5 text-white" onChange={(e) => setLoginData({...loginData, pw: e.target.value})} />
              <button onClick={handleLogin} className="w-full bg-red-800 py-5 font-black text-white hover:bg-red-700 uppercase">Connect</button>
            </div>
          </div>
        </div>
      )}

      {/* 유저 관리 모달 */}
      {isUserMgmtOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-md">
          <div className="bg-[#050505] border-2 border-red-700 w-full max-w-5xl h-[80vh] flex flex-col">
            <div className="p-6 border-b border-red-900/50 flex justify-between items-center bg-black">
              <h2 className="text-red-600 font-black italic tracking-[0.3em] uppercase text-xl">User Intelligence</h2>
              <button onClick={() => setIsUserMgmtOpen(false)} className="text-zinc-600 hover:text-white text-3xl">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 pt-4">
                {allUsers.map(u => (
                  <div key={u.id} className="flex items-center px-6 py-4 bg-black border border-zinc-900 hover:border-red-600 transition-all mb-2">
                    <div className="w-1/4">
                      <span className="text-xl font-black text-red-600 italic">{u.name}</span>
                    </div>
                    <div className="w-3/4 flex justify-end items-center gap-4">
                      <input type="number" defaultValue={u.points} id={`pt-${u.code}`} className="w-32 bg-[#0a0a0a] border border-zinc-800 p-2 text-right text-white font-black italic" />
                      <button onClick={() => updatePoint(u.code, document.getElementById(`pt-${u.code}`).value)} className="bg-red-900/10 border border-red-700 px-6 py-2 text-[11px] font-black text-red-600">Update</button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
