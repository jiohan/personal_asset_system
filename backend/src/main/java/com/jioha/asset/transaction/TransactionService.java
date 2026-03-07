package com.jioha.asset.transaction;

import com.jioha.asset.account.AccountEntity;
import com.jioha.asset.account.AccountRepository;
import com.jioha.asset.api.ApiErrorResponse.FieldError;
import com.jioha.asset.auth.AuthUserDetails;
import com.jioha.asset.auth.AuthUserPrincipal;
import com.jioha.asset.auth.RequestValidationException;
import com.jioha.asset.category.CategoryEntity;
import com.jioha.asset.category.CategoryRepository;
import com.jioha.asset.domain.TransactionDraft;
import com.jioha.asset.domain.TransactionRuleValidator;
import com.jioha.asset.domain.TransactionType;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
public class TransactionService {

  private final TransactionRepository transactionRepository;
  private final AccountRepository accountRepository;
  private final CategoryRepository categoryRepository;

  public TransactionService(
      TransactionRepository transactionRepository,
      AccountRepository accountRepository,
      CategoryRepository categoryRepository) {
    this.transactionRepository = transactionRepository;
    this.accountRepository = accountRepository;
    this.categoryRepository = categoryRepository;
  }

  public PagedTransactionResponse list(
      LocalDate from,
      LocalDate to,
      Long accountId,
      TransactionType type,
      Long categoryId,
      Boolean needsReview,
      String searchQ,
      int page,
      int size,
      String sortParam) {
    long userId = currentUserId();

    int normalizedPage = Math.max(page, 0);
    int normalizedSize = Math.min(Math.max(size, 1), 200);

    Page<TransactionEntity> result = transactionRepository.findAll(
        spec(userId, from, to, accountId, type, categoryId, needsReview, searchQ),
        PageRequest.of(normalizedPage, normalizedSize, parseSort(sortParam)));

    List<TransactionResponse> items = result.getContent().stream().map(this::toResponse).toList();
    return new PagedTransactionResponse(items, result.getNumber(), result.getSize(), result.getTotalElements());
  }

  @Transactional
  public TransactionResponse create(TransactionCreateRequest request) {
    long userId = currentUserId();

    TransactionDraft draft = validateDraft(
        request.type(),
        request.amount(),
        request.accountId(),
        request.fromAccountId(),
        request.toAccountId(),
        request.categoryId(),
        request.needsReview() != null && request.needsReview(),
        request.excludeFromReports() != null && request.excludeFromReports());

    verifyAccountAndCategoryPolicy(userId, draft);

    TransactionEntity entity = new TransactionEntity();
    entity.setUserId(userId);
    entity.setTxDate(request.txDate());
    entity.setType(draft.type());
    entity.setAmount(draft.amount());
    entity.setAccountId(draft.accountId());
    entity.setFromAccountId(draft.fromAccountId());
    entity.setToAccountId(draft.toAccountId());
    entity.setDescription(normalizeDescription(request.description()));
    entity.setCategoryId(draft.categoryId());
    entity.setNeedsReview(draft.needsReview());
    entity.setExcludeFromReports(draft.excludeFromReports());
    entity.setSource(SourceType.MANUAL);
    entity.setTagNames(normalizeTagNames(request.tagNames()));

    return toResponse(transactionRepository.save(entity));
  }

  public TransactionResponse get(long id) {
    long userId = currentUserId();
    TransactionEntity entity = transactionRepository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Transaction not found."));
    return toResponse(entity);
  }

