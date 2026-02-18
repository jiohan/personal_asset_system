package com.jioha.asset.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TransactionRuleValidatorTest {

  @Test
  void transfer_with_account_id_is_rejected() {
    TransactionDraft invalid = new TransactionDraft(
        TransactionType.TRANSFER,
        100_000L,
        1L,
        1L,
        2L,
        null,
        false,
        false
    );

    IllegalArgumentException ex = assertThrows(
        IllegalArgumentException.class,
        () -> TransactionRuleValidator.sanitizeAndValidate(invalid)
    );

    assertTrue(ex.getMessage().contains("accountId"));
  }

  @Test
  void same_from_and_to_account_is_rejected() {
    TransactionDraft invalid = new TransactionDraft(
        TransactionType.TRANSFER,
        100_000L,
        null,
        1L,
        1L,
        10L,
        false,
        false
    );

    IllegalArgumentException ex = assertThrows(
        IllegalArgumentException.class,
        () -> TransactionRuleValidator.sanitizeAndValidate(invalid)
    );

    assertTrue(ex.getMessage().contains("different"));
  }

  @Test
  void non_expense_exclude_from_reports_is_forced_to_false() {
    TransactionDraft input = new TransactionDraft(
        TransactionType.INCOME,
        2_000_000L,
        1L,
        null,
        null,
        10L,
        false,
        true
    );

    TransactionDraft normalized = TransactionRuleValidator.sanitizeAndValidate(input);

    assertEquals(false, normalized.excludeFromReports());
  }

  @Test
  void category_null_forces_needs_review_true() {
    TransactionDraft input = new TransactionDraft(
        TransactionType.EXPENSE,
        20_000L,
        1L,
        null,
        null,
        null,
        false,
        false
    );

    TransactionDraft normalized = TransactionRuleValidator.sanitizeAndValidate(input);

    assertEquals(true, normalized.needsReview());
  }
}
