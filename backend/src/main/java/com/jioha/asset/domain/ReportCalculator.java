package com.jioha.asset.domain;

import java.util.List;

public final class ReportCalculator {

  private ReportCalculator() {
  }

  public static ReportSummary summarize(List<TransactionSnapshot> transactions) {
    long totalIncome = 0L;
    long totalExpense = 0L;
    long transferVolume = 0L;

    for (TransactionSnapshot tx : transactions) {
      if (tx.deleted()) {
        continue;
      }

      if (tx.amount() <= 0) {
        throw new IllegalArgumentException("amount must be positive");
      }

      switch (tx.type()) {
        case INCOME -> totalIncome += tx.amount();
        case EXPENSE -> {
          if (!tx.excludeFromReports()) {
            totalExpense += tx.amount();
          }
        }
        case TRANSFER -> transferVolume += tx.amount();
      }
    }

    return new ReportSummary(totalIncome, totalExpense, totalIncome - totalExpense, transferVolume);
  }
}
