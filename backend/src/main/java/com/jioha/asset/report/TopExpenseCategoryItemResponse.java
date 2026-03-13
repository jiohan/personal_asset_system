package com.jioha.asset.report;

public record TopExpenseCategoryItemResponse(
    Long categoryId,
    String categoryName,
    long amount,
    long transactionCount
) {
}
