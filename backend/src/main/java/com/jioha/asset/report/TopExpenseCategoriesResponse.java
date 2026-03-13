package com.jioha.asset.report;

import java.time.LocalDate;
import java.util.List;

public record TopExpenseCategoriesResponse(
    LocalDate from,
    LocalDate to,
    int limit,
    List<TopExpenseCategoryItemResponse> items
) {
}
