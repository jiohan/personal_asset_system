package com.jioha.asset.transaction;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

public record TransactionPatchRequest(
    LocalDate txDate,
    @Positive Long amount,
    Long accountId,
    Long fromAccountId,
    Long toAccountId,
    @Size(max = 255) String description,
    Boolean clearCategory,
    Long categoryId,
    List<@Size(max = 30) String> tagNames,
    Boolean needsReview,
    Boolean excludeFromReports
) {
}
