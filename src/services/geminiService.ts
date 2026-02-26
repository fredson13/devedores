import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateCollectionMessage(customerName: string, amount: number, debts: any[]) {
  const prompt = `
    Você é um assistente de cobrança amigável para um pequeno comerciante brasileiro.
    O cliente se chama ${customerName} e deve um total de R$ ${amount.toFixed(2)}.
    As últimas dívidas são: ${debts.slice(0, 3).map(d => `${d.description} (R$ ${d.amount})`).join(", ")}.
    
    Escreva uma mensagem de WhatsApp educada, profissional e empática lembrando o cliente da pendência. 
    Não seja agressivo. Use um tom de parceria.
    A mensagem deve ser curta e direta.
    Inclua emojis de forma moderada.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating message:", error);
    return "Olá! Gostaria de lembrar gentilmente sobre o seu saldo em aberto conosco. Podemos conversar sobre o acerto?";
  }
}
