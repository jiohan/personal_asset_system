package com.jioha.asset.category;

import com.jioha.asset.domain.TransactionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CategoryCreateRequest(
    @NotNull TransactionType type,
    @NotBlank @Size(max = 100) String name,
    Long parentId,
    Boolean isActive,
    Integer orderIndex
) {
}
