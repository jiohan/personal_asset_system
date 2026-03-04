package com.jioha.asset.category;

import com.jioha.asset.domain.TransactionType;

public record CategoryResponse(
    long id,
    TransactionType type,
    String name,
    Long parentId,
    boolean isActive,
    Integer orderIndex
) {
}
