// =========================================================
// CONFIGURAÇÕES GLOBAIS
// =========================================================
const SPREADSHEET_ID = '1SBkyVBGPf-TG6KNRp0-MEj-A3rgHA1EkpakdlWue86Q'; 
const NOME_ABA_INSTITUICAO = 'INSTITUICAO';
const NOME_ABA_DOADOR = 'DOADOR_NOVO'; // <<-- VARIÁVEL ALTERADA
const NOME_ABA_DOACAO = 'DOACAO';
const NOME_ABA_LOCALIZACAO = 'LOCALIZACAO';

const RAIO_TERRA_KM = 6371; // Raio médio da Terra em km

// =========================================================
// FUNÇÃO DE TESTE MANUAL
// =========================================================
function testeManual() {
  const mockData = {
    postData: {
      contents: JSON.stringify({
        nome_doador: "Cadu Server",
        telefone_whatsapp: "552199988889",
        tipo_alimento: "Verduras",
        quantidade: "10", // String
        data_validade_str: "20/12/2026", // DD/MM/AAAA
        endereco_doacao_str: "Av. Rio Branco, 150, Centro, RJ" // Endereço válido
      })
    }
  };
  doPost(mockData); 
}

// =========================================================
// 1. FUNÇÕES DE UTILIDADE E ACESSO AO SHEET
// =========================================================

/**
 * Funcao de utilidade para abrir uma aba (planilha)
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss O objeto da planilha.
 * @param {string} sheetName O nome da aba.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} O objeto da aba.
 */
function getSheetByName(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    Logger.log(`ERRO: A aba "${sheetName}" não foi encontrada. Verifique o nome.`);
    throw new Error(`A aba "${sheetName}" não existe.`);
  }
  return sheet;
}

/**
 * Converte graus para radianos.
 */
function toRad(degrees) {
  return degrees * Math.PI / 180;
}

// =========================================================
// 2. SERVIÇOS DE GEOCODIFICAÇÃO E LOCALIZAÇÃO
// =========================================================

/**
 * Geocodifica um endereco usando o serviço Maps nativo do Google.
 * @param {string} endereco_str O endereco fornecido pelo usuario.
 * @returns {{lat: number, lon: number, id: number}|null} As coordenadas e o ID salvo.
 */
function geocodificarESalvar(endereco_str) {
  const geocoder = Maps.newGeocoder();
  const response = geocoder.geocode(endereco_str);
  
  if (response.status === 'OK' && response.results.length > 0) {
    const location = response.results[0].geometry.location;
    const lat = location.lat;
    const lon = location.lng;
    
    // Acessa a aba LOCALIZACAO (usando openById aqui para simplificar)
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getSheetByName(ss, NOME_ABA_LOCALIZACAO); 
    const lastRow = sheet.getLastRow();
    const newId = lastRow + 1;

    // Colunas: ID, Endereco_Completo, Latitude, Longitude, Data_Validacao
    sheet.appendRow([newId, endereco_str, lat, lon, new Date()]);
    
    return { lat: lat, lon: lon, id: newId };
  }
  
  Logger.log('Falha na Geocodificação: ' + endereco_str);
  return null;
}

// =========================================================
// 3. LÓGICA DO MATCHMAKER (Fórmula Haversine)
// =========================================================
/**
 * Calcula a distância em KM entre dois pontos (Lat/Lon)
 * (Esta função não mudou, mas é mantida aqui para contexto)
 */
function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return RAIO_TERRA_KM * c; // Distância em km
}

/**
 * Busca a instituição elegível mais próxima para uma doação.
 */
function encontrarMelhorMatch(tipoAlimento, doacaoLat, doacaoLon) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetInstituicao = getSheetByName(ss, NOME_ABA_INSTITUICAO);
  const instituicoes = sheetInstituicao.getDataRange().getValues(); 
  
  if (instituicoes.length < 2) return null; 
  
  let melhorMatch = null;
  let menorDistancia = Infinity;

  const tipoDoadorLowerCase = tipoAlimento.toLowerCase().trim(); // Ex: "verduras"

  // Itera sobre as instituições
  for (let i = 1; i < instituicoes.length; i++) {
    const inst = instituicoes[i];
    
    // Mapeamento de Colunas: 
    // 0:ID, 1:Nome, 2:Telefone_WhatsApp, 3:Tipo_Alimento_Aceito, 6:Latitude, 7:Longitude
    const tiposAceitosStr = inst[3] ? inst[3].toString() : ''; 
    
    // 1. FILTRO DE COMPATIBILIDADE (ULTRA ROBUSTO)
    // Converte a string aceita para minúsculas e remove vírgulas para facilitar a busca.
    const tiposAceitosClean = tiposAceitosStr.toLowerCase().replace(/,/g, ''); // Ex: "verduras legumes"
    
    if (!tiposAceitosClean.includes(tipoDoadorLowerCase)) {
      continue; // Não é compatível, pula para o próximo

    }
    // FIM DO FILTRO ROBUSTO
    
    const instLat = parseFloat(inst[6]);
    const instLon = parseFloat(inst[7]);

    // 2. CÁLCULO DE DISTÂNCIA
    if (!isNaN(instLat) && !isNaN(instLon)) { // Garante que a conversão para número funcionou
      const distancia = calcularDistanciaHaversine(doacaoLat, doacaoLon, instLat, instLon);
      
      // 3. ENCONTRAR O MELHOR
      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        melhorMatch = {
          id: inst[0],
          nome: inst[1],
          telefone: inst[2],
          distancia: Math.round(distancia * 100) / 100
        };
      }
    }
  }
  return melhorMatch;
}

