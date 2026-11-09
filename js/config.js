// URL da implantação do Google Apps Script (Implantar > Gerenciar implantações)
export const API_URL =
  "https://script.google.com/macros/s/AKfycbzH06I0XCBUbhbQCaSVdVdRZ0DCi8-oYd2TH36W7fIilOAMYvy3if11uQtFXPOhBKmUOQ/exec";

export const SHARE_URL = "https://leonardosilva-ti.github.io/bolaovidanova/";
export const SHARE_MESSAGE =
  `Oi! Estou participando desse bolão mensal da Mega Sena. Que tal participar para aumentar nossas chances? ${SHARE_URL}`;

export const API_TIMEOUT_MS = 45_000;

export const PLANOS = {
  Avulso: { preco: "R$ 7,25", creditos: 1, jogos: 1 },
  "Padrão": { preco: "R$ 28,00", creditos: 4, jogos: 1 },
  Dobrado: { preco: "R$ 54,00", creditos: 4, jogos: 2 },
};

export const TIPO_FIXO = "Número da sorte";
export const TIPO_ALEATORIO = "Aleatório";