  @Transactional
  public TransactionResponse patch(long id, TransactionPatchRequest request) {
    long userId = currentUserId();
    TransactionEntity entity = transactionRepository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Transaction not found."));

    Long normalizedCategoryId;
    if (entity.getType() == TransactionType.TRANSFER) {
      normalizedCategoryId = null;
    } else if (request.clearCategory() != null && request.clearCategory()) {
      normalizedCategoryId = null;
    } else if (request.categoryId() != null) {
      normalizedCategoryId = request.categoryId();
    } else {
      normalizedCategoryId = entity.getCategoryId();
    }

    TransactionDraft draft = validateDraft(
        entity.getType(),
        request.amount() != null ? request.amount() : entity.getAmount(),
        request.accountId() != null ? request.accountId() : entity.getAccountId(),
        request.fromAccountId() != null ? request.fromAccountId() : entity.getFromAccountId(),
        request.toAccountId() != null ? request.toAccountId() : entity.getToAccountId(),
        normalizedCategoryId,
        request.needsReview() != null ? request.needsReview() : entity.isNeedsReview(),
        request.excludeFromReports() != null ? request.excludeFromReports() : entity.isExcludeFromReports());

    verifyAccountAndCategoryPolicy(userId, draft);

    if (request.txDate() != null) {
      entity.setTxDate(request.txDate());
    }
    entity.setAmount(draft.amount());
    entity.setAccountId(draft.accountId());
    entity.setFromAccountId(draft.fromAccountId());
    entity.setToAccountId(draft.toAccountId());
    entity.setCategoryId(draft.categoryId());
    entity.setNeedsReview(draft.needsReview());
    entity.setExcludeFromReports(draft.excludeFromReports());

    if (request.description() != null) {
      entity.setDescription(normalizeDescription(request.description()));
    }
    if (request.tagNames() != null) {
      entity.setTagNames(normalizeTagNames(request.tagNames()));
    }

    return toResponse(entity);
  }

  @Transactional
  public void delete(long id) {
    long userId = currentUserId();
    TransactionEntity entity = transactionRepository.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Transaction not found."));
    entity.setDeletedAt(Instant.now());
  }

  private void verifyAccountAndCategoryPolicy(long userId, TransactionDraft draft) {
    if (draft.type() == TransactionType.INCOME || draft.type() == TransactionType.EXPENSE) {
      ensureActiveAccountOwnership(userId, draft.accountId(), "accountId");
    } else if (draft.type() == TransactionType.TRANSFER) {
      ensureActiveAccountOwnership(userId, draft.fromAccountId(), "fromAccountId");
      ensureActiveAccountOwnership(userId, draft.toAccountId(), "toAccountId");
    }
    if (draft.categoryId() != null) {
        CategoryEntity category = categoryRepository.findAccessibleById(draft.categoryId(), userId)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Category not found."));
      if (!category.isActive()) {
        throw new ResponseStatusException(CONFLICT, "Inactive category cannot be used.");
      }
      if (category.getType() != draft.type()) {
        throw new RequestValidationException(
            "Invalid request.",
            List.of(new FieldError("categoryId", "must match transaction type")));
      }
    }
  }

  private void ensureActiveAccountOwnership(long userId, Long accountId, String fieldName) {
    if (accountId == null) {
      return;
    }
    AccountEntity account = accountRepository.findByIdAndUserId(accountId, userId)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Account not found."));
    if (!account.isActive()) {
      throw new RequestValidationException(
          "Invalid request.",
          List.of(new FieldError(fieldName, "inactive account cannot be used")));
    }
  }

  private TransactionDraft validateDraft(
      TransactionType type,
      long amount,
      Long accountId,
      Long fromAccountId,
      Long toAccountId,
      Long categoryId,
      boolean needsReview,
      boolean excludeFromReports) {
    List<FieldError> errors = new ArrayList<>();

    if (type == null) {
      errors.add(new FieldError("type", "is required"));
    }

    if (type == TransactionType.TRANSFER) {
      if (accountId != null) {
        errors.add(new FieldError("accountId", "must be null for TRANSFER"));
      }
      if (categoryId != null) {
        errors.add(new FieldError("categoryId", "must be null for TRANSFER"));
      }
      if (fromAccountId == null) {
        errors.add(new FieldError("fromAccountId", "is required for TRANSFER"));
      }
      if (toAccountId == null) {
        errors.add(new FieldError("toAccountId", "is required for TRANSFER"));
      }
      if (fromAccountId != null && toAccountId != null && fromAccountId.equals(toAccountId)) {
        errors.add(new FieldError("toAccountId", "must be different from fromAccountId"));
      }
    } else if (type == TransactionType.INCOME || type == TransactionType.EXPENSE) {
      if (accountId == null) {
        errors.add(new FieldError("accountId", "is required for INCOME/EXPENSE"));
      }
      if (fromAccountId != null) {
        errors.add(new FieldError("fromAccountId", "must be null for INCOME/EXPENSE"));
      }
      if (toAccountId != null) {
        errors.add(new FieldError("toAccountId", "must be null for INCOME/EXPENSE"));
      }
    }

    if (!errors.isEmpty()) {
      throw new RequestValidationException("Invalid request.", errors);
    }

    return TransactionRuleValidator.sanitizeAndValidate(new TransactionDraft(
        type,
        amount,
        accountId,
        fromAccountId,
        toAccountId,
        categoryId,
        needsReview,
        excludeFromReports));
  }

