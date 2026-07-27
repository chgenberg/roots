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
 * Sätt till `true` för att visa den igen. API-endpointen
 * (/v1/ai/hair-analysis) och dialogkomponenten ligger kvar orörda, så det
 * krävs inget mer än den här raden.
 */
export const HAIR_ANALYSIS_ENABLED = false;
