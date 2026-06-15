# 🦺 SESMT 2026 — Gestão de Segurança do Trabalho

Aplicativo web para gestão das atividades de SST com **pontuação por participação**, cobrindo:

- **DDS** (Diálogo Diário de Segurança)
- **DESC** (Diálogo Estendido de Segurança Comportamental)
- **Oficina de Percepção de Risco**
- **CIPA em Movimento**
- **Treinamento**
- **Sala de Orientação**

## Funcionalidades

### Acesso do Gestor
- **Painel geral**: totais de colaboradores, atividades, participações e Top 10 do ranking.
- **Atividades**: registre cada DDS, DESC, oficina, treinamento etc. com data, tema, responsável e **lista de presença** (com busca e "marcar todos"). Cada participante presente ganha os pontos da atividade automaticamente.
- **Colaboradores**: cadastro individual ou **em massa** (cole a lista do Excel ou envie um arquivo CSV no formato `matrícula;nome;setor;função`).
- **Ranking**: classificação geral por pontos, com exportação em CSV.
- **Configurações**: defina quantos pontos vale cada tipo de atividade e altere a senha do gestor.

### Acesso do Colaborador (visualização)
- Login somente com a **matrícula**.
- Acompanha seus pontos totais, posição no ranking, participações por tipo de atividade e histórico completo.
- **DDS Battle**: participa do quiz de segurança ao vivo respondendo pelo próprio celular.

### Acesso do Admin Master
- Login com usuário e senha próprios (separado do gestor).
- **Licenças de acesso**: liga/desliga cada módulo do sistema. Ao desativar um módulo, ele **some do menu** do gestor/colaborador **e fica bloqueado no servidor** — não há como acessá-lo nem pela URL da API.
- O nome de cada módulo vem de uma **fonte única** no servidor, então é sempre idêntico no Admin Master, no Gestor e no Colaborador.
- Módulos essenciais (Painel e Configurações) ficam sempre ativos para não travar o sistema.

### DDS Battle — quiz de segurança ao vivo
- O gestor monta perguntas (com alternativas e a correta), abre a sala e inicia.
- Os colaboradores entram pela tela deles e respondem pelo celular.
- O **placar atualiza ao vivo na tela do gestor via Server-Sent Events (push instantâneo)** — sem recarregar a página e sem delay perceptível.
- O gestor controla o ritmo: exibir pergunta → revelar resposta → próxima → pódio final.
- O colaborador nunca recebe a alternativa correta antes da revelação (validado no servidor).

## Como executar

Requisito: [Node.js](https://nodejs.org) 18 ou superior. **Não precisa instalar nada mais** (sem dependências externas).

```bash
node server.js
```

Depois abra no navegador: **http://localhost:3000**

> Para usar outra porta: `PORT=8080 node server.js`

### Primeiro acesso do gestor

| Perfil | Usuário | Senha |
|--------|---------|-------|
| Gestor | `gestor` | `admin123` |
| Admin Master | `master` | `master123` |

⚠️ **Altere as senhas** logo no primeiro acesso (Gestor: *Configurações → Alterar senha*; Admin Master: tela de licenças → *Alterar senha do admin master*).

### Acesso na rede da empresa

Rodando o servidor em um computador da empresa, os colaboradores podem acessar pelo navegador do celular ou de outro computador usando o IP da máquina, por exemplo `http://192.168.0.10:3000`, e entrar com a própria matrícula.

## Cadastro em massa

Em **Colaboradores → Cadastro em massa**, cole a lista (uma pessoa por linha):

```
1001;Maria Silva;Produção;Operadora
1002;João Souza;Manutenção;Mecânico
1003;Ana Lima;Administrativo;Assistente
```

- Separador: `;`, `,` ou TAB (pode colar direto do Excel).
- Setor e função são opcionais.
- Matrículas repetidas são ignoradas automaticamente.

## Pontuação padrão

| Atividade | Pontos |
|-----------|--------|
| DDS | 1 |
| DESC | 2 |
| Oficina de Percepção de Risco | 3 |
| CIPA em Movimento | 2 |
| Treinamento | 3 |
| Sala de Orientação | 1 |

Tudo configurável em *Configurações*, e cada atividade individual pode ter pontuação própria.

## Onde ficam os dados

Os dados são salvos no arquivo `data/db.json`, criado automaticamente na primeira execução. Faça backup deste arquivo periodicamente.
