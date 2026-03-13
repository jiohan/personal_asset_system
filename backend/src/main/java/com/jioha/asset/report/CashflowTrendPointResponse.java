package com.jioha.asset.report;

import java.time.LocalDate;

public record CashflowTrendPointResponse(
    LocalDate date,
    long income,
    long expense,
    long net,
    long transfer
) {
}
