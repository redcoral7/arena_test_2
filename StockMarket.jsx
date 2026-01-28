const { useState, useEffect, useRef } = React;

const StockMarket = ({ user, fetchUserList }) => {
  if (!user) return null;

  const [stocks, setStocks] = useState([]);
  const [myStocks, setMyStocks] = useState([]);
  const [candleHistory, setCandleHistory] = useState({});
  const [isMarketOpen, setIsMarketOpen] = useState(true);

  const fetchMarketData = async () => {
    try {
      const { data: stockData } = await supabaseClient
        .from('stocks')
        .select('*')
        .order('name', { ascending: true });
      
      if (stockData) {
        setStocks(stockData);
        setCandleHistory(prev => {
          const newHistory = { ...prev };
          stockData.forEach(stock => {
            const history = newHistory[stock.id] || [];
            const lastCandle = history[history.length - 1];
            const open = lastCandle ? lastCandle.close : stock.current_price;
            const close = stock.current_price;
            const volatility = close * 0.003; 
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
    } catch (err) { console.error('Error:', err); }
  };

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 5000); // 5초 동기화
    return () => clearInterval(interval);
  }, [user.code]);

  // 매수 (1주 고정)
  const handleBuy = async (stock) => {
    const total = stock.current_price;
    if (user.points < total) return alert('INSUFFICIENT FUNDS');
    try {
      await supabaseClient.from('users').update({ points: user.points - total }).eq('code', user.code);
      const { data: ex } = await supabaseClient.from('user_stocks').select('*').eq('user_code', user.code).eq('stock_id', stock.id).maybeSingle();
      if (ex) await supabaseClient.from('user_stocks').update({ quantity: ex.quantity + 1 }).eq('id', ex.id);
      else await supabaseClient.from('user_stocks').insert([{ user_code: user.code, stock_id: stock.id, quantity: 1, avg_price: stock.current_price }]);
      fetchUserList(); fetchMarketData();
    } catch (e) { alert('ERROR'); }
  };

  // 매도 (보유량 중 1주만 판매)
  const handleSell = async (ownedItem) => {
    if (ownedItem.quantity <= 0) return;
    const stock = stocks.find(s => s.id === ownedItem.stock_id);
    const gain = stock.current_price;
    try {
      await supabaseClient.from('users').update({ points: user.points + gain }).eq('code', user.code);
      if (ownedItem.quantity === 1) await supabaseClient.from('user_stocks').delete().eq('id', ownedItem.id);
      else await supabaseClient.from('user_stocks').update({ quantity: ownedItem.quantity - 1 }).eq('id', ownedItem.id);
      fetchUserList(); fetchMarketData();
    } catch (e) { alert('ERROR'); }
  };

  // 차트 (High-End 캔들 디자인)
  const Chart = ({ data }) => {
    if (!data || data.length < 2) return <div className="w-60 h-16 bg-white/5 animate-pulse" />;
    const vals = data.flatMap(d => [d.high, d.low]);
    const min = Math.min(...vals) * 0.999, max = Math.max(...vals) * 1.001, range = max - min;
    const h = 60, w = 240, cW = w / data.length;
    return (
      <svg width={w} height={h} className="overflow-visible">
        {data.map((d, i) => {
          const x = i*cW+cW/2, up = d.close >= d.open, col = up ? '#ff4d4d' : '#4d79ff';
          return (
            <g key={i}>
              <line x1={x} y1={h-((d.high-min)/range)*h} x2={x} y2={h-((d.low-min)/range)*h} stroke={col} strokeWidth="1" />
              <rect x={x-1.5} y={Math.min(h-((d.open-min)/range)*h, h-((d.close-min)/range)*h)} width="3" height={Math.max(Math.abs((h-((d.open-min)/range)*h)-(h-((d.close-min)/range)*h)), 1)} fill={col} />
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white p-10 font-serif">
      <div className="max-w-[1400px] mx-auto">
        {/* HEADER */}
        <div className="flex justify-between items-start mb-20">
          <div className="border-l-4 border-red-700 pl-6">
            <h1 className="text-7xl font-black italic uppercase tracking-tighter leading-none">Exchange</h1>
            <p className="text-zinc-700 text-[10px] tracking-[0.5em] font-bold mt-2 uppercase">● Live Trading Active</p>
          </div>
          <div className="text-right">
            <p className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Available Credits</p>
            <p className="text-5xl font-black italic tracking-tighter text-red-600">{user.points.toLocaleString()} <span className="text-sm">PTS</span></p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-16">
          {/* LEFT: STOCK LIST */}
          <div className="col-span-8 space-y-4">
            {stocks.map(stock => (
              <div key={stock.id} className="bg-[#0a0a0a] border border-zinc-900 p-8 flex items-center justify-between group hover:border-zinc-700 transition-all">
                <div className="w-1/4">
                  <p className="text-zinc-600 text-[9px] font-bold uppercase tracking-widest mb-1">Asset</p>
                  <h4 className="text-3xl font-black italic uppercase group-hover:text-red-500 transition-colors">{stock.name}</h4>
                </div>
                <div className="flex-1 flex justify-center"><Chart data={candleHistory[stock.id]} /></div>
                <div className="w-1/4 text-right flex flex-col items-end gap-2">
                  <span className="text-3xl font-black italic">{stock.current_price.toLocaleString()}</span>
                  <button onClick={() => handleBuy(stock)} className="px-8 py-2 bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] font-black uppercase hover:bg-red-700 hover:text-white transition-all">Buy</button>
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT: PORTFOLIO & LIQUIDATE */}
          <div className="col-span-4 space-y-8">
            <h3 className="text-zinc-700 font-black text-[11px] tracking-[0.3em] uppercase italic mb-6">Your Portfolio</h3>
            {myStocks.length > 0 ? myStocks.map(ms => {
              const currentStock = stocks.find(s => s.id === ms.stock_id);
              const profit = currentStock ? (currentStock.current_price - ms.avg_price) * ms.quantity : 0;
              return (
                <div key={ms.id} className="border-b border-zinc-900 pb-6 mb-6 last:border-0">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <h5 className="text-white font-black italic text-xl uppercase">{currentStock?.name}</h5>
                      <p className={`text-[10px] font-bold ${profit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        NET PROFIT: {profit >= 0 ? '+' : ''}{Math.floor(profit).toLocaleString()} PTS
                      </p>
                    </div>
                    <span className="text-red-600 font-black text-2xl tracking-tighter">{ms.quantity} <span className="text-[10px] text-zinc-800 uppercase not-italic">EA</span></span>
                  </div>
                  <button 
                    onClick={() => handleSell(ms)}
                    className="w-full py-2 bg-transparent border border-zinc-800 text-zinc-700 text-[9px] font-black uppercase hover:border-zinc-500 hover:text-zinc-300 transition-all mt-4"
                  >
                    Liquidate 1 EA
                  </button>
                </div>
              );
            }) : <p className="text-zinc-800 font-black italic text-center py-20 uppercase tracking-widest">Empty</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

window.StockMarket = StockMarket;
