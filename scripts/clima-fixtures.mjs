// Respostas de exemplo (fixtures) do Open-Meteo para os testes do Clima. O formato é o da API real, conferido em 07/11/2026 com uma consulta pública (só coordenadas):
//   previsão:  { latitude, longitude, ..., current_units, current: { time, interval, temperature_2m, weather_code, is_day }, daily_units, daily: { time, temperature_2m_max, temperature_2m_min, weather_code } }
//   cidades:   { results: [{ id, name, latitude, longitude, ..., country, admin1, ... }], generationtime_ms }  (sem resultado, a chave `results` não vem)
// Dados fictícios de tempo: nenhum número aqui veio de uma consulta de verdade, só a forma.

export const previsao = ({ temp = 16.9, codigo = 80, dia = 0, max = 24.7, min = 15.3, codigoDia = 81, hora = '2026-11-07T07:45', data = '2026-11-07' } = {}) => ({
  latitude: -29.63, longitude: -50.79, generationtime_ms: 0.19, utc_offset_seconds: -10800, timezone: 'America/Sao_Paulo', timezone_abbreviation: 'GMT-3', elevation: 30,
  current_units: { time: 'iso8601', interval: 'seconds', temperature_2m: '°C', weather_code: 'wmo code', is_day: '' },
  current: { time: hora, interval: 900, temperature_2m: temp, weather_code: codigo, is_day: dia },
  daily_units: { time: 'iso8601', temperature_2m_max: '°C', temperature_2m_min: '°C', weather_code: 'wmo code' },
  daily: { time: [data], temperature_2m_max: [max], temperature_2m_min: [min], weather_code: [codigoDia] },
});

const cidade = (id, name, latitude, longitude, admin1, country, extra = {}) => ({ id, name, latitude, longitude, elevation: 30, feature_code: 'PPL', country_code: 'BR', timezone: 'America/Sao_Paulo', population: 1000, country, admin1, ...extra });
export const TAQUARA_RS = cidade(3446847, 'Taquara', -29.65056, -50.78056, 'Rio Grande do Sul', 'Brasil');
export const TAQUARA_AL = cidade(3386635, 'Taquara', -9.73333, -36.46667, 'Alagoas', 'Brasil', { timezone: 'America/Maceio' });
export const TAQUARA_PB = cidade(3386637, 'Taquara', -7.49561, -34.85015, 'Paraíba', 'Brasil', { timezone: 'America/Fortaleza' });
export const PORTO_ALEGRE = cidade(3452925, 'Porto Alegre', -30.03283, -51.23019, 'Rio Grande do Sul', 'Brasil');
export const PORTO_PT = cidade(2735943, 'Porto', 41.14961, -8.61099, 'Porto', 'Portugal', { country_code: 'PT', timezone: 'Europe/Lisbon' });
export const SEM_REGIAO = cidade(999001, 'Lugar sem região', 10.5, 20.5, undefined, undefined);
export const resultados = (...lista) => ({ results: lista, generationtime_ms: 0.2 });
export const SEM_RESULTADO = { generationtime_ms: 0.1 };
/** Cidade no formato guardado pelo aplicativo. */
export const comoCidade = (r) => ({ id: r.id, nome: r.name, estado: r.admin1 ?? '', pais: r.country ?? '', lat: r.latitude, lon: r.longitude });
