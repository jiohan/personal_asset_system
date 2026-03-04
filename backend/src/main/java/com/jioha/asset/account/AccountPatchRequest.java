package com.jioha.asset.account;

import jakarta.validation.constraints.Size;

public record AccountPatchRequest(
    @Size(max = 100) String name,
    Boolean isActive,
    Integer orderIndex
) {
}
