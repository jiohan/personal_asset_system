package com.jioha.asset.csvimport;

public record CsvImportWarning(
    int row,
    String code,
    String message
) {
}
