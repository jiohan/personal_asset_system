package com.jioha.asset.csvimport;

import java.util.List;

public record CsvImportResultResponse(
    int createdCount,
    int skippedCount,
    int warningCount,
    int errorCount,
    List<CsvImportWarning> warnings
) {
}