  private String normalizeDescription(String description) {
    if (description == null) {
      return "";
    }
    return description.trim();
  }

  private Set<String> normalizeTagNames(List<String> tagNames) {
    Set<String> normalized = new LinkedHashSet<>();
    if (tagNames == null) {
      return normalized;
    }
    for (String tag : tagNames) {
      if (tag == null) {
        continue;
      }
      String v = tag.trim();
      if (!v.isEmpty()) {
        normalized.add(v);
      }
    }
    return normalized;
  }

  private Sort parseSort(String sortParam) {
    String[] parts = sortParam == null ? new String[0] : sortParam.split(",");
    String requested = parts.length > 0 ? parts[0].trim() : "txDate";
    String direction = parts.length > 1 ? parts[1].trim().toLowerCase(Locale.ROOT) : "desc";

    String sortField = switch (requested) {
      case "txDate" -> "txDate";
      case "amount" -> "amount";
      case "createdAt" -> "createdAt";
      case "id" -> "id";
      default -> "txDate";
    };

    Sort.Direction dir = "asc".equals(direction) ? Sort.Direction.ASC : Sort.Direction.DESC;
    return Sort.by(dir, sortField).and(Sort.by(Sort.Direction.DESC, "id"));
  }

  private Specification<TransactionEntity> spec(
      long userId,
      LocalDate from,
      LocalDate to,
      Long accountId,
      TransactionType type,
      Long categoryId,
      Boolean needsReview,
      String searchQ) {
    return (root, query, cb) -> {
      List<Predicate> predicates = new ArrayList<>();
      predicates.add(cb.equal(root.get("userId"), userId));
      predicates.add(cb.isNull(root.get("deletedAt")));

      if (from != null) {
        predicates.add(cb.greaterThanOrEqualTo(root.get("txDate"), from));
      }
      if (to != null) {
        predicates.add(cb.lessThan(root.get("txDate"), to.plusDays(1)));
      }
      if (type != null) {
        predicates.add(cb.equal(root.get("type"), type));
      }
      if (categoryId != null) {
        predicates.add(cb.equal(root.get("categoryId"), categoryId));
      }
      if (needsReview != null) {
        predicates.add(cb.equal(root.get("needsReview"), needsReview));
      }
      if (searchQ != null && !searchQ.trim().isEmpty()) {
        predicates.add(cb.like(cb.lower(root.get("description")), "%" + searchQ.trim().toLowerCase(Locale.ROOT) + "%"));
      }
      if (accountId != null) {
        predicates.add(cb.or(
            cb.equal(root.get("accountId"), accountId),
            cb.equal(root.get("fromAccountId"), accountId),
            cb.equal(root.get("toAccountId"), accountId)));
      }

      return cb.and(predicates.toArray(Predicate[]::new));
    };
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

  private TransactionResponse toResponse(TransactionEntity entity) {
    return new TransactionResponse(
        entity.getId(),
        entity.getTxDate(),
        entity.getType(),
        entity.getAmount(),
        entity.getAccountId(),
        entity.getFromAccountId(),
        entity.getToAccountId(),
        entity.getDescription(),
        entity.getCategoryId(),
        List.copyOf(entity.getTagNames()),
        entity.isNeedsReview(),
        entity.isExcludeFromReports(),
        entity.getSource(),
        entity.getDeletedAt());
  }
}
