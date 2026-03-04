package com.jioha.asset.transaction;

import com.jioha.asset.domain.TransactionType;
import jakarta.validation.Valid;
import java.time.LocalDate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/transactions")
public class TransactionController {

  private final TransactionService transactionService;

  public TransactionController(TransactionService transactionService) {
    this.transactionService = transactionService;
  }

  @GetMapping("")
  public PagedTransactionResponse list(
      @RequestParam(required = false) LocalDate from,
      @RequestParam(required = false) LocalDate to,
      @RequestParam(required = false) Long accountId,
      @RequestParam(required = false) TransactionType type,
      @RequestParam(required = false) Long categoryId,
      @RequestParam(required = false) Boolean needsReview,
      @RequestParam(required = false, name = "q") String searchQ,
      @RequestParam(required = false, defaultValue = "0") int page,
      @RequestParam(required = false, defaultValue = "50") int size,
      @RequestParam(required = false, defaultValue = "txDate,desc") String sort) {
    return transactionService.list(from, to, accountId, type, categoryId, needsReview, searchQ, page, size, sort);
  }

  @PostMapping("")
  public ResponseEntity<TransactionResponse> create(@Valid @RequestBody TransactionCreateRequest request) {
    return ResponseEntity.status(201).body(transactionService.create(request));
  }

  @GetMapping("/{id}")
  public TransactionResponse get(@PathVariable long id) {
    return transactionService.get(id);
  }

  @PatchMapping("/{id}")
  public TransactionResponse patch(@PathVariable long id, @Valid @RequestBody TransactionPatchRequest request) {
    return transactionService.patch(id, request);
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable long id) {
    transactionService.delete(id);
    return ResponseEntity.noContent().build();
  }
}
