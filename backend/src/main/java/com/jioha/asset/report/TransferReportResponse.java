package com.jioha.asset.report;

import java.time.LocalDate;
import java.util.List;

public record TransferReportResponse(
    LocalDate from,
    LocalDate to,
    List<TransferReportItem> items
) {
}
