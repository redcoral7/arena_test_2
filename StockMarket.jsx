const { useState, useEffect, useRef } = React;

const StockMarket = ({ user, fetchUserList }) => {
  if (!user) return null;

  const [stocks, setStocks] = useState([]);
  const [myStocks, setMyStocks] = useState([]);
  const [candleHistory, setCandleHistory] = useState({});
  const [isMarketOpen, setIsMarketOpen] = useState(true);

  // 데이터 가져오기 (5초 주기)
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
            
            // 이미지 스타일의 꼬리 생성
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

  // 1. 매수 함수 (1주씩)
  const handleBuy = async (stock) => {
    const qty = 1;
    const total = stock.current_price * qty;
    if (user.points < total) return alert('잔액 부족');
    
    try {
      await supabaseClient.from('users').update({ points: user.points - total }).eq('code', user.code);
      const { data: existing } = await supabaseClient.from('user_stocks').select('*').eq('user_code', user.code).eq('stock_id', stock.id).maybeSingle();
      
      if (existing) {
        await supabaseClient.from('user_stocks').update({ quantity: existing.quantity + qty }).eq('id', existing.id);
      } else {
        await supabaseClient.from('user_stocks').insert([{ user_code: user.code, stock_id: stock.id, quantity: qty, avg_price: stock.current_price }]);
      }
      fetchUserList(); fetchMarketData();
    } catch (e) { alert('매수 오류'); }
  };

  // 2. 매도 함수 (1주씩)
  const handleSell = async (ownedItem) => {
    if (ownedItem.quantity <= 0) return;
    const stock = stocks.find(s => s.id === ownedItem.stock_id);
    const gain = stock.current_price * 1;

    try {
      await supabaseClient.from('users').update({ points: user.points + gain }).eq('code', user.code);
      if (ownedItem.quantity === 1) {
        await supabaseClient.from('user_stocks').delete().eq('id', ownedItem.id);
      } else {
        await supabaseClient.from('user_stocks').update({ quantity: ownedItem.quantity - 1 }).eq('id', ownedItem.id);
      }
      fetchUserList(); fetchMarketData();
    } catch (e) { alert('매도 오류'); }
  };

  // 캔들 차트 컴포넌트 (디자인 롤백)
  const Chart = ({ data }) => {
    if (!data || data.length < 2) return <div className="w-60 h-20 bg-white/5 animate-pulse rounded" />;
    const vals = data.flatMap(d => [d.high, d.low]);
    const min = Math.min(...vals) * 0.999, max = Math.max(...vals) * 1.001, range = max - min;
    const h = 80, w = 280, cW = w / data.length;

    return (
      <svg width={w} height={h} className="overflow-visible">
        {[0.25, 0.5, 0.75].map(v => <line key={v} x1="0" y1={h*v} x2={w} y2={h*v} stroke="white" strokeWidth="0.5" opacity="0.05" />)}
        {data.map((d, i) => {
          const x = i*cW+cW/2, up = d.close >= d.open, col = up ? '#ff4d4d' : '#4d79ff';
          return (
            <g key={i}>
              <line x1={x} y1={h-((d.high-min)/range)*h} x2={x} y2={h-((d.low-min)/range)*h} stroke={col} strokeWidth="1" />
              <rect x={x-2} y={Math.min(h-((d.open-min)/range)*h, h-((d.close-min)/range)*h)} width="4" height={Math.max(Math.abs((h-((d.open-min)/range)*h)-(h-((d.close-min)/range)*h)), 1)} fill={col} />
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="max-w-7xl mx-auto pt-32 px-10 pb-40 font-serif bg-black min-h-screen text-white">
      {/* HEADER */}
      <div className="flex justify-between items-end mb-24 border-l-[12px] border-red-900 pl-10">
        <div>
          <h2 className="text-8xl font-black italic uppercase tracking-tighter leading-none">Market</h2>
          <p className="text-zinc-600 text-[10px] tracking-[0.8em] uppercase font-bold mt-2">● Realtime Exchange</p>
        </div>
        <p className="text-6xl font-black italic tracking-tighter text-red-600">{user.points.toLocaleString()} PTS</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-16">
        {/* STOCK LIST */}
        <div className="lg:col-span-3 space-y-6">
          {stocks.map(stock => (
            <div key={stock.id} className="bg-[#050505] border border-zinc-900 p-12 flex items-center justify-between group hover:border-red-900 transition-all">
              <div className="w-1/4">
                <h4 className="text-4xl font-black italic uppercase group-hover:text-red-500 transition-colors">{stock.name}</h4>
                <p className="text-zinc-600 text-[10px] font-bold mt-1 uppercase tracking-widest">{stock.current_price.toLocaleString()} KRW</p>
              </div>
              <div className="flex-1 flex justify-center"><Chart data={candleHistory[stock.id]} /></div>
              <div className="text-right ml-10">
                <button 
                  onClick={() => handleBuy(stock)}
                  className="px-10 py-4 bg-red-900/10 border border-red-900/40 text-red-600 text-[11px] font-black uppercase hover:bg-red-900 hover:text-white transition-all active:scale-95"
                >
                  Purchase 1
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* PORTFOLIO (판매 버튼 포함) */}
        <div className="lg:col-span-1 bg-[#080808] border border-zinc-900 p-10 h-fit sticky top-40">
          <h3 className="text-zinc-700 font-black text-[11px] tracking-[0.3em] uppercase mb-10 italic">Your Assets</h3>
          {myStocks.length > 0 ? (
            <div className="space-y-10">
              {myStocks.map(ms => (
                <div key={ms.id} className="group">
                  <div className="flex justify-between items-end mb-4">
                    <span className="text-white font-black italic text-xl uppercase tracking-tighter">
                      {stocks.find(s=>s.id===ms.stock_id)?.name}
                    </span>
                    <span className="text-red-600 font-black text-2xl">{ms.quantity}</span>
                  </div>
                  <button 
                    onClick={() => handleSell(ms)}
                    className="w-full py-3 border border-zinc-800 text-zinc-600 text-[10px] font-black uppercase hover:border-red-600 hover:text-white transition-all"
                  >
                    Liquidate 1 EA
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-20 text-zinc-800 font-black italic uppercase tracking-widest">No Holdings</p>
          )}
        </div>
      </div>
    </div>
  );
};

window.StockMarket = StockMarket;
