<div align="center">

<img src="public/vite.svg" width="72" alt="VUXIO logo" />

# Vuxio AI

**Assistente de inteligência artificial conversacional com modo programador integrado**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Firebase](https://img.shields.io/badge/Firebase-12-FFCA28?logo=firebase)](https://firebase.google.com)
[![Groq](https://img.shields.io/badge/Groq-LLaMA%203.3%2070B-orange)](https://groq.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](./LICENSE)

</div>

---

## Sobre o Projeto

O **Vuxio AI** é uma aplicação web de chat com inteligência artificial, desenvolvida de raiz por **Simão**. Combina uma interface elegante e fluida com um backend de IA potente (LLaMA 3.3 70B via Groq API), autenticação com Google e persistência de conversas em tempo real.

Destaca-se pelo **Modo Programador** — um modo dedicado para developers, com tema visual verde, respostas técnicas e diretas, blocos de código com syntax highlighting e opção de download dos ficheiros gerados.

---

## Funcionalidades

| Feature | Descrição |
|---|---|
| **Chat com IA** | Conversas com LLaMA 3.3 70B, rápido e preciso |
| **Modo Programador** | Tema verde, tom técnico, código completo e executável |
| **Download de código** | Descarrega os ficheiros gerados (.py, .html, .ts, …) |
| **Histórico de conversas** | Guardado em Firestore, acessível em qualquer dispositivo |
| **Autenticação Google** | Login seguro com Firebase Auth |
| **Modo convidado** | Usa sem conta — sem persistência |
| **Voz integrada** | Text-to-speech e reconhecimento de voz em PT-PT |
| **Upload de ficheiros** | Analisa imagens e PDFs via modelo de visão |
| **Avatar animado** | Esfera 3D com partículas e anéis orbitais |
| **Responsivo** | Sidebar retrátil, funciona em mobile e desktop |

---

## Stack Tecnológica

**Frontend**
- [React 19](https://react.dev) + [TypeScript 5.9](https://www.typescriptlang.org)
- [Vite 7](https://vitejs.dev) — bundler ultrarrápido
- [Tailwind CSS 3](https://tailwindcss.com) — utility-first styling
- [Framer Motion](https://www.framer.com/motion) — animações
- [Lucide React](https://lucide.dev) — ícones
- [React Syntax Highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter) — blocos de código

**Backend / Serviços**
- [Groq API](https://groq.com) — inferência LLaMA 3.3 70B e LLaMA 3.2 Vision
- [Firebase Auth](https://firebase.google.com/products/auth) — autenticação Google
- [Firebase Firestore](https://firebase.google.com/products/firestore) — base de dados em tempo real
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) — TTS + STT nativo do browser

---

## Estrutura do Projeto

```
src/
├── components/
│   ├── InputBar.tsx          # Barra de input com anexos
│   ├── MarkdownMessage.tsx   # Renderer de markdown com syntax highlight e download
│   ├── Sidebar.tsx           # Painel lateral com histórico de conversas
│   └── VuxioAvatar.tsx        # Avatar animado (partículas + anéis)
├── hooks/
│   ├── useAuth.ts            # Firebase Auth — Google login + modo convidado
│   ├── useChat.ts            # Lógica de chat — Groq API + persistência Firebase
│   └── useSpeech.ts          # Web Speech API — TTS + STT em PT-PT
├── App.tsx                   # Componente raiz — layout e estado global
├── firebase.ts               # Configuração Firebase
└── types.ts                  # Tipos TypeScript partilhados
```

---

## Licença

Copyright © 2025 **Simão**. Todos os direitos reservados.

Este projeto está licenciado sob a [MIT License](./LICENSE) — podes usar e modificar, desde que mantendo os créditos ao autor original.

---

<div align="center">
  <sub>Feito com ♥ por Simão · Vuxio AI v1.0</sub>
</div>
