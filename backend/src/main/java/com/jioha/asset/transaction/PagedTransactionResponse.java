package com.jioha.asset.transaction;

import java.util.List;

public record PagedTransactionResponse(
    List<TransactionResponse> items,
    int page,
    int size,
    long totalElements
) {
}