// =========================================================
// 4. WEBHOOK PRINCIPAL (AGENTE COLETOR) - VERSÃO FINAL E COMPLETA
// =========================================================

/**
 * Função padrão para receber requisições POST de Webhooks (Zaia).
 * Este é o endpoint /api/registrar_doacao.
 */
// A função doPost(e) revisada para escrita mais estável
function doPost(e) {
  const jsonOutput = (obj) => ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);

  try {
    const data = JSON.parse(e.postData.contents);
    
    const { nome_doador, telefone_whatsapp, tipo_alimento, quantidade, data_validade_str, endereco_doacao_str } = data;

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetDoacao = ss.getSheetByName(NOME_ABA_DOACAO);
    const sheetDoador = ss.getSheetByName(NOME_ABA_DOADOR); // Usando DOADOR_NOVO

    if (!sheetDoacao || !sheetDoador) {
        throw new Error("Falha ao obter as abas da planilha.");
    }
    
    // 1. GEOCODIFICAÇÃO
    const localizacao = geocodificarESalvar(endereco_doacao_str);
    if (!localizacao) {
      return jsonOutput({ success: false, message: "Endereço inválido ou falha na geocodificação." });
    }

    // 2. DISPARAR MATCHMAKER
    const match = encontrarMelhorMatch(tipo_alimento, localizacao.lat, localizacao.lon);
    
    let matchTelefone = null;
    let matchId = null;
    let status = 'NO_MATCH'; // Define status inicial como NO_MATCH para a inserção

    if (match) {
        matchTelefone = match.telefone;
        matchId = match.id;
        status = 'MATCH_ENCONTRADO';
    }

    // 3. SALVAR DADOS DO DOADOR (AppendRow)
    sheetDoador.appendRow([
        "'" + telefone_whatsapp, 
        nome_doador,             
        "'" + telefone_whatsapp  
    ]);
    
    // 4. INSERÇÃO DA DOAÇÃO (Usando o status final na primeira inserção)
    const [dia, mes, ano] = data_validade_str.split('/');
    const dataValidade = new Date(`${mes}/${dia}/${ano}`);

    // Colunas DOACAO: 1:ID, 2:ID_Doador, 3:Tipo_Alimento, 4:Quantidade... 9:Status, 10:ID_Match
    const id_doacao = sheetDoacao.getLastRow() + 1; // Calcula o ID antes de inserir
    
    sheetDoacao.appendRow([
      id_doacao,              // Coluna A
      telefone_whatsapp,      // Coluna B: ID_Doador (Telefone)
      tipo_alimento,          // Coluna C
      parseFloat(quantidade), // Coluna D
      dataValidade,           // Coluna E
      endereco_doacao_str,    // Coluna F
      localizacao.lat,        // Coluna G
      localizacao.lon,        // Coluna H
      status,                 // Coluna I: Status (Já é o valor final!)
      matchId                 // Coluna J: ID_Instituicao_Match
    ]); 

    // O comando flush não é mais estritamente necessário se o status for inserido de uma vez, mas mantém.
    SpreadsheetApp.flush();

    // 5. RETORNO PARA O ZAIA
    return jsonOutput({ 
      success: true, 
      message: (status === 'MATCH_ENCONTRADO') ? "Match encontrado e registrado." : "Doação registrada. Nenhuma instituição elegível próxima foi encontrada.",
      id_doacao: id_doacao,
      match_telefone: matchTelefone, 
      match_distancia_km: match ? match.distancia : null // <<-- CORREÇÃO AQUI
    });
    
  } catch (error) {
    Logger.log("Erro fatal no doPost: " + error.message);
    return jsonOutput({ 
      success: false, 
      message: "Erro interno do servidor Apps Script. Verifique os logs.",
      error_detail: error.message
    });
  }
}
