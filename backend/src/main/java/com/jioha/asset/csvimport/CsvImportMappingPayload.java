package com.jioha.asset.csvimport;

import com.jioha.asset.domain.TransactionType;
import java.util.Map;

public record CsvImportMappingPayload(
    CsvImportColumnMapping columns,
    Map<String, Long> accountNameMap,
    TransactionType defaultType
) {
}
