package com.jioha.asset.domain;

public record ReportSummary(
    long totalIncome,
    long totalExpense,
    long netSaving,
    long transferVolume
) {}
