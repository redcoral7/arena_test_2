// StockMarket.jsx
const { useState, useEffect } = React;

const StockMarket = ({ user, fetchUserList }) => {
  const [stocks, setStocks] = useState([]);
  const [myStocks, setMyStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. 주식 시세 및 내 잔고 데이터 로드
  const fetchMarketData = async () => {
    if (!user) return;
    try {
      // 주식 종목 리스트 가져오기
      const { data: stockData } = await supabaseClient
        .from('stocks')
        .select('*')
        .order('name', { ascending: true });
      setStocks(stockData || []);

      // 내 보유 주식 가져오기
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
    fetchMarketData();
    
    // [기능 1] 5초마다 시장 데이터 새로고침
    const fetchInterval = setInterval(fetchMarketData, 5000);

    // [기능 2] 실시간 주가 변동 시뮬레이터 (어드민이 접속 중일 때만 동작)
    const simulateInterval = setInterval(async () => {
      if (!user?.is_admin || stocks.length === 0) return;

      for (const stock of stocks) {
        // -3.5% ~ +3.5% 사이의 랜덤 변동폭 생성
        const changePercent = parseFloat((Math.random() * 7 - 3.5).toFixed(2));
        const newPrice = Math.max(100, Math.round(stock.current_price * (1 + changePercent / 100)));

        // DB 업데이트
        await supabaseClient
          .from('stocks')
          .update({ 
            current_price: newPrice, 
            change_rate: changePercent 
          })
          .eq('id', stock.id);
      }
    }, 10000); // 10초마다 변동 발생

    return () => {
      clearInterval(fetchInterval);
      clearInterval(simulateInterval);
    };
  }, [user?.code, stocks.length]); // stocks.length를 넣어 초기 로드 후 실행 보장

  // 2. 매수 로직
  const handleBuy = async (stock) => {
    if (user.points < stock.current_price) return alert('크레딧이 부족합니다.');
    if (!confirm(`[${stock.name}] 1주를 ${stock.current_price.toLocaleString()} PTS에 매수하시겠습니까?`)) return;

    try {
      // 포인트 차감
      await supabaseClient.from('users').update({ points: user.points - stock.current_price }).eq('code', user.code);
      
      // 보유 주식 추가
      const existing = myStocks.find(s => s.stock_id === stock.id);
      if (existing) {
        await supabaseClient.from('user_stocks').update({ quantity: existing.quantity + 1 }).eq('id', existing.id);
      } else {
        await supabaseClient.from('user_stocks').insert([{ 
          user_code: user.code, 
          stock_id: stock.id, 
          quantity: 1, 
          avg_price: stock.current_price 
        }]);
      }
      
      alert('매수 완료');
      fetchUserList(); 
      fetchMarketData();
    } catch (e) { 
      alert('거래 실패'); 
    }
  };

  // 3. 매도 로직
  const handleSell = async (ownedItem) => {
    const stock = stocks.find(s => s.id === ownedItem.stock_id);
    if (!stock) return;
    if (!confirm(`[${stock.name}] 전량을 매도하시겠습니까?`)) return;

    try {
      const totalGain = stock.current_price * ownedItem.quantity;
      await supabaseClient.from('users').update({ points: user.points + totalGain }).eq('code', user.code);
      await supabaseClient.from('user_stocks').delete().eq('id', ownedItem.id);
      
      alert(`매도 완료: +${totalGain.toLocaleString()} PTS`);
      fetchUserList(); 
      fetchMarketData();
    } catch (e) { 
      alert('거래 실패'); 
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-[1px] bg-red-900 mx-auto mb-4 animate-pulse"></div>
        <div className="text-red-900 font-black text-xs tracking-[0.5em] uppercase animate-pulse">Accessing Market...</div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto pt-24 px-8 pb-32 animate-in fade-in zoom-in-95 slide-in-from-bottom-8 duration-1000">
      <div className="flex justify-between items-end mb-16 border-l-4 border-red-900 pl-8 py-2">
        <div>
          <h2 className="text-6xl font-black text-white italic tracking-tighter uppercase mb-2">Exchange</h2>
          <p className="text-red-900 font-black tracking-[0.5em] text-[10px] uppercase">Stock Market / Real-time Trading</p>
        </div>
        <div className="text-right">
          <span className="text-zinc-600 text-[10px] uppercase font-black block mb-2">Available Balance</span>
          <span className="text-4xl font-black text-red-600 italic tracking-tighter">
            {user.points.toLocaleString()} <span className="text-sm not-italic ml-1">PTS</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* 주식 리스트 (Market Board) */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-zinc-700 font-black text-[11px] tracking-[0.4em] uppercase mb-6 italic">Market Board</h3>
          {stocks.map(stock => (
            <div key={stock.id} className="bg-[#050505] border border-zinc-900 p-8 flex items-center justify-between group hover:border-red-600 transition-all duration-500 shadow-2xl">
              <div className="flex items-center gap-8">
                <div className={`w-1 h-12 ${stock.change_rate >= 0 ? 'bg-red-600' : 'bg-blue-600'}`}></div>
                <div>
                  <span className="text-zinc-600 font-mono text-[10px] uppercase tracking-widest">{stock.symbol}</span>
                  <h4 className="text-3xl font-black text-white italic group-hover:text-red-500 transition-colors uppercase tracking-tighter">{stock.name}</h4>
                </div>
              </div>
              <div className="flex items-center gap-12">
                <div className="text-right">
                  <span className="text-3xl font-black text-white italic block tracking-tighter">
                    {stock.current_price.toLocaleString()}
                  </span>
                  <span className={`text-sm font-black italic ${stock.change_rate >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {stock.change_rate >= 0 ? '▲' : '▼'} {Math.abs(stock.change_rate)}%
                  </span>
                </div>
                <button 
                  onClick={() => handleBuy(stock)} 
                  className="bg-red-900/10 border border-red-900/40 px-10 py-4 text-xs font-black text-red-600 hover:bg-red-900 hover:text-white transition-all uppercase tracking-widest active:scale-95"
                >
                  Buy
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 보유 주식 (Portfolio) */}
        <div className="bg-[#050505] border border-zinc-900 p-8 h-fit sticky top-32 shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-zinc-700 font-black text-[11px] tracking-[0.4em] uppercase italic">Your Portfolio</h3>
            <span className="text-[10px] text-zinc-800 font-mono">{myStocks.length} ASSETS</span>
          </div>
          
          {myStocks.length > 0 ? (
            <div className="space-y-6">
              {myStocks.map(ms => {
                const currentStock = stocks.find(s => s.id === ms.stock_id);
                const profit = currentStock ? (currentStock.current_price - ms.avg_price) * ms.quantity : 0;
                const profitRate = currentStock ? ((currentStock.current_price - ms.avg_price) / ms.avg_price * 100).toFixed(2) : 0;
                
                return (
                  <div key={ms.id} className="bg-black border border-zinc-900/50 p-6 transition-all hover:border-zinc-700">
                    <div className="flex justify-between mb-4">
                      <div>
                        <span className="text-zinc-600 text-[9px] uppercase font-black block">Asset</span>
                        <span className="text-white font-black italic uppercase tracking-tighter">{currentStock?.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-zinc-600 text-[9px] uppercase font-black block">Quantity</span>
                        <span className="text-red-600 font-black italic">{ms.quantity} EA</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mb-6 pt-4 border-t border-zinc-900">
                      <span className="text-[10px] text-zinc-700 uppercase font-black">Net Profit</span>
                      <div className="text-right">
                        <span className={`font-black italic block ${profit >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                          {profit >= 0 ? '+' : ''}{profit.toLocaleString()} PTS
                        </span>
                        <span className={`text-[10px] font-bold ${profit >= 0 ? 'text-red-900' : 'text-blue-900'}`}>
                           ({profitRate}%)
                        </span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => handleSell(ms)} 
                      className="w-full border border-zinc-800 py-3 text-[10px] font-black text-zinc-600 hover:text-white hover:border-red-600 hover:bg-red-900/10 transition-all uppercase tracking-[0.2em]"
                    >
                      Liquidate All
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-24 border border-dashed border-zinc-900">
               <div className="text-zinc-800 text-[10px] uppercase font-black tracking-[0.3em]">No Assets Held In Vault</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

window.StockMarket = StockMarket;
