package com.jioha.asset.category;

import jakarta.validation.constraints.Size;

public record CategoryPatchRequest(
    @Size(max = 100) String name,
    Long parentId,
    Boolean isActive,
    Integer orderIndex
) {
}
