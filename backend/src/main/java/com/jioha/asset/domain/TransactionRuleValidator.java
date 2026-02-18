package com.jioha.asset.domain;

public final class TransactionRuleValidator {

  private TransactionRuleValidator() {
  }

  public static TransactionDraft sanitizeAndValidate(TransactionDraft draft) {
    if (draft.type() == null) {
      throw new IllegalArgumentException("type is required");
    }
    if (draft.amount() <= 0) {
      throw new IllegalArgumentException("amount must be positive");
    }

    switch (draft.type()) {
      case TRANSFER -> validateTransferFields(draft);
      case INCOME, EXPENSE -> validateIncomeExpenseFields(draft);
    }

    boolean normalizedNeedsReview = draft.needsReview();
    if (draft.categoryId() == null) {
      normalizedNeedsReview = true;
    }

    boolean normalizedExcludeFromReports = draft.excludeFromReports();
    if (draft.type() != TransactionType.EXPENSE) {
      normalizedExcludeFromReports = false;
    }

    return new TransactionDraft(
        draft.type(),
        draft.amount(),
        draft.accountId(),
        draft.fromAccountId(),
        draft.toAccountId(),
        draft.categoryId(),
        normalizedNeedsReview,
        normalizedExcludeFromReports
    );
  }

  private static void validateTransferFields(TransactionDraft draft) {
    if (draft.accountId() != null) {
      throw new IllegalArgumentException("accountId must be null for TRANSFER");
    }
    if (draft.fromAccountId() == null || draft.toAccountId() == null) {
      throw new IllegalArgumentException("fromAccountId and toAccountId are required for TRANSFER");
    }
    if (draft.fromAccountId().equals(draft.toAccountId())) {
      throw new IllegalArgumentException("fromAccountId and toAccountId must be different");
    }
  }

  private static void validateIncomeExpenseFields(TransactionDraft draft) {
    if (draft.accountId() == null) {
      throw new IllegalArgumentException("accountId is required for INCOME/EXPENSE");
    }
    if (draft.fromAccountId() != null || draft.toAccountId() != null) {
      throw new IllegalArgumentException("fromAccountId/toAccountId must be null for INCOME/EXPENSE");
    }
  }
}
