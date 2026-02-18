package com.jioha.asset.domain;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ReportCalculatorTest {

  @Test
  void transfer_is_excluded_from_expense_and_counted_in_transfer_volume() {
    List<TransactionSnapshot> txs = List.of(
        new TransactionSnapshot(TransactionType.INCOME, 2_000_000L, false, false),
        new TransactionSnapshot(TransactionType.EXPENSE, 500_000L, false, false),
        new TransactionSnapshot(TransactionType.TRANSFER, 300_000L, false, false)
    );

    ReportSummary summary = ReportCalculator.summarize(txs);

    assertEquals(2_000_000L, summary.totalIncome());
    assertEquals(500_000L, summary.totalExpense());
    assertEquals(1_500_000L, summary.netSaving());
    assertEquals(300_000L, summary.transferVolume());
  }

  @Test
  void expense_with_exclude_from_reports_is_not_included_in_total_expense() {
    List<TransactionSnapshot> txs = List.of(
        new TransactionSnapshot(TransactionType.EXPENSE, 12_500L, true, false),
        new TransactionSnapshot(TransactionType.EXPENSE, 20_000L, false, false)
    );

    ReportSummary summary = ReportCalculator.summarize(txs);

    assertEquals(20_000L, summary.totalExpense());
    assertEquals(-20_000L, summary.netSaving());
  }
}
