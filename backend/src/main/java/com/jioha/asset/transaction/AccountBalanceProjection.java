package com.jioha.asset.transaction;

public interface AccountBalanceProjection {
  Long getAccountId();

  Long getCurrentBalance();
}
