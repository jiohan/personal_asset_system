package com.jioha.asset.csvimport;

public record CsvImportColumnMapping(
    String txDate,
    String amount,
    String description,
    String account,
    String type
) {
}
