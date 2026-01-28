const { useState, useEffect, useRef } = React;

const StockMarket = ({ user, fetchUserList }) => {
  if (!user) return null;

  const [stocks, setStocks] = useState([]);
  const [myStocks, setMyStocks] = useState([]);
  const [candleHistory, setCandleHistory] = useState({});
  const [isMarketOpen, setIsMarketOpen] = useState(true);
  
  // 수량 입력을 위한 상태 (종목 ID별로 관리)
  const [quantities, setQuantities] = useState({});

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
            
            // 이미지 스타일의 뾰족한 꼬리 생성
            const volatility = close * 0.003; 
            const high = Math.max(open, close) + (Math.random() * volatility);
            const low = Math.min(open, close) - (Math.random() * volatility);
            
            newHistory[stock.id] = [...history, { open, close, high, low }].slice(-50);
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
      console.error('Fetch Error:', err);
    }
  };

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 5000);
    return () => clearInterval(interval);
  }, [user.code]);

  // 수량 변경 핸들러
  const handleQtyChange = (id, val) => {
    const num = parseInt(val) || 1;
    setQuantities(prev => ({ ...prev, [id]: num }));
  };

  const handleBuy = async (stock) => {
    const qty = quantities[stock.id] || 1; // 입력된 수량, 없으면 기본 1주
    if (qty <= 0) return alert('1주 이상 입력해주세요.');

    const total = stock.current_price * qty;
    if (user.points < total) return alert('포인트가 부족합니다.');
    
    try {
      // 1. 포인트 차감
      await supabaseClient.from('users').update({ points: user.points - total }).eq('code', user.code);
      
      // 2. 이미 가지고 있는지 확인
      const { data: existing } = await supabaseClient
        .from('user_stocks')
        .select('*')
        .eq('user_code', user.code)
        .eq('stock_id', stock.id)
        .maybeSingle();
      
      if (existing) {
        // 있으면 수량 추가
        await supabaseClient.from('user_stocks').update({ quantity: existing.quantity + qty }).eq('id', existing.id);
      } else {
        // 없으면 새로 추가
        await supabaseClient.from('user_stocks').insert([{ 
          user_code: user.code, 
          stock_id: stock.id, 
          quantity: qty, 
          avg_price: stock.current_price 
        }]);
      }
      
      alert(`${stock.name} ${qty}주 매수 완료!`);
      fetchUserList();
      fetchMarketData();
    } catch (e) {
      alert('매수 실패: 서버 오류');
    }
  };

  // --- 캔들 차트 컴포넌트 ---
  const CandleChart = ({ data }) => {
    if (!data || data.length < 2) return <div className="w-60 h-24 bg-zinc-900/20 rounded" />;
    const allValues = data.flatMap(d => [d.high, d.low]);
    const min = Math.min(...allValues) * 0.998;
    const max = Math.max(...allValues) * 1.002;
    const range = max - min;
    const height = 100, width = 300, cW = width / data.length;

    return (
      <svg width={width} height={height} className="overflow-visible">
        {[0.25, 0.5, 0.75].map(v => <line key={v} x1="0" y1={height*v} x2={width} y2={height*v} stroke="white" strokeWidth="0.5" opacity="0.03" />)}
        {data.map((d, i) => {
          const x = i * cW + cW / 2;
          const isUp = d.close >= d.open;
          const color = isUp ? '#ff4d4d' : '#4d79ff';
          const yH = height - ((d.high - min) / range) * height;
          const yL = height - ((d.low - min) / range) * height;
          const yO = height - ((d.open - min) / range) * height;
          const yC = height - ((d.close - min) / range) * height;
          return (
            <g key={i}>
              <line x1={x} y1={yH} x2={x} y2={yL} stroke={color} strokeWidth="1" />
              <rect x={x - 2} y={Math.min(yO, yC)} width="4" height={Math.max(Math.abs(yO - yC), 1)} fill={color} />
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="max-w-7xl mx-auto pt-32 px-10 pb-40 font-serif bg-black min-h-screen text-white">
      {/* 헤더 섹션 */}
      <div className="flex justify-between items-baseline mb-24 border-b border-zinc-900 pb-10">
        <div>
          <h2 className="text-8xl font-black italic uppercase tracking-tighter leading-none mb-4">Market</h2>
          <p className="text-red-600 text-[10px] tracking-[0.8em] uppercase font-bold animate-pulse">● Live Data Stream</p>
        </div>
        <div className="text-right">
          <p className="text-6xl font-black italic tracking-tighter text-red-600">{user.points.toLocaleString()} PTS</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-20">
        <div className="lg:col-span-3 space-y-4">
          {stocks.map(stock => (
            <div key={stock.id} className="flex items-center justify-between group p-10 bg-[#080808] border border-zinc-900 hover:border-red-900 transition-all">
              <div className="w-1/5">
                <h4 className="text-3xl font-black group-hover:text-red-500 transition-colors italic uppercase">{stock.name}</h4>
                <p className="text-[10px] text-zinc-600 font-bold mt-2">Current Price: {stock.current_price.toLocaleString()}</p>
              </div>
              
              <div className="flex-1 flex justify-center h-24">
                <CandleChart data={candleHistory[stock.id]} />
              </div>
              
              <div className="w-1/4 flex flex-col items-end gap-4">
                <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    min="1"
                    value={quantities[stock.id] || 1}
                    onChange={(e) => handleQtyChange(stock.id, e.target.value)}
                    className="w-16 bg-zinc-900 border border-zinc-800 text-white text-center py-2 text-xs font-black focus:border-red-600 outline-none"
                  />
                  <span className="text-zinc-500 text-[10px] font-bold uppercase">QTY</span>
                </div>
                <button 
                  onClick={() => handleBuy(stock)}
                  className="w-full py-3 bg-red-900/10 border border-red-900/40 text-red-600 text-[11px] font-black uppercase hover:bg-red-600 hover:text-white transition-all active:scale-95"
                >
                  Confirm Purchase
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 내 포트폴리오 사이드바 */}
        <div className="lg:col-span-1 border-l border-zinc-900 pl-10 h-fit sticky top-40">
          <h3 className="text-zinc-700 font-black text-[11px] tracking-[0.3em] uppercase mb-10 italic">Portfolio</h3>
          {myStocks.length > 0 ? (
            <div className="space-y-6">
              {myStocks.map(ms => (
                <div key={ms.id} className="flex justify-between items-end pb-4 border-b border-zinc-900/50">
                  <span className="text-zinc-400 font-black italic text-lg uppercase">{stocks.find(s=>s.id===ms.stock_id)?.name}</span>
                  <span className="text-red-600 font-black text-xl">{ms.quantity} <span className="text-[10px] text-zinc-800 uppercase not-italic">EA</span></span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-800 font-black italic text-center py-20 uppercase tracking-tighter">No Assets</p>
          )}
        </div>
      </div>
    </div>
  );
};

window.StockMarket = StockMarket;
