package com.jioha.asset.domain;

public record TransactionSnapshot(
    TransactionType type,
    long amount,
    boolean excludeFromReports,
    boolean deleted
) {}
