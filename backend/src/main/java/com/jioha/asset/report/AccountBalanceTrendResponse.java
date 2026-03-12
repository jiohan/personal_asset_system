package com.jioha.asset.report;

import java.time.LocalDate;
import java.util.List;

public record AccountBalanceTrendResponse(
    LocalDate from,
    LocalDate to,
    List<AccountBalanceSeriesResponse> items
) {
}
