package com.jioha.asset.report;

import java.time.LocalDate;

public record AccountBalancePointResponse(
    LocalDate date,
    long balance
) {
}
