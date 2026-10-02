// 영수증 이미지 합계 금액 OCR (Gemini) — GOOGLE_API_KEY 필요
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-flash']

export async function geminiOCR(buffer: Buffer, mimeType: string): Promise<number | null> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genai  = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const prompt = '이 영수증 이미지에서 최종 합계(총액) 금액만 숫자로 알려주세요. 통화 기호·쉼표·공백 없이 숫자만 답하세요. 예: 15000'
  for (const modelName of GEMINI_MODELS) {
    try {
      const model  = genai.getGenerativeModel({ model: modelName })
      const result = await model.generateContent([
        { inlineData: { data: buffer.toString('base64'), mimeType: mimeType as any } },
        prompt,
      ])
      const raw    = result.response.text().trim()
      const amount = parseFloat(raw.replace(/[^0-9.]/g, ''))
      console.log(`[Receipt OCR:${modelName}] "${raw}" → ${amount}`)
      if (!isNaN(amount) && amount > 0) return amount
    } catch (e: any) {
      console.warn(`[Receipt OCR:${modelName}] 실패: ${e?.message}`)
    }
  }
  return null
}
