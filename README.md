# 🍎 Partilha: Matchmaker de Doações (Sistema Zaia & Google Sheets)

## 🏆 Resumo do Projeto

O **Partilha** é um sistema automatizado desenvolvido para conectar doadores de alimentos a instituições de caridade compatíveis e próximas, em tempo real. A solução utiliza a plataforma de chatbot Zaia (WhatsApp) para coleta de dados e o **Google Apps Script (GAS)** como backend de lógica de negócios e Matchmaking.

* **Nome do Aplicativo:** Partilha
* **Plataforma de Backend:** Google Apps Script (JavaScript/V8)
* **Banco de Dados:** Google Sheets
* **Filtros Chave:** Tipo de Alimento e Proximidade Geográfica (Fórmula Haversine).

---

## 🛠️ Tecnologias Utilizadas

A arquitetura do Partilha integra quatro componentes principais:

* **Google Apps Script (GAS):** Hospedagem do Webhook, lógica de negócios e Matchmaker.
* **Google Sheets:** Usado como o banco de dados principal para persistência de dados.
* **Zaia:** Plataforma de Chatbot (WhatsApp) para coleta de dados via Webhook.
* **Serviço `Maps` do Google (via GAS):** Utilizado para a Geocodificação de endereços.

---

## ⚙️ Funcionalidades e Fluxo de Dados

O projeto Partilha realiza as seguintes operações críticas:

1.  **Coleta de Dados:** Recebe dados estruturados de doação do Zaia via requisição `POST` para o endpoint Webhook.
2.  **Geocodificação:** Converte o endereço da doação em Coordenadas Geográficas e armazena o resultado na aba `LOCALIZACAO`.
3.  **Processamento:** Registra o doador na aba `DOADOR_NOVO` e insere a doação na aba `DOACAO`.
4.  **Matchmaker Inteligente:** A função `encontrarMelhorMatch` executa o filtro em duas etapas:
    * **Filtro de Compatibilidade:** Garante que o `Tipo_Alimento` doado seja aceito pela `INSTITUICAO` (com lógica robusta para tratar listas de itens).
    * **Filtro Geográfico:** Calcula a distância em KM usando a **Fórmula Haversine** e identifica a instituição mais próxima dentre as compatíveis.
5.  **Atualização de Status:** A coluna `Status` na aba `DOACAO` é atualizada imediatamente para `MATCH_ENCONTRADO` (com o ID da Instituição) ou `NO_MATCH`.

---

## 🚀 Como Executar o Projeto

### 1. Configuração da Infraestrutura

* **Planilha:** Crie um Google Sheets com as abas `INSTITUICAO`, `DOADOR_NOVO`, `DOACAO`, e `LOCALIZACAO`.
* **Código:** Cole os arquivos `Codigo.gs` e `appsscript.json` no seu projeto Apps Script.
* **ID da Planilha:** Atualize a constante `SPREADSHEET_ID` no `Codigo.gs` com o ID da sua planilha.
* **Serviços:** Habilite o **Serviço Avançado Google Maps** no projeto Apps Script.

### 2. Implantação e Conexão

* **Implantação:** Implante o script como **App da Web** (Executar como: Eu, Quem tem acesso: Qualquer pessoa).
* **Conexão Zaia:** Copie a **URL do App da Web** e configure-a como o endpoint Webhook na plataforma Zaia.

---

## 💡 Lições Aprendidas (Hackathon Insights)

O desenvolvimento superou desafios críticos de comunicação e estabilidade do Webhook no ambiente Google Apps Script:

* **Estabilidade de Escrita:** A falha em atualizar células (`setValue`) foi contornada refatorando a lógica para inserir o `Status` final diretamente no `appendRow` e utilizando **`SpreadsheetApp.flush()`**.
* **Filtro Robusto:** Foi implementada uma lógica de filtro (`.toLowerCase().replace(/,/g, '').includes(...)`) para garantir a correspondência correta de alimentos, ignorando variações de formatação e listas na planilha.


**Data:** Dezembro de 2025
