package com.jioha.asset.report;

import com.jioha.asset.account.AccountType;
import java.util.List;

public record AccountBalanceSeriesResponse(
    long accountId,
    String accountName,
    AccountType accountType,
    long openingBalance,
    long currentBalance,
    List<AccountBalancePointResponse> points
) {
}
