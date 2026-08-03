/**
 * Flaggor för publika funktioner som tillfälligt är dolda.
 *
 * Flaggorna är avsiktligt vanliga konstanter och inte miljövariabler:
 * de ska kunna slås om i en pull request, granskas och deployas som all
 * annan kod, utan att någon behöver komma ihåg att sätta något i Railway.
 */

/**
 * Håranalysen — startsidans hjälteknapp, sidfotslänken, sökträffarna,
 * sidan /haranalys och dess plats i sitemapen.
 *
 * Funktionen är parkerad. Att slå på den kräver TVÅ saker, inte en:
 *   1. den här konstanten satt till `true`
 *   2. HAIR_ANALYSIS_ENABLED=true i API:ts miljö
 *
 * Tidigare gömde den här raden bara sidan medan /v1/ai/hair-analysis låg
 * öppen — vem som helst som hittade endpointen kunde bränna hela
 * vision-budgeten på en funktion vi inte ens visade. Innan den tas i bruk
 * igen behöver också åldersgrinden i dialogen och ett serversidigt filter
 * mot medicinska påståenden byggas.
 */
export const HAIR_ANALYSIS_ENABLED = false;
