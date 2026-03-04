package com.jioha.asset.account;

import com.jioha.asset.api.ApiErrorResponse.FieldError;
import com.jioha.asset.auth.AuthUserDetails;
import com.jioha.asset.auth.AuthUserPrincipal;
import com.jioha.asset.auth.RequestValidationException;
import com.jioha.asset.transaction.AccountBalanceProjection;
import com.jioha.asset.transaction.TransactionRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.NOT_FOUND;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
public class AccountService {

  private final AccountRepository accountRepository;
  private final TransactionRepository transactionRepository;

  public AccountService(AccountRepository accountRepository, TransactionRepository transactionRepository) {
    this.accountRepository = accountRepository;
    this.transactionRepository = transactionRepository;
  }

  public AccountListResponse list() {
    long userId = currentUserId();
    Map<Long, Long> currentBalances = loadCurrentBalances(userId);
    List<AccountResponse> items = accountRepository.findAllByUserIdOrderForList(userId).stream()
        .map((a) -> toResponse(a, currentBalances))
        .toList();
    return new AccountListResponse(items);
  }

  @Transactional
  public AccountResponse create(AccountCreateRequest request) {
    long userId = currentUserId();
    AccountEntity entity = new AccountEntity();
    entity.setUserId(userId);
    entity.setName(request.name().trim());
    entity.setType(request.type());
    entity.setActive(request.isActive() == null || request.isActive());
    entity.setOrderIndex(request.orderIndex());
    entity.setOpeningBalance(request.openingBalance() == null ? 0 : request.openingBalance());

    AccountEntity saved = accountRepository.save(entity);
    return toResponse(saved, loadCurrentBalances(userId));
  }

  @Transactional
  public AccountResponse patch(long id, AccountPatchRequest request) {
    long userId = currentUserId();

    AccountEntity entity = accountRepository.findByIdAndUserId(id, userId)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Account not found."));

    if (request.name() != null) {
      String name = request.name().trim();
      if (name.isEmpty()) {
        throw new RequestValidationException(
            "Invalid request.",
            List.of(new FieldError("name", "must not be blank")));
      }
      entity.setName(name);
    }

    if (request.isActive() != null) {
      entity.setActive(request.isActive());
    }

    if (request.orderIndex() != null) {
      entity.setOrderIndex(request.orderIndex());
    }

    return toResponse(entity, loadCurrentBalances(userId));
  }

  private Map<Long, Long> loadCurrentBalances(long userId) {
    Map<Long, Long> map = new HashMap<>();
    for (AccountBalanceProjection balance : transactionRepository.findCurrentBalancesByUserId(userId)) {
      map.put(balance.getAccountId(), balance.getCurrentBalance());
    }
    return map;
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

  private AccountResponse toResponse(AccountEntity entity, Map<Long, Long> currentBalances) {
    return new AccountResponse(
        entity.getId(),
        entity.getName(),
        entity.getType(),
        entity.isActive(),
        entity.getOrderIndex(),
        entity.getOpeningBalance(),
        currentBalances.getOrDefault(entity.getId(), entity.getOpeningBalance()));
  }
}
