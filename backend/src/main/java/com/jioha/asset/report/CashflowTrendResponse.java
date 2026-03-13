package com.jioha.asset.report;

import java.time.LocalDate;
import java.util.List;

public record CashflowTrendResponse(
    LocalDate from,
    LocalDate to,
    List<CashflowTrendPointResponse> items
) {
}
