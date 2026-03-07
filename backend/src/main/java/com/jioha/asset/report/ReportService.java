package com.jioha.asset.report;

import com.jioha.asset.api.ApiErrorResponse.FieldError;
import com.jioha.asset.auth.AuthUserDetails;
import com.jioha.asset.auth.AuthUserPrincipal;
import com.jioha.asset.auth.RequestValidationException;
import com.jioha.asset.domain.ReportCalculator;
import com.jioha.asset.domain.ReportSummary;
import com.jioha.asset.domain.TransactionType;
import com.jioha.asset.transaction.TransactionRepository;
import com.jioha.asset.transaction.TransactionRepository.TransferPairProjection;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
public class ReportService {

  private final TransactionRepository transactionRepository;

  public ReportService(TransactionRepository transactionRepository) {
    this.transactionRepository = transactionRepository;
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
}
