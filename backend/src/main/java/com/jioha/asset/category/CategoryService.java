package com.jioha.asset.category;

import com.jioha.asset.api.ApiErrorResponse.FieldError;
import com.jioha.asset.auth.AuthUserDetails;
import com.jioha.asset.auth.AuthUserPrincipal;
import com.jioha.asset.auth.RequestValidationException;
import com.jioha.asset.domain.TransactionType;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
public class CategoryService {

  private final CategoryRepository categoryRepository;

  public CategoryService(CategoryRepository categoryRepository) {
    this.categoryRepository = categoryRepository;
  }

  public CategoryListResponse list(TransactionType type) {
    long userId = currentUserId();
    List<CategoryResponse> items = categoryRepository.findVisibleForUser(userId, type).stream()
        .map(this::toResponse)
        .toList();
    return new CategoryListResponse(items);
  }

  @Transactional
  public CategoryResponse create(CategoryCreateRequest request) {
    long userId = currentUserId();
    CategoryEntity entity = new CategoryEntity();
    entity.setUserId(userId);
    entity.setType(request.type());
    entity.setName(request.name().trim());
    entity.setNameNormalized(normalizeName(request.name()));
    entity.setActive(request.isActive() == null || request.isActive());
    entity.setOrderIndex(request.orderIndex());
    entity.setParentId(resolveParentId(userId, request.type(), request.parentId()));

    return toResponse(categoryRepository.save(entity));
  }

  @Transactional
  public CategoryResponse patch(long id, CategoryPatchRequest request, boolean parentIdProvided) {
    long userId = currentUserId();
    CategoryEntity entity = categoryRepository.findVisibleById(id, userId)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Category not found."));

    if (entity.getUserId() == null) {
      throw new ResponseStatusException(CONFLICT, "System category cannot be modified.");
    }

    if (request.name() != null) {
      String name = request.name().trim();
      if (name.isEmpty()) {
        throw new RequestValidationException(
            "Invalid request.",
            List.of(new FieldError("name", "must not be blank")));
      }
      entity.setName(name);
      entity.setNameNormalized(normalizeName(name));
    }

    if (request.isActive() != null) {
      entity.setActive(request.isActive());
    }

    if (request.orderIndex() != null) {
      entity.setOrderIndex(request.orderIndex());
    }

    if (parentIdProvided) {
      if (request.parentId() == null) {
        entity.setParentId(null);
      } else {
        if (request.parentId().equals(entity.getId())) {
          throw new RequestValidationException(
              "Invalid request.",
              List.of(new FieldError("parentId", "must not reference itself")));
        }
        entity.setParentId(resolveParentId(userId, entity.getType(), request.parentId()));
      }
    }

    return toResponse(entity);
  }

  private Long resolveParentId(long userId, TransactionType type, Long parentId) {
    if (parentId == null) {
      return null;
    }
    CategoryEntity parent = categoryRepository.findVisibleById(parentId, userId)
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Parent category not found."));
    if (parent.getType() != type) {
      throw new RequestValidationException(
          "Invalid request.",
          List.of(new FieldError("parentId", "must match category type")));
    }
    if (parent.getParentId() != null) {
      throw new RequestValidationException(
          "Invalid request.",
          List.of(new FieldError("parentId", "depth must be <= 2")));
    }
    return parent.getId();
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

  private String normalizeName(String name) {
    return name.trim().toLowerCase(Locale.ROOT);
  }

  private CategoryResponse toResponse(CategoryEntity entity) {
    return new CategoryResponse(
        entity.getId(),
        entity.getType(),
        entity.getName(),
        entity.getParentId(),
        entity.isActive(),
        entity.getOrderIndex());
  }
}
