package com.jioha.asset.domain;

public record TransactionDraft(
    TransactionType type,
    long amount,
    Long accountId,
    Long fromAccountId,
    Long toAccountId,
    Long categoryId,
    boolean needsReview,
    boolean excludeFromReports
) {}
