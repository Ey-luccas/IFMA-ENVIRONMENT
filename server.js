// ============================================================
// IFMA-ENVIRONMENT - Servidor para análise ambiental de objetos
// Projeto escolar usando Express + OpenAI
// ============================================================

import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

// Cria o servidor Express
const app = express();
const PORT = 3000;

// Configura o Multer para receber o upload da imagem
// A imagem será salva na memória (não no disco)
const upload = multer({ storage: multer.memoryStorage() });

// Configura o cliente da OpenAI com a chave da API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Pega o caminho da pasta public para servir os arquivos estáticos
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(join(__dirname, 'public')));

// ============================================================
// Rota principal: recebe a imagem, analisa com IA e retorna JSON
// ============================================================
app.post('/analisar', upload.single('imagem'), async (req, res) => {
  try {
    // Verifica se uma imagem foi enviada
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhuma imagem enviada.' });
    }

    // Converte a imagem para base64
    const imagemBase64 = req.file.buffer.toString('base64');
    const tipoImagem = req.file.mimetype;

    // Monta o prompt para a IA (em português do Brasil, estilo escolar)
    const prompt = `
Analise a imagem enviada.

Você faz parte de um projeto escolar chamado IFMA-ENVIRONMENT.

Responda em português do Brasil, de forma simples e educativa.

Identifique:
- qual é o objeto da imagem;
- qual é o material principal provável;
- quanto tempo ele pode demorar para se decompor no ambiente;
- quais problemas ele pode causar ao meio ambiente;
- como ele deve ser descartado corretamente.

Se não tiver certeza sobre o objeto, informe que a confiança é baixa.
`;

    // Envia a imagem para a API da OpenAI (modelo GPT-4o que aceita imagens)
    const resposta = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${tipoImagem};base64,${imagemBase64}`,
              },
            },
          ],
        },
      ],
      // Pede para a IA responder em formato JSON
      response_format: { type: 'json_object' },
      max_tokens: 1000,
    });

    // Pega o texto da resposta da IA
    const textoResposta = resposta.choices[0].message.content;

    // Converte o texto para JSON
    const dados = JSON.parse(textoResposta);

    // Retorna os dados para o frontend
    res.json(dados);
  } catch (erro) {
    console.error('Erro ao analisar imagem:', erro);
    res.status(500).json({
      erro: 'Erro ao analisar a imagem. Verifique sua chave da API OpenAI.',
    });
  }
});

// ============================================================
// Inicia o servidor
// ============================================================
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
