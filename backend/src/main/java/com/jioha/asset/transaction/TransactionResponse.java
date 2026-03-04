package com.jioha.asset.transaction;

import com.jioha.asset.domain.TransactionType;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record TransactionResponse(
    long id,
    LocalDate txDate,
    TransactionType type,
    long amount,
    Long accountId,
    Long fromAccountId,
    Long toAccountId,
    String description,
    Long categoryId,
    List<String> tagNames,
    boolean needsReview,
    boolean excludeFromReports,
    SourceType source,
    Instant deletedAt
) {
}
