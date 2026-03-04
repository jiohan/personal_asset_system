package com.jioha.asset.account;

public record AccountResponse(
    long id,
    String name,
    AccountType type,
    boolean isActive,
    Integer orderIndex,
    long openingBalance,
    Long currentBalance
) {
}
