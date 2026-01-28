// StockMarket.jsx 전체 코드
const { useState, useEffect } = React;

const StockMarket = ({ user, fetchUserList }) => {
  if (!user) return null;

  const [stocks, setStocks] = useState([]);
  const [myStocks, setMyStocks] = useState([]);
  const [candleHistory, setCandleHistory] = useState({});
  const [isMarketOpen, setIsMarketOpen] = useState(false);

  const checkMarketStatus = () => {
    const now = new Date();
    const hour = now.getHours();
    return hour >= 19 || hour < 5; 
  };

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
            
            // 캔들 꼬리 랜덤 생성 (이미지 스타일)
            const high = Math.max(open, close) + (Math.random() * 10);
            const low = Math.min(open, close) - (Math.random() * 10);
            
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
    } catch (err) { console.error('Sync Error:', err); }
  };

  useEffect(() => {
    const openStatus = checkMarketStatus();
    setIsMarketOpen(openStatus);

    if (openStatus) {
      fetchMarketData();
      // GitHub Actions가 5초마다 DB를 바꾸므로, 프론트도 5초마다 가져옵니다.
      const interval = setInterval(fetchMarketData, 5000);
      return () => clearInterval(interval);
    }
  }, [user?.code, isMarketOpen]);

  // 차트 디자인 (image_7d09ba.jpg 스타일)
  const CandleChart = ({ data }) => {
    if (!data || data.length < 2) return <div className="w-60 h-20 bg-white/5 rounded italic text-[10px] flex items-center justify-center text-zinc-800">CONNECTING...</div>;
    const allValues = data.flatMap(d => [d.high, d.low]);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = (max - min) || 1;
    const height = 80;
    const width = 280;
    const candleWidth = width / data.length;

    return (
      <svg width={width} height={height} className="overflow-visible">
        {[0.25, 0.5, 0.75].map(v => (
          <line key={v} x1="0" y1={height * v} x2={width} y2={height * v} stroke="white" strokeWidth="0.5" opacity="0.05" />
        ))}
        {data.map((d, i) => {
          const x = i * candleWidth + candleWidth / 2;
          const isUp = d.close >= d.open;
          const color = isUp ? '#22c55e' : '#ef4444';
          return (
            <g key={i}>
              <line x1={x} y1={height - ((d.high - min) / range) * height} x2={x} y2={height - ((d.low - min) / range) * height} stroke={color} strokeWidth="1" />
              <rect x={x - 2.5} y={Math.min(height - ((d.open - min) / range) * height, height - ((d.close - min) / range) * height)} width="5" height={Math.max(Math.abs((height - ((d.open - min) / range) * height) - (height - ((d.close - min) / range) * height)), 1)} fill={color} />
            </g>
          );
        })}
      </svg>
    );
  };

  const handleBuy = async (stock) => {
    const qty = 1;
    const total = stock.current_price * qty;
    if (user.points < total) return alert('잔액 부족');
    try {
      await supabaseClient.from('users').update({ points: user.points - total }).eq('code', user.code);
      const { data: existing } = await supabaseClient.from('user_stocks').select('*').eq('user_code', user.code).eq('stock_id', stock.id).maybeSingle();
      if (existing) await supabaseClient.from('user_stocks').update({ quantity: existing.quantity + qty }).eq('id', existing.id);
      else await supabaseClient.from('user_stocks').insert([{ user_code: user.code, stock_id: stock.id, quantity: qty, avg_price: stock.current_price }]);
      alert('매수 완료'); fetchUserList(); fetchMarketData();
    } catch (e) { alert('실패'); }
  };

  if (!isMarketOpen) return <div className="h-screen flex items-center justify-center font-black text-white/5 text-9xl italic">CLOSED</div>;

  return (
    <div className="max-w-7xl mx-auto pt-32 px-10 pb-40">
      <div className="flex justify-between items-end mb-24 border-l-[12px] border-red-900 pl-10 font-black italic">
        <div>
          <h2 className="text-8xl text-white uppercase tracking-tighter">Live Market</h2>
          <p className="text-red-600 text-[10px] tracking-[0.5em] uppercase">GitHub Action 5s Loop Running</p>
        </div>
        <p className="text-6xl text-red-600">{user.points.toLocaleString()} PTS</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
        <div className="lg:col-span-2 space-y-6">
          {stocks.map(stock => (
            <div key={stock.id} className="bg-[#050505] border border-zinc-900 p-12 flex items-center justify-between group hover:border-red-900 transition-all">
              <h4 className="text-4xl font-black text-white italic uppercase w-1/4">{stock.name}</h4>
              <div className="flex-1 flex justify-center"><CandleChart data={candleHistory[stock.id]} /></div>
              <div className="text-right">
                <p className="text-4xl font-black text-white italic mb-2">{stock.current_price.toLocaleString()}</p>
                <button onClick={() => handleBuy(stock)} className="px-10 py-3 bg-red-900/10 border border-red-900/40 text-red-600 text-[11px] font-black uppercase hover:bg-red-900 hover:text-white transition-all">Buy</button>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-[#050505] border border-zinc-900 p-10 h-fit sticky top-32">
          <h3 className="text-zinc-700 font-black text-[12px] uppercase mb-10 italic">Assets</h3>
          {myStocks.length > 0 ? myStocks.map(ms => (
            <div key={ms.id} className="border-b border-zinc-900 pb-8 mb-8 last:border-0 flex justify-between items-center font-black italic">
              <span className="text-zinc-400 text-xl uppercase">{stocks.find(st=>st.id===ms.stock_id)?.name}</span>
              <span className="text-red-600">{ms.quantity} EA</span>
            </div>
          )) : <p className="text-center py-20 text-zinc-800 font-black italic">NO DATA</p>}
        </div>
      </div>
    </div>
  );
};

window.StockMarket = StockMarket;
