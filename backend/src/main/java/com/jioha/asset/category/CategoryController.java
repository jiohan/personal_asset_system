package com.jioha.asset.category;

import com.fasterxml.jackson.databind.JsonNode;
import com.jioha.asset.api.patch.PatchPayload;
import com.jioha.asset.api.patch.PatchRequestMapper;
import com.jioha.asset.domain.TransactionType;
import jakarta.validation.Valid;
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
  private final PatchRequestMapper patchRequestMapper;

  public CategoryController(CategoryService categoryService, PatchRequestMapper patchRequestMapper) {
    this.categoryService = categoryService;
    this.patchRequestMapper = patchRequestMapper;
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
    PatchPayload<CategoryPatchRequest> payload = patchRequestMapper.map(body, CategoryPatchRequest.class);
    return categoryService.patch(id, payload.value(), payload.has("parentId"));
  }
}
