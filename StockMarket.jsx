// StockMarket.jsx
const { useState, useEffect, useRef } = React;

const StockMarket = ({ user, fetchUserList }) => {
  // 1. 로그아웃 상태일 때 접속 차단 로직
  if (!user) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-6 animate-in fade-in duration-700">
        <h2 className="text-4xl font-black text-zinc-800 italic uppercase mb-4">Unauthorized Access</h2>
        <p className="text-zinc-600 font-bold tracking-widest uppercase text-xs">Please login to access the exchange</p>
      </div>
    );
  }

  const [stocks, setStocks] = useState([]);
  const [myStocks, setMyStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const [candleHistory, setCandleHistory] = useState({});
  const [buyQuantities, setBuyQuantities] = useState({});
  const [sellQuantities, setSellQuantities] = useState({});

  // 가격 시뮬레이션 시 최신 stocks 값을 참조하기 위한 Ref
  const stocksRef = useRef([]);
  useEffect(() => {
    stocksRef.current = stocks;
  }, [stocks]);

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
            const high = Math.max(open, close) + (Math.random() * 15);
            const low = Math.min(open, close) - (Math.random() * 15);
            newHistory[stock.id] = [...history, { open, close, high, low }].slice(-15);
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
      const fetchInterval = setInterval(fetchMarketData, 5000); // 5초마다 시세 새로고침
      
      // [수정] 가격 변동 시뮬레이터 로직 보강
      const simulateInterval = setInterval(async () => {
        if (!user?.is_admin || stocksRef.current.length === 0) return;
        if (!checkMarketStatus()) { setIsMarketOpen(false); return; }

        // 현재 메모리에 있는 최신 가격(stocksRef)을 기준으로 변동 계산
        for (const stock of stocksRef.current) {
          const changePercent = parseFloat((Math.random() * 6 - 3).toFixed(2));
          const newPrice = Math.max(100, Math.round(stock.current_price * (1 + changePercent / 100)));
          
          await supabaseClient
            .from('stocks')
            .update({ 
              current_price: newPrice, 
              change_rate: changePercent 
            })
            .eq('id', stock.id);
        }
        // DB 업데이트 후에는 어차피 fetchInterval(5초)이 최신값을 가져와 화면을 바꿉니다.
      }, 10000);

      return () => { clearInterval(fetchInterval); clearInterval(simulateInterval); };
    }
  }, [user?.code, isMarketOpen]);

  // --- SVG 캔들스틱 차트 컴포넌트 ---
  const CandleChart = ({ data }) => {
    if (!data || data.length < 2) return <div className="w-40 h-16 bg-zinc-900/10 animate-pulse" />;
    const allValues = data.flatMap(d => [d.high, d.low]);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min || 1;
    const height = 50;
    const width = 140;
    const candleWidth = width / data.length;

    return (
      <svg width={width} height={height} className="overflow-visible">
        {data.map((d, i) => {
          const x = i * candleWidth + candleWidth / 2;
          const isUp = d.close >= d.open;
          const color = isUp ? '#ef4444' : '#3b82f6';
          const yHigh = height - ((d.high - min) / range) * height;
          const yLow = height - ((d.low - min) / range) * height;
          const yOpen = height - ((d.open - min) / range) * height;
          const yClose = height - ((d.close - min) / range) * height;
          const bodyY = Math.min(yOpen, yClose);
          const bodyHeight = Math.max(Math.abs(yOpen - yClose), 1);
          return (
            <g key={i}>
              <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="1" />
              <rect x={x - candleWidth/4} y={bodyY} width={candleWidth/2} height={bodyHeight} fill={color} />
            </g>
          );
        })}
      </svg>
    );
  };

  const handleQtyChange = (id, val, max, setFunc) => {
    let num = parseInt(val);
    if (isNaN(num) || num < 1) num = 1;
    if (num > max) num = max;
    setFunc(prev => ({ ...prev, [id]: num }));
  };

  const handleBuy = async (stock) => {
    const qty = buyQuantities[stock.id] || 1;
    const totalPrice = stock.current_price * qty;
    if (user.points < totalPrice) return alert('Insufficient Credits');
    if (!confirm(`Buy ${qty} shares of ${stock.name}?`)) return;
    try {
      await supabaseClient.from('users').update({ points: user.points - totalPrice }).eq('code', user.code);
      const existing = myStocks.find(s => s.stock_id === stock.id);
      if (existing) await supabaseClient.from('user_stocks').update({ quantity: existing.quantity + qty }).eq('id', existing.id);
      else await supabaseClient.from('user_stocks').insert([{ user_code: user.code, stock_id: stock.id, quantity: qty, avg_price: stock.current_price }]);
      alert('Transaction Complete'); fetchUserList(); fetchMarketData();
    } catch (e) { alert('Error occurred'); }
  };

  const handleSell = async (ownedItem) => {
    const qty = sellQuantities[ownedItem.id] || 1;
    const stock = stocks.find(s => s.id === ownedItem.stock_id);
    if (!confirm('Sell assets?')) return;
    try {
      const totalGain = stock.current_price * qty;
      await supabaseClient.from('users').update({ points: user.points + totalGain }).eq('code', user.code);
      if (ownedItem.quantity === qty) await supabaseClient.from('user_stocks').delete().eq('id', ownedItem.id);
      else await supabaseClient.from('user_stocks').update({ quantity: ownedItem.quantity - qty }).eq('id', ownedItem.id);
      alert('Assets Liquidated'); fetchUserList(); fetchMarketData();
    } catch (e) { alert('Error occurred'); }
  };

  if (!isMarketOpen) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-6 animate-in fade-in zoom-in-95 duration-1000">
        <h2 className="text-8xl font-black text-white italic tracking-tighter uppercase mb-4 opacity-10">Market Closed</h2>
        <h3 className="text-4xl font-black text-red-600 italic tracking-tighter uppercase mb-6">Restricted Access</h3>
        <p className="text-zinc-600 font-bold tracking-[0.3em] uppercase text-xs">Operation: 19:00 - 05:00</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pt-24 px-8 pb-32 animate-in fade-in zoom-in-95 duration-1000">
      <div className="flex justify-between items-end mb-16 border-l-4 border-red-900 pl-8 py-2">
        <div>
          <h2 className="text-6xl font-black text-white italic tracking-tighter uppercase mb-2">Exchange</h2>
          <p className="text-red-900 font-black tracking-[0.5em] text-[10px] uppercase animate-pulse">● Live Trading Active</p>
        </div>
        <div className="text-right">
          <span className="text-zinc-600 text-[10px] uppercase font-black block mb-2 tracking-widest">Available Credits</span>
          <span className="text-4xl font-black text-red-600 italic tracking-tighter">{user.points.toLocaleString()} <span className="text-sm not-italic ml-1">PTS</span></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-4">
          {stocks.map(stock => {
            const maxBuy = Math.floor(user.points / stock.current_price);
            const bQty = buyQuantities[stock.id] || 1;
            const history = candleHistory[stock.id] || [];
            return (
              <div key={stock.id} className="bg-[#050505] border border-zinc-900 p-8 flex items-center justify-between group hover:border-red-900/50 transition-all duration-500">
                <div className="w-1/4">
                  <span className="text-zinc-600 font-mono text-[10px] uppercase">{stock.symbol}</span>
                  <h4 className="text-2xl font-black text-white italic group-hover:text-red-500 transition-colors uppercase leading-none">{stock.name}</h4>
                </div>
                <div className="flex-1 flex justify-center items-center px-4">
                  <CandleChart data={history} />
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right min-w-[110px]">
                    <span className="text-2xl font-black text-white italic block leading-none mb-1">{stock.current_price.toLocaleString()}</span>
                    <span className={`text-[10px] font-bold px-1 ${stock.change_rate >= 0 ? 'bg-red-600/20 text-red-600' : 'bg-blue-600/20 text-blue-600'}`}>
                      {stock.change_rate >= 0 ? '+' : ''}{stock.change_rate}%
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex bg-black border border-zinc-800 p-1">
                      <input type="number" value={bQty} onChange={(e) => handleQtyChange(stock.id, e.target.value, maxBuy, setBuyQuantities)} className="w-10 bg-transparent text-white text-center font-black text-xs focus:outline-none" />
                      <button onClick={() => handleQtyChange(stock.id, maxBuy, maxBuy, setBuyQuantities)} className="px-2 py-1 text-[8px] font-black bg-zinc-900 text-zinc-500 hover:text-white uppercase">Max</button>
                    </div>
                    <button onClick={() => handleBuy(stock)} disabled={maxBuy === 0} className={`px-6 py-2 text-[10px] font-black uppercase transition-all ${maxBuy === 0 ? 'bg-zinc-900 text-zinc-700 cursor-not-allowed' : 'bg-red-900/10 border border-red-900/40 text-red-600 hover:bg-red-900 hover:text-white'}`}>Buy</button>
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
                const sQty = sellQuantities[ms.id] || 1;
                const profit = currentStock ? (currentStock.current_price - ms.avg_price) * ms.quantity : 0;
                return (
                  <div key={ms.id} className="border-b border-zinc-900 pb-6 last:border-0">
                    <div className="flex justify-between mb-2 text-zinc-400 font-black italic uppercase text-sm">
                      <span>{currentStock?.name}</span>
                      <span className="text-red-600">{ms.quantity} EA</span>
                    </div>
                    <div className="flex justify-between items-center mb-4 text-[10px] font-black uppercase">
                      <span className="text-zinc-700">Net Profit</span>
                      <span className={profit >= 0 ? 'text-red-600' : 'text-blue-600'}>{profit.toLocaleString()} PTS</span>
                    </div>
                    <div className="flex bg-black border border-zinc-800 p-1 mb-2">
                      <input type="number" value={sQty} onChange={(e) => handleQtyChange(ms.id, e.target.value, ms.quantity, setSellQuantities)} className="w-full bg-transparent text-white text-center font-black text-xs focus:outline-none" />
                      <button onClick={() => handleQtyChange(ms.id, ms.quantity, ms.quantity, setSellQuantities)} className="px-2 py-1 text-[8px] font-black bg-zinc-900 text-zinc-500 hover:text-white uppercase">Max</button>
                    </div>
                    <button onClick={() => handleSell(ms)} className="w-full border border-zinc-800 py-2 text-[9px] font-black text-zinc-600 hover:text-white hover:border-red-600 transition-all uppercase">Liquidate</button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 border border-dashed border-zinc-900 text-zinc-800 text-[10px] uppercase tracking-widest font-black">No Assets</div>
          )}
        </div>
      </div>
    </div>
  );
};

window.StockMarket = StockMarket;
