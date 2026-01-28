const { useState, useEffect } = React;

const StockMarket = ({ user, fetchUserList }) => {
  const [stocks, setStocks] = useState([]);
  const [myStocks, setMyStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  
  // 각 종목별 입력 수량을 관리하기 위한 상태
  const [buyQuantities, setBuyQuantities] = useState({});

  // 거래 시간 체크 (19:00 - 02:00)
  const checkMarketStatus = () => {
    const now = new Date();
    const hour = now.getHours();
    return hour >= 19 || hour < 5;
  };

  // 데이터 가져오기 (GitHub Actions가 업데이트한 최신 DB 값을 읽어옴)
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
    const openStatus = checkMarketStatus();
    setIsMarketOpen(openStatus);

    // 시장이 열려있을 때 5초마다 DB에서 새로운 가격을 가져옵니다.
    // (GitHub Actions가 DB를 바꾸면, 이 코드가 그걸 화면에 뿌려주는 역할만 합니다.)
    if (openStatus) {
      fetchMarketData();
      const fetchInterval = setInterval(fetchMarketData, 5000);
      return () => clearInterval(fetchInterval);
    }
  }, [user?.code, isMarketOpen]);

  // 수량 변경 핸들러
  const handleQuantityChange = (stockId, val, maxPossible) => {
    let num = parseInt(val);
    if (isNaN(num) || num < 1) num = 1;
    if (num > maxPossible) num = maxPossible;
    setBuyQuantities(prev => ({ ...prev, [stockId]: num }));
  };

  // 매수 로직
  const handleBuy = async (stock) => {
    const qty = buyQuantities[stock.id] || 1;
    const totalPrice = stock.current_price * qty;

    if (!checkMarketStatus()) return alert('거래 시간이 종료되었습니다.');
    if (user.points < totalPrice) return alert('크레딧이 부족합니다.');
    
    if (!confirm(`[${stock.name}] ${qty}주를 ${totalPrice.toLocaleString()} PTS에 매수하시겠습니까?`)) return;

    try {
      await supabaseClient.from('users').update({ points: user.points - totalPrice }).eq('code', user.code);
      const existing = myStocks.find(s => s.stock_id === stock.id);
      
      if (existing) {
        await supabaseClient.from('user_stocks').update({ quantity: existing.quantity + qty }).eq('id', existing.id);
      } else {
        await supabaseClient.from('user_stocks').insert([{ 
          user_code: user.code, 
          stock_id: stock.id, 
          quantity: qty, 
          avg_price: stock.current_price 
        }]);
      }
      
      alert(`${qty}주 매수 완료`);
      setBuyQuantities(prev => ({ ...prev, [stock.id]: 1 }));
      fetchUserList(); fetchMarketData();
    } catch (e) { alert('거래 실패'); }
  };

  // 매도 로직
  const handleSell = async (ownedItem) => {
    if (!checkMarketStatus()) return alert('거래 시간이 종료되었습니다.');
    const stock = stocks.find(s => s.id === ownedItem.stock_id);
    if (!stock) return;
    if (!confirm(`[${stock.name}] 보유 전량(${ownedItem.quantity}주)을 매도하시겠습니까?`)) return;
    try {
      const totalGain = stock.current_price * ownedItem.quantity;
      await supabaseClient.from('users').update({ points: user.points + totalGain }).eq('code', user.code);
      await supabaseClient.from('user_stocks').delete().eq('id', ownedItem.id);
      alert(`매도 완료: +${totalGain.toLocaleString()} PTS`);
      fetchUserList(); fetchMarketData();
    } catch (e) { alert('거래 실패'); }
  };

  if (!isMarketOpen) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-6 animate-in fade-in zoom-in-95 duration-1000">
        <h2 className="text-8xl font-black text-white italic tracking-tighter uppercase mb-4 opacity-20">Access Denied</h2>
        <h3 className="text-4xl font-black text-red-600 italic tracking-tighter uppercase mb-6">Market is Closed</h3>
        <p className="text-zinc-600 font-bold tracking-[0.3em] uppercase text-sm mb-12">Operation Hours: 19:00 - 05:00</p>
      </div>
    );
  }

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
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-zinc-700 font-black text-[11px] tracking-[0.4em] uppercase mb-6 italic">Market Board</h3>
          {stocks.map(stock => {
            const maxPossible = Math.floor(user.points / stock.current_price);
            const currentQty = buyQuantities[stock.id] || 1;
            
            return (
              <div key={stock.id} className="bg-[#050505] border border-zinc-900 p-8 flex items-center justify-between group hover:border-red-600 transition-all duration-500">
                <div className="flex-1">
                  <span className="text-zinc-600 font-mono text-[10px] uppercase">{stock.symbol}</span>
                  <h4 className="text-2xl font-black text-white italic group-hover:text-red-500 transition-colors uppercase">{stock.name}</h4>
                </div>
                
                <div className="flex items-center gap-8">
                  <div className="text-right min-w-[120px]">
                    <span className="text-2xl font-black text-white italic block">{stock.current_price.toLocaleString()}</span>
                    <span className={`text-xs font-bold ${stock.change_rate >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {stock.change_rate >= 0 ? '▲' : '▼'} {Math.abs(stock.change_rate)}%
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex bg-black border border-zinc-800 p-1">
                      <input 
                        type="number" 
                        value={currentQty}
                        onChange={(e) => handleQuantityChange(stock.id, e.target.value, maxPossible)}
                        className="w-16 bg-transparent text-white text-center font-black text-sm focus:outline-none"
                      />
                      <button 
                        onClick={() => handleQuantityChange(stock.id, maxPossible, maxPossible)}
                        className="px-2 py-1 text-[9px] font-black bg-zinc-900 text-zinc-500 hover:text-white transition-colors"
                      >
                        MAX
                      </button>
                    </div>
                    <button 
                      onClick={() => handleBuy(stock)} 
                      disabled={maxPossible === 0}
                      className={`px-8 py-3 text-xs font-black uppercase transition-all ${maxPossible === 0 ? 'bg-zinc-900 text-zinc-700 cursor-not-allowed' : 'bg-red-900/10 border border-red-900/40 text-red-600 hover:bg-red-900 hover:text-white'}`}
                    >
                      Buy {currentQty > 1 && `${currentQty}EA`}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

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
                      <span className="text-red-600">{ms.quantity} EA</span>
                    </div>
                    <div className="flex justify-between items-center mb-4 text-[10px]">
                      <span className="text-zinc-700 uppercase font-black">Total Profit</span>
                      <span className={`font-black ${profit >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {profit >= 0 ? '+' : ''}{profit.toLocaleString()}
                      </span>
                    </div>
                    <button onClick={() => handleSell(ms)} className="w-full border border-zinc-800 py-2 text-[10px] font-black text-zinc-600 hover:text-white hover:border-white transition-all uppercase tracking-widest">Liquidate All</button>
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
