package com.jioha.asset.report;

import com.jioha.asset.account.AccountEntity;
import com.jioha.asset.account.AccountRepository;
import com.jioha.asset.api.ApiErrorResponse.FieldError;
import com.jioha.asset.auth.AuthUserDetails;
import com.jioha.asset.auth.AuthUserPrincipal;
import com.jioha.asset.auth.RequestValidationException;
import com.jioha.asset.category.CategoryEntity;
import com.jioha.asset.category.CategoryRepository;
import com.jioha.asset.domain.ReportCalculator;
import com.jioha.asset.domain.ReportSummary;
import com.jioha.asset.domain.TransactionType;
import com.jioha.asset.transaction.TransactionEntity;
import com.jioha.asset.transaction.TransactionRepository;
import com.jioha.asset.transaction.TransactionRepository.TransferPairProjection;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
public class ReportService {

  private final TransactionRepository transactionRepository;
  private final AccountRepository accountRepository;
  private final CategoryRepository categoryRepository;

  public ReportService(
      TransactionRepository transactionRepository,
      AccountRepository accountRepository,
      CategoryRepository categoryRepository) {
    this.transactionRepository = transactionRepository;
    this.accountRepository = accountRepository;
    this.categoryRepository = categoryRepository;
  }

  public ReportSummaryResponse summary(LocalDate from, LocalDate to) {
    validateRange(from, to);

    long userId = currentUserId();
    LocalDate toExclusive = to.plusDays(1);

    ReportSummary summary = ReportCalculator.summarize(
        transactionRepository.findReportSnapshots(userId, from, toExclusive));

    return new ReportSummaryResponse(
        from,
        to,
        summary.totalIncome(),
        summary.totalExpense(),
        summary.netSaving(),
        summary.transferVolume());
  }

  public TransferReportResponse transfers(LocalDate from, LocalDate to) {
    validateRange(from, to);

    long userId = currentUserId();
    LocalDate toExclusive = to.plusDays(1);

    List<TransferReportItem> items = transactionRepository
        .findTransferPairs(userId, TransactionType.TRANSFER, from, toExclusive)
        .stream()
        .map(this::toItem)
        .toList();

    return new TransferReportResponse(from, to, items);
  }

  public CashflowTrendResponse cashflow(LocalDate from, LocalDate to) {
    validateRange(from, to);

    long userId = currentUserId();
    Map<LocalDate, CashflowBucket> buckets = new LinkedHashMap<>();
    for (LocalDate cursor = from; !cursor.isAfter(to); cursor = cursor.plusDays(1)) {
      buckets.put(cursor, new CashflowBucket());
    }

    for (TransactionEntity entity : transactionRepository
        .findAllByUserIdAndDeletedAtIsNullAndTxDateGreaterThanEqualAndTxDateLessThanEqualOrderByTxDateAscIdAsc(userId, from, to)) {
      CashflowBucket bucket = buckets.get(entity.getTxDate());
      if (bucket == null) {
        continue;
      }
      switch (entity.getType()) {
        case INCOME -> bucket.income += entity.getAmount();
        case EXPENSE -> {
          if (!entity.isExcludeFromReports()) {
            bucket.expense += entity.getAmount();
          }
        }
        case TRANSFER -> bucket.transfer += entity.getAmount();
      }
    }

    List<CashflowTrendPointResponse> items = buckets.entrySet().stream()
        .map((entry) -> new CashflowTrendPointResponse(
            entry.getKey(),
            entry.getValue().income,
            entry.getValue().expense,
            entry.getValue().income - entry.getValue().expense,
            entry.getValue().transfer))
        .toList();

    return new CashflowTrendResponse(from, to, items);
  }

  public TopExpenseCategoriesResponse topExpenseCategories(LocalDate from, LocalDate to, int limit) {
    validateRange(from, to);
    validateLimit(limit);

    long userId = currentUserId();
    Map<Long, CategoryEntity> categoriesById = new HashMap<>();
    for (CategoryEntity category : categoryRepository.findAccessibleForUser(userId, TransactionType.EXPENSE)) {
      categoriesById.put(category.getId(), category);
    }

    Map<Long, ExpenseBucket> buckets = new LinkedHashMap<>();
    for (TransactionEntity entity : transactionRepository
        .findAllByUserIdAndDeletedAtIsNullAndTxDateGreaterThanEqualAndTxDateLessThanEqualOrderByTxDateAscIdAsc(userId, from, to)) {
      if (entity.getType() != TransactionType.EXPENSE || entity.isExcludeFromReports()) {
        continue;
      }
      long key = entity.getCategoryId() == null ? -1L : entity.getCategoryId();
      ExpenseBucket bucket = buckets.computeIfAbsent(key, (ignored) -> new ExpenseBucket());
      bucket.amount += entity.getAmount();
      bucket.count += 1;
    }

    List<TopExpenseCategoryItemResponse> items = buckets.entrySet().stream()
        .sorted((left, right) -> {
          int byAmount = Long.compare(right.getValue().amount, left.getValue().amount);
          if (byAmount != 0) return byAmount;
          return Long.compare(right.getValue().count, left.getValue().count);
        })
        .limit(limit)
        .map((entry) -> {
          Long categoryId = entry.getKey() == -1L ? null : entry.getKey();
          String categoryName = categoryId == null
              ? "Uncategorized"
              : Optional.ofNullable(categoriesById.get(categoryId)).map(CategoryEntity::getName).orElse("Unknown");
          return new TopExpenseCategoryItemResponse(
              categoryId,
              categoryName,
              entry.getValue().amount,
              entry.getValue().count);
        })
        .toList();

    return new TopExpenseCategoriesResponse(from, to, limit, items);
  }

