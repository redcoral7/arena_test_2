const { useState, useEffect, useRef } = React;

const StockMarket = ({ user, fetchUserList }) => {
  if (!user) return null;

  const [stocks, setStocks] = useState([]);
  const [myStocks, setMyStocks] = useState([]);
  const [candleHistory, setCandleHistory] = useState({});
  const [isMarketOpen, setIsMarketOpen] = useState(true);
  
  // 수량 입력을 위한 상태 (종목 ID별로 관리)
  const [buyQtys, setBuyQtys] = useState({});
  const [sellQtys, setSellQtys] = useState({});

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
    const interval = setInterval(fetchMarketData, 5000);
    return () => clearInterval(interval);
  }, [user.code]);

  // 매수 로직 (수량 반영)
  const handleBuy = async (stock) => {
    const qty = parseInt(buyQtys[stock.id]) || 1;
    const total = stock.current_price * qty;
    if (user.points < total) return alert('INSUFFICIENT FUNDS');
    
    try {
      await supabaseClient.from('users').update({ points: user.points - total }).eq('code', user.code);
      const { data: ex } = await supabaseClient.from('user_stocks').select('*').eq('user_code', user.code).eq('stock_id', stock.id).maybeSingle();
      
      if (ex) await supabaseClient.from('user_stocks').update({ quantity: ex.quantity + qty }).eq('id', ex.id);
      else await supabaseClient.from('user_stocks').insert([{ user_code: user.code, stock_id: stock.id, quantity: qty, avg_price: stock.current_price }]);
      
      setBuyQtys(prev => ({ ...prev, [stock.id]: 1 })); // 입력값 초기화
      fetchUserList(); fetchMarketData();
    } catch (e) { alert('ERROR'); }
  };

  // 매도 로직 (수량 반영)
  const handleSell = async (ownedItem) => {
    const qty = parseInt(sellQtys[ownedItem.id]) || 1;
    if (qty > ownedItem.quantity) return alert('EXCEEDS OWNED QUANTITY');
    
    const stock = stocks.find(s => s.id === ownedItem.stock_id);
    const gain = stock.current_price * qty;

    try {
      await supabaseClient.from('users').update({ points: user.points + gain }).eq('code', user.code);
      if (ownedItem.quantity === qty) await supabaseClient.from('user_stocks').delete().eq('id', ownedItem.id);
      else await supabaseClient.from('user_stocks').update({ quantity: ownedItem.quantity - qty }).eq('id', ownedItem.id);
      
      setSellQtys(prev => ({ ...prev, [ownedItem.id]: 1 })); // 입력값 초기화
      fetchUserList(); fetchMarketData();
    } catch (e) { alert('ERROR'); }
  };

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
          {/* LEFT: STOCK LIST (매수) */}
          <div className="col-span-8 space-y-4">
            {stocks.map(stock => (
              <div key={stock.id} className="bg-[#0a0a0a] border border-zinc-900 p-8 flex items-center justify-between group hover:border-zinc-700 transition-all">
                <div className="w-1/4">
                  <p className="text-zinc-800 text-[9px] font-bold uppercase mb-1 tracking-widest">{stock.id.split('-')[0]}</p>
                  <h4 className="text-3xl font-black italic uppercase group-hover:text-red-500 transition-colors">{stock.name}</h4>
                </div>
                <div className="flex-1 flex justify-center"><Chart data={candleHistory[stock.id]} /></div>
                <div className="w-1/3 flex items-center justify-end gap-4">
                  <div className="text-right">
                    <span className="text-3xl font-black italic block leading-none">{stock.current_price.toLocaleString()}</span>
                    <span className={`text-[10px] font-bold ${stock.change_rate >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                      {stock.change_rate >= 0 ? '+' : ''}{stock.change_rate}%
                    </span>
                  </div>
                  {/* 수량 지정 UI */}
                  <div className="flex flex-col gap-1 w-24">
                    <div className="flex border border-zinc-800">
                      <input 
                        type="number" 
                        value={buyQtys[stock.id] || 1}
                        onChange={(e) => setBuyQtys({...buyQtys, [stock.id]: e.target.value})}
                        className="w-full bg-black text-white text-[10px] font-black p-1 text-center outline-none"
                      />
                      <button 
                        onClick={() => setBuyQtys({...buyQtys, [stock.id]: Math.floor(user.points / stock.current_price)})}
                        className="bg-zinc-900 px-1 text-[8px] text-zinc-500 font-bold border-l border-zinc-800 hover:text-white"
                      >MAX</button>
                    </div>
                    <button onClick={() => handleBuy(stock)} className="w-full py-2 bg-red-900/10 border border-red-900/40 text-red-600 text-[10px] font-black uppercase hover:bg-red-900 hover:text-white transition-all">Buy</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT: PORTFOLIO (매도) */}
          <div className="col-span-4 space-y-8">
            <h3 className="text-zinc-700 font-black text-[11px] tracking-[0.3em] uppercase italic mb-6">Your Portfolio</h3>
            {myStocks.length > 0 ? myStocks.map(ms => {
              const currentStock = stocks.find(s => s.id === ms.stock_id);
              const profit = currentStock ? (currentStock.current_price - ms.avg_price) * ms.quantity : 0;
              return (
                <div key={ms.id} className="bg-[#0a0a0a]/50 border-b border-zinc-900 p-6 mb-4 last:border-0">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h5 className="text-white font-black italic text-xl uppercase leading-none">{currentStock?.name}</h5>
                      <p className={`text-[9px] font-bold mt-1 ${profit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        NET PROFIT: {profit >= 0 ? '+' : ''}{Math.floor(profit).toLocaleString()} PTS
                      </p>
                    </div>
                    <span className="text-red-600 font-black text-2xl tracking-tighter">{ms.quantity} <span className="text-[10px] text-zinc-800 uppercase not-italic font-bold">EA</span></span>
                  </div>
                  {/* 판매 수량 지정 UI */}
                  <div className="flex gap-2 h-8">
                    <div className="flex flex-1 border border-zinc-900 bg-black">
                      <input 
                        type="number" 
                        value={sellQtys[ms.id] || 1}
                        onChange={(e) => setSellQtys({...sellQtys, [ms.id]: e.target.value})}
                        className="w-full bg-transparent text-white text-[10px] font-black p-1 text-center outline-none"
                      />
                      <button 
                        onClick={() => setSellQtys({...sellQtys, [ms.id]: ms.quantity})}
                        className="bg-zinc-900 px-2 text-[8px] text-zinc-600 font-bold border-l border-zinc-900 hover:text-white"
                      >MAX</button>
                    </div>
                    <button 
                      onClick={() => handleSell(ms)}
                      className="flex-1 bg-transparent border border-zinc-800 text-zinc-600 text-[9px] font-black uppercase hover:border-red-600 hover:text-white transition-all"
                    >Liquidate</button>
                  </div>
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
