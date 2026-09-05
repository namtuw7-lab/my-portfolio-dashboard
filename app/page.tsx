import { supabase } from '../utils/supabase';

export default async function DashboardPage() {
  // 1. ดึงข้อมูลจาก Supabase
  const { data: portfolios, error } = await supabase.from('portfolios').select('*');
  if (error) return <p>เกิดข้อผิดพลาด: {error.message}</p>;

  const finnhubKey = process.env.FINNHUB_API_KEY;

  // 2. ดึงราคาปัจจุบัน และ คำนวณมูลค่าหุ้นแต่ละตัว
  const portfoliosWithPrices = await Promise.all(portfolios.map(async (stock) => {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${stock.symbol}&token=${finnhubKey}`);
    const priceData = await res.json();
    
    const current_price = priceData.c || 0; // ราคาปัจจุบัน
    const current_value = current_price * stock.current_shares; // มูลค่าปัจจุบัน (ราคา x จำนวน)
    
    return { ...stock, current_price, current_value };
  }));

  // 3. คำนวณ "มูลค่ารวมทั้งพอร์ต" (เอาทุกตัวมาบวกกัน)
  const totalPortfolioValue = portfoliosWithPrices.reduce((sum, stock) => sum + stock.current_value, 0);

  // 4. คำนวณ "สัดส่วนปัจจุบัน" และ "ส่วนต่างที่เกินมา (Drift)"
  const finalPortfolios = portfoliosWithPrices.map(stock => {
    const current_weight = totalPortfolioValue > 0 ? (stock.current_value / totalPortfolioValue) * 100 : 0;
    const drift = current_weight - stock.target_weight; // คำนวณว่าเกินเป้ามาเท่าไหร่
    
    return { ...stock, current_weight, drift };
  });

  // 5. วาดหน้าเว็บ
  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif' }}>
      <h1>📊 My Portfolio Dashboard</h1>
      <h3 style={{ color: '#555' }}>มูลค่าพอร์ตรวม: ${totalPortfolioValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</h3>
      
      <table border={1} cellPadding={12}" style={{ marginTop: '20px', borderCollapse: 'collapse', width: '100%', maxWidth: '1000px' }}>
        <thead style={{ backgroundColor: '#f0f0f0' }}>
          <tr>
            <th>ชื่อหุ้น</th>
            <th>ราคาปัจจุบัน</th>
            <th>มูลค่ารวม</th>
            <th>เป้าหมาย (%)</th>
            <th style={{ color: 'blue' }}>สัดส่วนปัจจุบัน (%)</th>
            <th style={{ color: 'red' }}>ส่วนต่าง (Drift %)</th>
          </tr>
        </thead>
        <tbody>
          {finalPortfolios.map((stock) => (
            <tr key={stock.id} style={{ textAlign: 'center' }}>
              <td><strong>{stock.symbol}</strong></td>
              <td>${stock.current_price}</td>
              <td>${stock.current_value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              <td>{stock.target_weight}%</td>
              <td style={{ color: 'blue', fontWeight: 'bold' }}>
                {stock.current_weight.toFixed(2)}%
              </td>
              <td style={{ color: stock.drift > 0 ? 'red' : 'green', fontWeight: 'bold' }}>
                {stock.drift > 0 ? '+' : ''}{stock.drift.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}