import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { text, texts } = await req.json();
        
        const apiKey = process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
            // Fallback for development if no key
            if (texts && Array.isArray(texts)) {
                return NextResponse.json({ translatedTexts: texts.map(t => t + " (Mock)") });
            }
            return NextResponse.json({ translatedText: text + " (Mock)" });
        }

        if (texts && Array.isArray(texts)) {
            // Bulk translation
            const prompt = `Translate the following list of messages to English. Maintain the exact same order. Respond with a JSON array of translated strings only.
            
            Messages:
            ${JSON.stringify(texts)}`;

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [{ role: "user", content: prompt }],
                    response_format: { type: "json_object" },
                    temperature: 0.1
                })
            });

            if (!response.ok) throw new Error("OpenAI API failed");
            const data = await response.json();
            const content = JSON.parse(data.choices[0].message.content);
            return NextResponse.json({ translatedTexts: content.translations || content.results || Object.values(content)[0] });
        }

        const prompt = `Translate the following text to English. If it is already in English, return it as is. Output ONLY the translated text.\n\nText: ${text}`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.3
            })
        });

        if (!response.ok) throw new Error("OpenAI API failed");
        const data = await response.json();
        const translatedText = data.choices[0].message.content.trim();
        
        return NextResponse.json({ translatedText });
    } catch (error) {
        console.error("Translate API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
