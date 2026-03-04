package com.jioha.asset.account;

import com.jioha.asset.api.ApiErrorResponse.FieldError;
import com.jioha.asset.auth.AuthUserDetails;
import com.jioha.asset.auth.AuthUserPrincipal;
import com.jioha.asset.auth.RequestValidationException;
import java.util.List;
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

  public AccountService(AccountRepository accountRepository) {
    this.accountRepository = accountRepository;
  }

  public AccountListResponse list() {
    long userId = currentUserId();
    List<AccountResponse> items = accountRepository.findAllByUserIdOrderForList(userId).stream()
        .map(this::toResponse)
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

    return toResponse(accountRepository.save(entity));
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

    return toResponse(entity);
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

  private AccountResponse toResponse(AccountEntity entity) {
    return new AccountResponse(
        entity.getId(),
        entity.getName(),
        entity.getType(),
        entity.isActive(),
        entity.getOrderIndex(),
        entity.getOpeningBalance(),
        null);
  }
}