  public AccountBalanceTrendResponse accountBalances(LocalDate from, LocalDate to) {
    validateRange(from, to);

    long userId = currentUserId();
    List<AccountEntity> accounts = accountRepository.findAllByUserIdOrderForList(userId);
    Map<Long, Long> runningBalance = new LinkedHashMap<>();
    Map<Long, Map<LocalDate, Long>> dailyDelta = new HashMap<>();

    for (AccountEntity account : accounts) {
      runningBalance.put(account.getId(), account.getOpeningBalance());
    }

    for (TransactionEntity entity : transactionRepository
        .findAllByUserIdAndDeletedAtIsNullAndTxDateLessThanEqualOrderByTxDateAscIdAsc(userId, to)) {
      Map<Long, Long> deltaForTransaction = accountDelta(entity);
      if (entity.getTxDate().isBefore(from)) {
        applyDelta(runningBalance, deltaForTransaction);
        continue;
      }

      Map<LocalDate, Long> current;
      for (Map.Entry<Long, Long> deltaEntry : deltaForTransaction.entrySet()) {
        current = dailyDelta.computeIfAbsent(deltaEntry.getKey(), (ignored) -> new HashMap<>());
        current.merge(entity.getTxDate(), deltaEntry.getValue(), Long::sum);
      }
    }

    List<AccountBalanceSeriesResponse> items = new ArrayList<>();
    for (AccountEntity account : accounts) {
      List<AccountBalancePointResponse> points = new ArrayList<>();
      long currentBalance = runningBalance.getOrDefault(account.getId(), account.getOpeningBalance());

      for (LocalDate cursor = from; !cursor.isAfter(to); cursor = cursor.plusDays(1)) {
        long delta = dailyDelta.getOrDefault(account.getId(), Map.of()).getOrDefault(cursor, 0L);
        currentBalance += delta;
        points.add(new AccountBalancePointResponse(cursor, currentBalance));
      }

      items.add(new AccountBalanceSeriesResponse(
          account.getId(),
          account.getName(),
          account.getType(),
          account.getOpeningBalance(),
          currentBalance,
          points));
    }

    return new AccountBalanceTrendResponse(from, to, items);
  }

  private TransferReportItem toItem(TransferPairProjection p) {
    long amount = p.getAmount() == null ? 0L : p.getAmount();
    if (p.getFromAccountId() == null || p.getToAccountId() == null) {
      throw new IllegalStateException("Transfer projection must have from/to account IDs.");
    }
    return new TransferReportItem(p.getFromAccountId(), p.getToAccountId(), amount);
  }

  private void validateRange(LocalDate from, LocalDate to) {
    if (from == null || to == null) {
      throw new RequestValidationException(
          "Invalid request.",
          List.of(new FieldError("from", "is required"), new FieldError("to", "is required")));
    }
    if (to.isBefore(from)) {
      throw new RequestValidationException(
          "Invalid request.",
          List.of(new FieldError("to", "must be on or after from")));
    }
  }

  private void validateLimit(int limit) {
    if (limit < 1 || limit > 12) {
      throw new RequestValidationException(
          "Invalid request.",
          List.of(new FieldError("limit", "must be between 1 and 12")));
    }
  }

  private Map<Long, Long> accountDelta(TransactionEntity entity) {
    Map<Long, Long> delta = new LinkedHashMap<>();
    switch (entity.getType()) {
      case INCOME -> mergeDelta(delta, entity.getAccountId(), entity.getAmount());
      case EXPENSE -> mergeDelta(delta, entity.getAccountId(), -entity.getAmount());
      case TRANSFER -> {
        mergeDelta(delta, entity.getFromAccountId(), -entity.getAmount());
        mergeDelta(delta, entity.getToAccountId(), entity.getAmount());
      }
    }
    return delta;
  }

  private void applyDelta(Map<Long, Long> runningBalance, Map<Long, Long> delta) {
    for (Map.Entry<Long, Long> entry : delta.entrySet()) {
      runningBalance.merge(entry.getKey(), entry.getValue(), Long::sum);
    }
  }

  private void mergeDelta(Map<Long, Long> delta, Long accountId, long amount) {
    if (accountId == null) {
      return;
    }
    delta.merge(accountId, amount, Long::sum);
  }

  private long currentUserId() {
    Authentication authentication = Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
        .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "Unauthorized."));
    Object principal = authentication.getPrincipal();
    if (principal instanceof AuthUserPrincipal p) {
      return p.userId();
    }
    if (principal instanceof AuthUserDetails d) {
      return d.userId();
    }
    throw new ResponseStatusException(UNAUTHORIZED, "Unauthorized.");
  }

  private static final class CashflowBucket {
    long income;
    long expense;
    long transfer;
  }

  private static final class ExpenseBucket {
    long amount;
    long count;
  }
}
