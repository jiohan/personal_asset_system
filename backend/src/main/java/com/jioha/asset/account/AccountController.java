package com.jioha.asset.account;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/accounts")
public class AccountController {

  private final AccountService accountService;

  public AccountController(AccountService accountService) {
    this.accountService = accountService;
  }

  @GetMapping("")
  public AccountListResponse list() {
    return accountService.list();
  }

  @PostMapping("")
  public ResponseEntity<AccountResponse> create(@Valid @RequestBody AccountCreateRequest request) {
    return ResponseEntity.status(201).body(accountService.create(request));
  }

  @PatchMapping("/{id}")
  public AccountResponse patch(@PathVariable long id, @Valid @RequestBody AccountPatchRequest request) {
    return accountService.patch(id, request);
  }
}
