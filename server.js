require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const PORT = process.env.PORT || 3000;
const MODEL = 'deepseek/deepseek-v4-flash-0731';

const SYSTEM_PROMPT = {
  role: 'system',
  content:
    'Você é a Solus, uma assistente de IA. Responda sempre em português do Brasil, a menos que o usuário escreva claramente em outro idioma. Seja natural, direta e casual — para cumprimentos ou perguntas simples, responda curto, sem listas ou explicações longas desnecessárias. Não fique se apresentando ou descrevendo suas capacidades a menos que perguntem diretamente. Sempre que escrever qualquer trecho de código (HTML, JS, Python, etc), coloque ele dentro de blocos de crase tripla com o nome da linguagem, por exemplo: ```html codigo aqui ```.',
};

app.post('/chat', async (req, res) => {
  const { messages, thinking, webSearch } = req.body;

  try {
    const body = {
      model: MODEL,
      messages: [SYSTEM_PROMPT, ...messages],
      reasoning: { enabled: !!thinking },
    };

    if (webSearch) {
      body.plugins = [{ id: 'web', max_results: 5 }];
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    const message = data.choices?.[0]?.message;
    const reply = message?.content ?? '';
    const reasoning = message?.reasoning ?? null;

    let sources = null;
    if (message?.annotations && message.annotations.length > 0) {
      sources = message.annotations
        .filter((a) => a.type === 'url_citation')
        .map((a) => ({
          title: a.url_citation?.title || a.url_citation?.url,
          url: a.url_citation?.url,
        }));
    }

    res.json({ reply, reasoning, sources });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/title', async (req, res) => {
  const { firstMessage } = req.body;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content:
              'Gere um título curto (no máximo 5 palavras) em português para essa conversa, baseado na mensagem do usuário. Responda APENAS com o título, sem aspas, sem ponto final, sem explicações.',
          },
          { role: 'user', content: firstMessage },
        ],
        reasoning: { enabled: false },
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data });

    const title = data.choices?.[0]?.message?.content?.trim() ?? 'Nova conversa';
    res.json({ title });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend do Solus rodando na porta ${PORT}`);
});
