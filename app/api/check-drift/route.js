import { NextResponse } from 'next/server';
import { supabase } from '../../../utils/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data: portfolios, error } = await supabase.from('portfolios').select('*');
    if (error) throw error;

    // 🚨 1. เช็กก่อนเลยว่ามองเห็นข้อมูลหุ้นไหม?
    if (!portfolios || portfolios.length === 0) {
       return NextResponse.json({ 
         success: false, 
         error: '❌ API มองไม่เห็นข้อมูลหุ้นเลย (พอร์ตว่างเปล่า)', 
         hint: 'ตารางอาจจะว่าง หรือติดระบบรักษาความปลอดภัย (RLS) ของ Supabase' 
       });
    }

    const finnhubKey = process.env.FINNHUB_API_KEY;
    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const userId = process.env.LINE_USER_ID;

    const portfoliosWithPrices = await Promise.all(portfolios.map(async (stock) => {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${stock.symbol}&token=${finnhubKey}`);
      const priceData = await res.json();
      const current_value = (priceData.c || 0) * stock.current_shares;
      return { ...stock, current_value };
    }));

    const totalPortfolioValue = portfoliosWithPrices.reduce((sum, stock) => sum + stock.current_value, 0);
    const driftLimit = 5.0; // บังคับแจ้งเตือน
    let alertMessages = [];
    let debugInfo = []; // 🚨 ตัวแปรสำหรับแอบดูการคำนวณ

    portfoliosWithPrices.forEach(stock => {
      const current_weight = totalPortfolioValue > 0 ? (stock.current_value / totalPortfolioValue) * 100 : 0;
      const drift = current_weight - stock.target_weight;

      // จดข้อมูลไว้โชว์บนหน้าเว็บ
      debugInfo.push({
        symbol: stock.symbol,
        weight: current_weight,
        drift: drift
      });

      if (drift > driftLimit) {
        alertMessages.push(`🚨 หุ้น ${stock.symbol} น้ำหนักเกินเป้า!\nเป้าหมาย: ${stock.target_weight}%\nปัจจุบัน: ${current_weight.toFixed(2)}%\nเกินมา: +${drift.toFixed(2)}%`);
      }
    });

    if (alertMessages.length > 0) {
      const messageString = alertMessages.join('\n\n');
      
      const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${lineToken}`
        },
        body: JSON.stringify({
          to: userId,
          messages: [{ type: 'text', text: messageString }]
        })
      });

      const lineData = await lineRes.json();
      if (!lineRes.ok) {
        return NextResponse.json({ success: false, error: '❌ LINE ปฏิเสธการส่ง', line_error: lineData });
      }

      // 🚨 เพิ่ม debugInfo ไปแสดงผลด้วย
      return NextResponse.json({ success: true, message: '✅ ส่งแจ้งเตือนผ่าน Messaging API เรียบร้อย', debugInfo });
    }

    return NextResponse.json({ success: true, message: 'น้ำหนักหุ้นปกติ ไม่มีแจ้งเตือน', debugInfo });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}