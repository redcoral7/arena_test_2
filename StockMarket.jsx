const { useState, useEffect, useRef } = React;

const StockMarket = ({ user, fetchUserList }) => {
  const [stocks, setStocks] = useState([]);
  const [myStocks, setMyStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  
  // 입력 수량 상태 (매수/매도 각각 관리)
  const [buyQtys, setBuyQtys] = useState({});
  const [sellQtys, setSellQtys] = useState({});
  // 차트 데이터를 위한 상태
  const [candleHistory, setCandleHistory] = useState({});

  const checkMarketStatus = () => {
    const now = new Date();
    const hour = now.getHours();
    return hour >= 19 || hour < 5;
  };

  const fetchMarketData = async () => {
    if (!user) return;
    try {
      const { data: stockData } = await supabaseClient
        .from('stocks')
        .select('*')
        .order('name', { ascending: true });
      
      if (stockData) {
        setStocks(stockData);
        // 차트 데이터 업데이트 로직
        setCandleHistory(prev => {
          const newHistory = { ...prev };
          stockData.forEach(stock => {
            const history = newHistory[stock.id] || [];
            const lastCandle = history[history.length - 1];
            const open = lastCandle ? lastCandle.close : stock.current_price;
            const close = stock.current_price;
            
            // 시각적 효과를 위한 미세 변동 추가
            const volatility = close * 0.002;
            const high = Math.max(open, close) + (Math.random() * volatility);
            const low = Math.min(open, close) - (Math.random() * volatility);
            
            newHistory[stock.id] = [...history, { open, close, high, low }].slice(-40);
          });
          return newHistory;
        });
      }

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

    if (openStatus) {
      fetchMarketData();
      const fetchInterval = setInterval(fetchMarketData, 5000);
      return () => clearInterval(fetchInterval);
    }
  }, [user?.code, isMarketOpen]);

  // 수량 변경 공통 핸들러
  const handleQtyInput = (id, val, setter) => {
    const num = parseInt(val) || 1;
    setter(prev => ({ ...prev, [id]: num }));
  };

  // 매수 로직
  const handleBuy = async (stock) => {
    const qty = buyQtys[stock.id] || 1;
    const totalPrice = stock.current_price * qty;

    if (!checkMarketStatus()) return alert('거래 시간이 종료되었습니다.');
    if (user.points < totalPrice) return alert('크레딧이 부족합니다.');
    
    if (!confirm(`[${stock.name}] ${qty}주를 매수하시겠습니까?`)) return;

    try {
      await supabaseClient.from('users').update({ points: user.points - totalPrice }).eq('code', user.code);
      const existing = myStocks.find(s => s.stock_id === stock.id);
      if (existing) {
        await supabaseClient.from('user_stocks').update({ quantity: existing.quantity + qty }).eq('id', existing.id);
      } else {
        await supabaseClient.from('user_stocks').insert([{ user_code: user.code, stock_id: stock.id, quantity: qty, avg_price: stock.current_price }]);
      }
      setBuyQtys(prev => ({ ...prev, [stock.id]: 1 }));
      fetchUserList(); fetchMarketData();
    } catch (e) { alert('거래 실패'); }
  };

  // 매도 로직 (개수 지정 추가)
  const handleSell = async (ownedItem) => {
    const qty = sellQtys[ownedItem.id] || 1;
    if (qty > ownedItem.quantity) return alert('보유 수량을 초과했습니다.');
    
    if (!checkMarketStatus()) return alert('거래 시간이 종료되었습니다.');
    const stock = stocks.find(s => s.id === ownedItem.stock_id);
    if (!stock) return;
    
    if (!confirm(`[${stock.name}] ${qty}주를 매도하시겠습니까?`)) return;
    
    try {
      const totalGain = stock.current_price * qty;
      await supabaseClient.from('users').update({ points: user.points + totalGain }).eq('code', user.code);
      
      if (ownedItem.quantity === qty) {
        await supabaseClient.from('user_stocks').delete().eq('id', ownedItem.id);
      } else {
        await supabaseClient.from('user_stocks').update({ quantity: ownedItem.quantity - qty }).eq('id', ownedItem.id);
      }
      
      setSellQtys(prev => ({ ...prev, [ownedItem.id]: 1 }));
      fetchUserList(); fetchMarketData();
    } catch (e) { alert('거래 실패'); }
  };

  // 캔들 차트 컴포넌트
  const CandleChart = ({ data }) => {
    if (!data || data.length < 2) return <div className="w-48 h-12 bg-zinc-900/30 rounded" />;
    const allVals = data.flatMap(d => [d.high, d.low]);
    const min = Math.min(...allVals) * 0.999, max = Math.max(...allVals) * 1.001, range = max - min;
    const h = 60, w = 200, cW = w / data.length;

    return (
      <svg width={w} height={h} className="overflow-visible">
        {data.map((d, i) => {
          const x = i * cW + cW / 2;
          const isUp = d.close >= d.open;
          const color = isUp ? '#ff4d4d' : '#4d79ff';
          const yH = h - ((d.high - min) / range) * h;
          const yL = h - ((d.low - min) / range) * h;
          const yO = h - ((d.open - min) / range) * h;
          const yC = h - ((d.close - min) / range) * h;
          return (
            <g key={i}>
              <line x1={x} y1={yH} x2={x} y2={yL} stroke={color} strokeWidth="1" />
              <rect x={x - 1.5} y={Math.min(yO, yC)} width="3" height={Math.max(Math.abs(yO - yC), 1)} fill={color} />
            </g>
          );
        })}
      </svg>
    );
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
    <div className="max-w-7xl mx-auto pt-24 px-8 pb-32">
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
            const maxBuy = Math.floor(user.points / stock.current_price);
            const currentBuyQty = buyQtys[stock.id] || 1;
            
            return (
              <div key={stock.id} className="bg-[#050505] border border-zinc-900 p-8 flex items-center justify-between group hover:border-red-600 transition-all">
                <div className="w-1/4">
                  <span className="text-zinc-600 font-mono text-[10px] uppercase">{stock.symbol}</span>
                  <h4 className="text-2xl font-black text-white italic group-hover:text-red-500 transition-colors uppercase">{stock.name}</h4>
                </div>
                
                <div className="flex-1 flex justify-center"><CandleChart data={candleHistory[stock.id]} /></div>

                <div className="flex items-center gap-6">
                  <div className="text-right min-w-[100px]">
                    <span className="text-2xl font-black text-white italic block">{stock.current_price.toLocaleString()}</span>
                    <span className={`text-xs font-bold ${stock.change_rate >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                      {stock.change_rate >= 0 ? '▲' : '▼'} {Math.abs(stock.change_rate)}%
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex bg-black border border-zinc-800 p-1">
                      <input type="number" value={currentBuyQty} onChange={(e) => handleQtyInput(stock.id, e.target.value, setBuyQtys)} className="w-12 bg-transparent text-white text-center font-black text-xs outline-none" />
                      <button onClick={() => setBuyQtys({...buyQtys, [stock.id]: maxBuy})} className="px-2 text-[8px] font-black bg-zinc-900 text-zinc-500 hover:text-white">MAX</button>
                    </div>
                    <button onClick={() => handleBuy(stock)} disabled={maxBuy === 0} className="px-6 py-2 bg-red-900/10 border border-red-900/40 text-red-600 text-[10px] font-black uppercase hover:bg-red-900 hover:text-white transition-all">Buy</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-[#050505] border border-zinc-900 p-8 h-fit">
          <h3 className="text-zinc-700 font-black text-[11px] tracking-[0.4em] uppercase mb-8 italic">Your Portfolio</h3>
          {myStocks.length > 0 ? (
            <div className="space-y-8">
              {myStocks.map(ms => {
                const currentStock = stocks.find(s => s.id === ms.stock_id);
                const profit = currentStock ? (currentStock.current_price - ms.avg_price) * ms.quantity : 0;
                const currentSellQty = sellQtys[ms.id] || 1;
                return (
                  <div key={ms.id} className="border-b border-zinc-900 pb-6 last:border-0">
                    <div className="flex justify-between mb-2 items-end">
                      <span className="text-white font-black italic text-lg uppercase leading-none">{currentStock?.name}</span>
                      <span className="text-red-600 font-black text-xl leading-none">{ms.quantity} EA</span>
                    </div>
                    <div className="flex justify-between items-center mb-4 text-[9px] font-black uppercase tracking-tighter">
                      <span className="text-zinc-700">Net Profit</span>
                      <span className={profit >= 0 ? 'text-red-600' : 'text-blue-600'}>{profit >= 0 ? '+' : ''}{Math.floor(profit).toLocaleString()} PTS</span>
                    </div>
                    
                    <div className="flex gap-2">
                      <div className="flex bg-black border border-zinc-900 p-1 flex-1">
                        <input type="number" value={currentSellQty} onChange={(e) => handleQtyInput(ms.id, e.target.value, setSellQtys)} className="w-full bg-transparent text-white text-center font-black text-xs outline-none" />
                        <button onClick={() => setSellQtys({...sellQtys, [ms.id]: ms.quantity})} className="px-2 text-[8px] font-black bg-zinc-900 text-zinc-500 hover:text-white border-l border-zinc-800">MAX</button>
                      </div>
                      <button onClick={() => handleSell(ms)} className="flex-1 bg-transparent border border-zinc-800 text-zinc-600 text-[10px] font-black uppercase hover:border-red-600 hover:text-white transition-all py-2">Sell</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 border border-dashed border-zinc-900 text-zinc-800 text-[10px] uppercase tracking-widest leading-loose">No Assets Held<br/>Market Active</div>
          )}
        </div>
      </div>
    </div>
  );
};

window.StockMarket = StockMarket;
