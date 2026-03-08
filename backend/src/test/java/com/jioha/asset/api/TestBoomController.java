package com.jioha.asset.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class TestBoomController {

  @GetMapping("/test/boom")
  String boom() {
    throw new IllegalStateException("boom");
  }
}
