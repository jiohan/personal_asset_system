package com.jioha.asset.transaction;

import com.jioha.asset.domain.TransactionType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;

public record TransactionCreateRequest(
    @NotNull LocalDate txDate,
    @NotNull TransactionType type,
    @Positive long amount,
    Long accountId,
    Long fromAccountId,
    Long toAccountId,
    @Size(max = 255) String description,
    Long categoryId,
    List<@Size(max = 30) String> tagNames,
    Boolean needsReview,
    Boolean excludeFromReports
) {
}
