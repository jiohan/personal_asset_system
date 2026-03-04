package com.jioha.asset.account;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record AccountCreateRequest(
    @NotBlank @Size(max = 100) String name,
    @NotNull AccountType type,
    Boolean isActive,
    Integer orderIndex,
    @PositiveOrZero Long openingBalance
) {
}
