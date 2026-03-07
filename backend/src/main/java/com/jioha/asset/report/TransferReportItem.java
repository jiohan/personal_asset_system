package com.jioha.asset.report;

public record TransferReportItem(
    long fromAccountId,
    long toAccountId,
    long amount
) {
}
