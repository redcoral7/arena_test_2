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
    const interval = setInterval(fetchMarketData, 5000); // 5초마다 시세 갱신
    return () => clearInterval(interval);
  }, [user?.code]);

  // 2. 매수 로직
  const handleBuy = async (stock) => {
    if (user.points < stock.current_price) return alert('크레딧이 부족합니다.');
    if (!confirm(`[${stock.name}] 1주를 ${stock.current_price} PTS에 매수하시겠습니까?`)) return;

    try {
      // 포인트 차감
      await supabaseClient.from('users').update({ points: user.points - stock.current_price }).eq('code', user.code);
      
      // 보유 주식 추가 (간소화를 위해 매수할 때마다 레코드 추가 또는 수량 업데이트)
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

  // 3. 매도 로직
  const handleSell = async (ownedItem) => {
    const stock = stocks.find(s => s.id === ownedItem.stock_id);
    if (!stock) return;
    if (!confirm(`[${stock.name}] 전량을 매도하시겠습니까?`)) return;

    try {
      const totalGain = stock.current_price * ownedItem.quantity;
      await supabaseClient.from('users').update({ points: user.points + totalGain }).eq('code', user.code);
      await supabaseClient.from('user_stocks').delete().eq('id', ownedItem.id);
      
      alert(`매도 완료: +${totalGain} PTS`);
      fetchUserList(); fetchMarketData();
    } catch (e) { alert('거래 실패'); }
  };

  if (loading) return <div className="pt-40 text-center text-red-900 font-black animate-pulse">ACCESSING MARKET...</div>;

  return (
    <div className="max-w-7xl mx-auto pt-24 px-8 pb-32 animate-in slide-in-from-bottom-8">
      <div className="flex justify-between items-end mb-16 border-l-4 border-red-900 pl-8 py-2">
        <div>
          <h2 className="text-6xl font-black text-white italic tracking-tighter uppercase mb-2">Exchange</h2>
          <p className="text-red-900 font-black tracking-[0.5em] text-[10px] uppercase">Stock Market / Real-time Trading</p>
        </div>
        <div className="text-right">
          <span className="text-zinc-600 text-[10px] uppercase font-black block mb-2">Available Balance</span>
          <span className="text-4xl font-black text-red-600 italic tracking-tighter">{user.points.toLocaleString()} <span className="text-sm not-italic ml-1">PTS</span></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* 주식 리스트 */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-zinc-700 font-black text-[11px] tracking-[0.4em] uppercase mb-6 italic">Market Board</h3>
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

        {/* 보유 주식 (포트폴리오) */}
        <div className="bg-[#050505] border border-zinc-900 p-8 h-fit">
          <h3 className="text-zinc-700 font-black text-[11px] tracking-[0.4em] uppercase mb-8 italic">Your Portfolio</h3>
          {myStocks.length > 0 ? (
            <div className="space-y-6">
              {myStocks.map(ms => {
                const currentStock = stocks.find(s => s.id === ms.stock_id);
                const profit = currentStock ? (currentStock.current_price - ms.avg_price) * ms.quantity : 0;
                return (
                  <div key={ms.id} className="border-b border-zinc-900 pb-6 last:border-0">
                    <div className="flex justify-between mb-2 text-zinc-400 font-black italic uppercase">
                      <span>{currentStock?.name}</span>
                      <span>{ms.quantity} EA</span>
                    </div>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] text-zinc-700 uppercase">Profit/Loss</span>
                      <span className={`font-black ${profit >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {profit >= 0 ? '+' : ''}{profit.toLocaleString()}
                      </span>
                    </div>
                    <button onClick={() => handleSell(ms)} className="w-full border border-zinc-800 py-2 text-[10px] font-black text-zinc-600 hover:text-white hover:border-white transition-all uppercase">Sell All</button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 border border-dashed border-zinc-900 text-zinc-800 text-[10px] uppercase tracking-widest">No Assets Held</div>
          )}
        </div>
      </div>
    </div>
  );
};

window.StockMarket = StockMarket;
