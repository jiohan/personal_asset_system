package com.jioha.asset.category;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.jioha.asset.api.ApiErrorResponse.FieldError;
import com.jioha.asset.auth.RequestValidationException;
import com.jioha.asset.domain.TransactionType;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/categories")
public class CategoryController {

  private final CategoryService categoryService;
  private final ObjectMapper objectMapper;
  private final Validator validator;

  public CategoryController(CategoryService categoryService, ObjectMapper objectMapper, Validator validator) {
    this.categoryService = categoryService;
    this.objectMapper = objectMapper;
    this.validator = validator;
  }

  @GetMapping("")
  public CategoryListResponse list(@RequestParam(required = false) TransactionType type) {
    return categoryService.list(type);
  }

  @PostMapping("")
  public ResponseEntity<CategoryResponse> create(@Valid @RequestBody CategoryCreateRequest request) {
    return ResponseEntity.status(201).body(categoryService.create(request));
  }

  @PatchMapping("/{id}")
  public CategoryResponse patch(@PathVariable long id, @RequestBody JsonNode body) {
    CategoryPatchRequest request = objectMapper.convertValue(body, CategoryPatchRequest.class);
    validate(request);
    return categoryService.patch(id, request, body.has("parentId"));
  }

  private void validate(CategoryPatchRequest request) {
    Set<ConstraintViolation<CategoryPatchRequest>> violations = validator.validate(request);
    if (violations.isEmpty()) {
      return;
    }

    List<FieldError> fieldErrors = violations.stream()
        .sorted(Comparator.comparing((ConstraintViolation<CategoryPatchRequest> v) -> v.getPropertyPath().toString()))
        .map((v) -> new FieldError(v.getPropertyPath().toString(), v.getMessage()))
        .toList();
    throw new RequestValidationException("Invalid request.", fieldErrors);
  }
}
