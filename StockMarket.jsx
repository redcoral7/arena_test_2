// StockMarket.jsx
const { useState, useEffect } = React;

const StockMarket = ({ user, fetchUserList }) => {
  const [stocks, setStocks] = useState([]);
  const [myStocks, setMyStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMarketOpen, setIsMarketOpen] = useState(false);

  // 현재 시간 체크 함수
  const checkMarketStatus = () => {
    const now = new Date();
    const hour = now.getHours();
    // 오후 7시(19시) ~ 오전 2시(0, 1시)
    return hour >= 19 || hour < 2;
  };

  const fetchMarketData = async () => {
    if (!user) return;
    try {
      const { data: stockData } = await supabaseClient
        .from('stocks')
        .select('*')
        .order('name', { ascending: true });
      setStocks(stockData || []);

      const { data: myData } = await supabaseClient
        .from('user_stocks')
        .select('*, stocks(*)')
        .eq('user_code', user.code);
      setMyStocks(myData || []);
    } catch (err) {
      console.error('Market error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 최초 실행 시 마켓 상태 확인
    const openStatus = checkMarketStatus();
    setIsMarketOpen(openStatus);

    if (openStatus) {
      fetchMarketData();
      const fetchInterval = setInterval(fetchMarketData, 5000);
      
      const simulateInterval = setInterval(async () => {
        if (!user?.is_admin || stocks.length === 0) return;
        
        // 시뮬레이션 중에도 시간 다시 체크 (자정이 넘어가서 2시가 되면 멈춰야 함)
        if (!checkMarketStatus()) {
          setIsMarketOpen(false);
          return;
        }

        for (const stock of stocks) {
          const changePercent = parseFloat((Math.random() * 7 - 3.5).toFixed(2));
          const newPrice = Math.max(100, Math.round(stock.current_price * (1 + changePercent / 100)));
          await supabaseClient.from('stocks').update({ current_price: newPrice, change_rate: changePercent }).eq('id', stock.id);
        }
      }, 10000);

      return () => {
        clearInterval(fetchInterval);
        clearInterval(simulateInterval);
      };
    }
  }, [user?.code, stocks.length, isMarketOpen]);

  // 매수/매도 로직
  const handleBuy = async (stock) => {
    if (!checkMarketStatus()) return alert('거래 시간이 종료되었습니다.');
    if (user.points < stock.current_price) return alert('크레딧이 부족합니다.');
    
    if (!confirm(`[${stock.name}] 1주를 ${stock.current_price.toLocaleString()} PTS에 매수하시겠습니까?`)) return;
    try {
      await supabaseClient.from('users').update({ points: user.points - stock.current_price }).eq('code', user.code);
      const existing = myStocks.find(s => s.stock_id === stock.id);
      if (existing) {
        await supabaseClient.from('user_stocks').update({ quantity: existing.quantity + 1 }).eq('id', existing.id);
      } else {
        await supabaseClient.from('user_stocks').insert([{ user_code: user.code, stock_id: stock.id, quantity: 1, avg_price: stock.current_price }]);
      }
      alert('매수 완료');
      fetchUserList(); fetchMarketData();
    } catch (e) { alert('거래 실패'); }
  };

  const handleSell = async (ownedItem) => {
    if (!checkMarketStatus()) return alert('거래 시간이 종료되었습니다.');
    const stock = stocks.find(s => s.id === ownedItem.stock_id);
    if (!stock) return;
    if (!confirm(`[${stock.name}] 전량을 매도하시겠습니까?`)) return;
    try {
      const totalGain = stock.current_price * ownedItem.quantity;
      await supabaseClient.from('users').update({ points: user.points + totalGain }).eq('code', user.code);
      await supabaseClient.from('user_stocks').delete().eq('id', ownedItem.id);
      alert(`매도 완료: +${totalGain.toLocaleString()} PTS`);
      fetchUserList(); fetchMarketData();
    } catch (e) { alert('거래 실패'); }
  };

  // 1. 로딩 화면
  if (loading && isMarketOpen) return <div className="pt-40 text-center text-red-900 font-black animate-pulse uppercase tracking-[0.5em]">Establishing Secure Connection...</div>;

  // 2. [핵심] 접속 불가 화면 (Market Closed)
  if (!isMarketOpen) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-6 animate-in fade-in zoom-in-95 duration-1000">
        <div className="w-20 h-[1px] bg-red-900 mb-8"></div>
        <h2 className="text-8xl font-black text-white italic tracking-tighter uppercase mb-4 opacity-20">Access Denied</h2>
        <h3 className="text-4xl font-black text-red-600 italic tracking-tighter uppercase mb-6">Market is Closed</h3>
        <p className="text-zinc-600 font-bold tracking-[0.3em] uppercase text-sm mb-12">
          Operation Hours: <span className="text-white">19:00 - 02:00</span>
        </p>
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] text-zinc-800 font-black uppercase tracking-widest">
            <span className="w-2 h-2 bg-zinc-800 rounded-full"></span>
            System Standby Mode
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 border border-zinc-800 px-8 py-2 text-[10px] font-black text-zinc-600 hover:text-white hover:border-white transition-all uppercase"
          >
            Re-verify System Time
          </button>
        </div>
      </div>
    );
  }

  // 3. 정상 접속 화면 (위와 동일한 UI)
  return (
    <div className="max-w-7xl mx-auto pt-24 px-8 pb-32 animate-in fade-in zoom-in-95 duration-1000">
      <div className="flex justify-between items-end mb-16 border-l-4 border-red-900 pl-8 py-2">
        <div>
          <h2 className="text-6xl font-black text-white italic tracking-tighter uppercase mb-2">Exchange</h2>
          <p className="text-red-900 font-black tracking-[0.5em] text-[10px] uppercase animate-pulse">● System Online / Trading Active</p>
        </div>
        <div className="text-right">
          <span className="text-zinc-600 text-[10px] uppercase font-black block mb-2">Available Balance</span>
          <span className="text-4xl font-black text-red-600 italic tracking-tighter">{user.points.toLocaleString()} <span className="text-sm not-italic ml-1">PTS</span></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* 주식 리스트 및 포트폴리오는 기존 코드와 동일 */}
        <div className="lg:col-span-2 space-y-4">
          {stocks.map(stock => (
            <div key={stock.id} className="bg-[#050505] border border-zinc-900 p-8 flex items-center justify-between group hover:border-red-600 transition-all">
              <div>
                <span className="text-zinc-600 font-mono text-[10px] uppercase">{stock.symbol}</span>
                <h4 className="text-2xl font-black text-white italic group-hover:text-red-500 transition-colors uppercase">{stock.name}</h4>
              </div>
              <div className="flex items-center gap-12">
                <div className="text-right">
                  <span className="text-2xl font-black text-white italic block">{stock.current_price.toLocaleString()}</span>
                  <span className={`text-xs font-bold ${stock.change_rate >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {stock.change_rate >= 0 ? '▲' : '▼'} {Math.abs(stock.change_rate)}%
                  </span>
                </div>
                <button onClick={() => handleBuy(stock)} className="bg-red-900/10 border border-red-900/40 px-8 py-3 text-xs font-black text-red-600 hover:bg-red-900 hover:text-white transition-all uppercase">Buy</button>
              </div>
            </div>
          ))}
        </div>
        {/* 보유 주식 영역 생략 (기존과 동일하게 유지하시면 됩니다) */}
      </div>
    </div>
  );
};

window.StockMarket = StockMarket;
