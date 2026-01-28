// StockMarket.jsx
const StockMarket = ({ user, fetchUserList }) => {
  // 주식 관련 상태(stocks, myStocks 등)와 로직(handleBuy, handleSell)을 여기에 작성
  return (
    <div className="stock-container">
      {/* 주식 UI 코드 */}
    </div>
  );
};

// 메인 파일에서 인식할 수 있도록 전역에 등록 (CDN 방식일 경우)
window.StockMarket = StockMarket;
