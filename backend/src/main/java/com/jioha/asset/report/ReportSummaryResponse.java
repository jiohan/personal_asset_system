package com.jioha.asset.report;

import java.time.LocalDate;

public record ReportSummaryResponse(
    LocalDate from,
    LocalDate to,
    long totalIncome,
    long totalExpense,
    long netSaving,
    long transferVolume
) {
}
